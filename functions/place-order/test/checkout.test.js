import assert from "node:assert/strict";
import test from "node:test";
import { placeOrder } from "../src/checkout.js";
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
  assert.equal(result.data.totalJmdCents, 50000);
  assert.equal(result.data.deliveryFeeJmdCents, 0);
  assert.equal(result.data.consumedRevision, revision);
  assert.equal(repo.orders.size, 1);
  assert.equal(repo.storeOrders.size, 1);
  assert.equal(repo.orderItems.size, 1);
  assert.equal(repo.audits.size, 1);
  assert.equal(repo.carts.size, 1);
});

test("valid multi-store checkout", async () => {
  const { repo, input } = fixture({ multiStore: true });
  const result = await placeOrder({ userId: "user-1", input, repo, now: NOW });
  assert.equal(result.data.itemCount, 3);
  assert.equal(result.data.storeCount, 2);
  assert.equal(result.data.subtotalJmdCents, 90000);
  assert.equal(repo.storeOrders.size, 2);
  assert.equal(repo.orderItems.size, 2);
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
