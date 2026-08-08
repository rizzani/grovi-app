import assert from "node:assert/strict";
import test from "node:test";
import { placeOrder, quoteOrder } from "../src/checkout.js";
import { CheckoutError } from "../src/errors.js";
import { fixture } from "./harness.js";

const NOW = () => "2026-07-20T13:00:00.000Z";

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof CheckoutError && error.code === code);
}

test("valid single-store checkout", async () => {
  const { repo, input, revision } = fixture();
  const result = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(result.data.status, "placed");
  assert.equal(result.data.itemCount, 2);
  assert.equal(result.data.storeCount, 1);
  assert.equal(result.data.totalJmdCents, 100000);
  assert.equal(result.data.deliveryFeeJmdCents, 50000);
  assert.equal(result.data.consumedRevision, revision);
  assert.equal(repo.orders.size, 1);
  assert.equal(repo.storeOrders.size, 1);
  assert.equal(repo.orderItems.size, 1);
  assert.equal(repo.audits.size, 1);
  assert.equal(repo.carts.size, 1);
  assert.deepEqual(JSON.parse(repo.carts.get("user-1").items), []);
});

test("valid multi-store checkout", async () => {
  const { repo, input } = fixture({ multiStore: true });
  const result = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(result.data.itemCount, 3);
  assert.equal(result.data.storeCount, 2);
  assert.equal(result.data.subtotalJmdCents, 90000);
  assert.equal(result.data.deliveryFeeJmdCents, 80000);
  assert.equal(repo.storeOrders.size, 2);
  assert.equal(repo.orderItems.size, 2);
});

test("checkout preserves an address without an optional contact phone", async () => {
  const { repo, input } = fixture();
  delete repo.addresses.get("address-1").contactPhone;
  const result = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(result.data.status, "placed");
  assert.equal(repo.orders.get(result.data.orderId).deliveryContactPhone, undefined);
});

test("empty cart", async () => {
  const { repo, input } = fixture();
  repo.carts.get("user-1").items = "[]";
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "EMPTY_CART");
});

test("address ownership failure", async () => {
  const { repo, input } = fixture();
  repo.addresses.get("address-1").userId = "user-2";
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "ADDRESS_NOT_OWNED");
});

test("price change", async () => {
  const { repo, input } = fixture();
  repo.inventory.get("product-1:store-1").price_jmd_cents = 26000;
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "PRICE_CHANGED");
});

test("unavailable product", async () => {
  const { repo, input } = fixture();
  repo.inventory.get("product-1:store-1").in_stock = false;
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "PRODUCT_UNAVAILABLE");
});

test("inactive store", async () => {
  const { repo, input } = fixture();
  repo.stores.get("store-1").is_active = false;
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "STORE_UNAVAILABLE");
});

test("duplicate identical request returns original order", async () => {
  const { repo, input } = fixture();
  const first = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  const second = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(second.data.orderId, first.data.orderId);
  assert.equal(second.data.idempotentReplay, true);
  assert.equal(repo.orders.size, 1);
  assert.equal(repo.audits.size, 1);
  assert.deepEqual(JSON.parse(repo.carts.get("user-1").items), []);
});

test("cart clear failure does not roll back the placed order and replay stays idempotent", async () => {
  const { repo, input } = fixture();
  repo.failCartClear = true;
  const first = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(first.data.status, "placed");
  assert.equal(first.data.cartReconciliation, "failed");
  const second = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(second.data.orderId, first.data.orderId);
  assert.equal(second.data.idempotentReplay, true);
  assert.equal(repo.orders.size, 1);
});

test("a new idempotency key cannot consume the same uncleared cart revision twice", async () => {
  const { repo, input } = fixture();
  repo.failCartClear = true;
  const first = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  const second = await placeOrder({ userId: "user-1", input: { ...input, clientRequestId: "request-2" }, repo, now: NOW });
  assert.equal(second.data.orderId, first.data.orderId);
  assert.equal(second.data.idempotentReplay, true);
  assert.equal(repo.orders.size, 1);
});

test("duplicate key with changed request is rejected", async () => {
  const { repo, input } = fixture();
  await placeOrder({ userId: "user-1", input, repo, now: NOW });
  await expectCode(placeOrder({
    userId: "user-1",
    input: { ...input, addressId: "different-address" },
    repo,
    now: NOW,
  }), "IDEMPOTENCY_CONFLICT");
});

test("partial-write retry resumes creating order", async () => {
  const { repo, input } = fixture({ multiStore: true });
  repo.failNextOrderItemCreate = true;
  await assert.rejects(placeOrder({ userId: "user-1", input, repo, now: NOW }), /Injected/);
  assert.equal([...repo.orders.values()][0].status, "creating");
  const result = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(result.data.status, "placed");
  assert.equal(result.data.idempotentReplay, true);
  assert.equal(repo.orders.size, 1);
  assert.equal(repo.storeOrders.size, 2);
  assert.equal(repo.orderItems.size, 2);
  assert.equal(repo.audits.size, 1);
});

test("malformed cart data", async () => {
  const { repo, input } = fixture();
  repo.carts.get("user-1").items = "{bad-json";
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "ORDER_CREATION_FAILED");
});

test("client cannot override server route pricing", async () => {
  const { repo, input } = fixture();
  await expectCode(placeOrder({ userId: "user-1", input: { ...input, deliveryFeeJmdCents: 1 }, repo, now: NOW }), "INVALID_REQUEST");
});

test("routing provider failure is retryable and never creates an order", async () => {
  const { repo, input } = fixture();
  repo.distanceProvider = { getDrivingDistance: async () => { throw new Error("offline"); } };
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "DELIVERY_DISTANCE_UNAVAILABLE");
  assert.equal(repo.orders.size, 0);
});

test("missing store coordinates is a configuration error", async () => {
  const { repo, input } = fixture();
  delete repo.stores.get("store-1").latitude;
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "STORE_LOCATION_COORDINATES_MISSING");
});

test("missing customer coordinates is rejected without estimating from text", async () => {
  const { repo, input } = fixture();
  delete repo.addresses.get("address-1").latitude;
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "INVALID_DELIVERY_LOCATION");
});

test("out of range delivery is rejected", async () => {
  const { repo, input } = fixture();
  repo.distanceProvider = { getDrivingDistance: async () => ({ distanceMeters: 20001 }) };
  await expectCode(placeOrder({ userId: "user-1", input, repo, now: NOW }), "DELIVERY_OUT_OF_RANGE");
});

test("delivery quote uses the same authoritative route pricing as order creation", async () => {
  const { repo, input } = fixture();
  const quote = await quoteOrder({ userId: "user-1", addressId: input.addressId, cartRevision: input.cartRevision, repo });
  assert.equal(quote.data.deliveryFeeJmdCents, 50000);
  assert.equal(quote.data.subtotalJmdCents, 50000);
  assert.equal(quote.data.totalJmdCents, 100000);
  assert.equal(quote.data.deliveryDistanceMeters, 5800);
  assert.equal(quote.data.deliveryPricingVersion, "distance-bands-v1");
});

test("delivery quote rejects a stale cart revision", async () => {
  const { repo, input } = fixture();
  await expectCode(quoteOrder({ userId: "user-1", addressId: input.addressId, cartRevision: "stale", repo }), "CART_REVISION_CONFLICT");
});
