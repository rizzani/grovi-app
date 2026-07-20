import test from "node:test";
import assert from "node:assert/strict";
import { createOrderService, OrderDatabase, OrderNotFoundError } from "./order-service-core";
import { OrderStatus, PaymentStatus, StoreOrderStatus } from "./order-types";

const order = (overrides: Record<string, unknown> = {}) => ({
  $id: "order-1", $sequence: 1, $collectionId: "orders", $databaseId: "db", $createdAt: "2026-07-20T12:00:00Z", $updatedAt: "2026-07-20T12:00:00Z", $permissions: [],
  userId: "user-1", orderNumber: "GRV-001", idempotencyKey: "key", requestFingerprint: "fingerprint",
  status: OrderStatus.Placed, paymentMethod: "cash_on_delivery", paymentStatus: PaymentStatus.Pending, currency: "JMD",
  addressId: "address-1", addressLabel: "Home", deliveryParish: "Kingston", deliveryCommunity: "Half Way Tree", deliveryLandmarkDirections: "Blue gate", deliveryContactPhone: "8765550000",
  itemCount: 1, storeCount: 1, subtotalJmdCents: 1000, deliveryFeeJmdCents: 0, discountJmdCents: 0, totalJmdCents: 1000, schemaVersion: 1, placedAt: "2026-07-20T12:00:00Z", ...overrides,
});

function fakeDatabase(options: { orders?: ReturnType<typeof order>[]; parent?: ReturnType<typeof order>; stores?: Record<string, unknown>[]; items?: Record<string, unknown>[]; error?: Error } = {}): OrderDatabase & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async getDocument(_databaseId: string, collection: string) { calls.push(`get:${collection}`); if (options.error) throw options.error; return options.parent ?? order(); },
    async listDocuments(_databaseId: string, collection: string) {
      calls.push(`list:${collection}`); if (options.error) throw options.error;
      const documents = collection === "orders" ? options.orders ?? [] : collection === "store_orders" ? options.stores ?? [] : options.items ?? [];
      return { documents: documents as never[], total: documents.length };
    },
  };
}

test("no orders returns an empty page", async () => {
  const service = createOrderService(fakeDatabase());
  assert.deepEqual(await service.getOrdersForUser("user-1"), { orders: [], nextCursor: null, hasMore: false });
});

test("one owned order is returned", async () => {
  const service = createOrderService(fakeDatabase({ orders: [order()] }));
  const page = await service.getOrdersForUser("user-1");
  assert.equal(page.orders.length, 1); assert.equal(page.orders[0].$id, "order-1"); assert.equal(page.hasMore, false);
});

test("pagination returns a cursor and subsequent page", async () => {
  let page = 0;
  const db = fakeDatabase();
  db.listDocuments = async (_databaseId: string, collection: string) => {
    db.calls.push(`list:${collection}`); page += 1;
    const documents = page === 1 ? [order({ $id: "1" }), order({ $id: "2" }), order({ $id: "3" })] : [order({ $id: "3" })];
    return { documents, total: documents.length };
  };
  const service = createOrderService(db);
  const first = await service.getOrdersForUser("user-1", { limit: 2 });
  assert.equal(first.hasMore, true); assert.equal(first.nextCursor, "2"); assert.equal(first.orders.length, 2);
  const second = await service.getOrdersForUser("user-1", { limit: 2, cursor: first.nextCursor });
  assert.equal(second.hasMore, false); assert.equal(second.orders[0].$id, "3");
});

test("unauthorized order ID is rejected before loading children", async () => {
  const db = fakeDatabase({ parent: order({ userId: "another-user" }) });
  const service = createOrderService(db);
  await assert.rejects(() => service.getOrderDetails("order-1", "user-1"), OrderNotFoundError);
  assert.deepEqual(db.calls, ["get:orders"]);
});

test("multi-store detail returns each store and its items", async () => {
  const common = { $sequence: 1, $collectionId: "x", $databaseId: "db", $createdAt: "now", $updatedAt: "now", $permissions: [], orderId: "order-1", userId: "user-1" };
  const stores = [
    { ...common, $id: "store-1", storeLocationId: "a", storeName: "Store A", status: StoreOrderStatus.Delivered, itemCount: 1, subtotalJmdCents: 500, deliveryFeeJmdCents: 0, discountJmdCents: 0, totalJmdCents: 500 },
    { ...common, $id: "store-2", storeLocationId: "b", storeName: "Store B", status: StoreOrderStatus.Cancelled, itemCount: 1, subtotalJmdCents: 500, deliveryFeeJmdCents: 0, discountJmdCents: 0, totalJmdCents: 500 },
  ];
  const items = stores.map((store, index) => ({ ...common, $id: `item-${index}`, storeOrderId: store.$id, productId: `p-${index}`, storeLocationId: store.storeLocationId, sku: `sku-${index}`, title: `Item ${index}`, quantity: 1, unitPriceJmdCents: 500, lineTotalJmdCents: 500 }));
  const service = createOrderService(fakeDatabase({ parent: order({ storeCount: 2, itemCount: 2 }), stores, items }));
  const details = await service.getOrderDetails("order-1", "user-1");
  assert.equal(details.storeOrders.length, 2); assert.equal(details.items.length, 2); assert.equal(details.items[1].storeOrderId, "store-2");
});

test("cancelled order is preserved for presentation", async () => {
  const service = createOrderService(fakeDatabase({ orders: [order({ status: OrderStatus.Cancelled, statusReason: "Customer requested cancellation" })] }));
  const page = await service.getOrdersForUser("user-1");
  assert.equal(page.orders[0].status, OrderStatus.Cancelled); assert.equal(page.orders[0].statusReason, "Customer requested cancellation");
});

test("failed network request is propagated", async () => {
  const service = createOrderService(fakeDatabase({ error: new Error("network unavailable") }));
  await assert.rejects(() => service.getOrdersForUser("user-1"), /network unavailable/);
});
