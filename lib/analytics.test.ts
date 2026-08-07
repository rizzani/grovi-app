import assert from "node:assert/strict";
import test from "node:test";
import { removeUndefinedProperties, isSupportedAnalyticsEvent, resolveSessionId } from "./analytics-core";
import { summarizeAnalyticsEvents } from "./analytics-query-service";

test("analytics removes undefined properties", () => {
  assert.deepEqual(removeUndefinedProperties({ productId: "p1", missing: undefined, count: 0 }), { productId: "p1", count: 0 });
});

test("unsupported analytics events are rejected by the runtime guard", () => {
  assert.equal(isSupportedAnalyticsEvent("not_a_grovi_event"), false);
  assert.equal(isSupportedAnalyticsEvent("product_viewed"), true);
});

test("analytics session IDs are reused within the TTL and renewed after it", () => {
  const existing = JSON.stringify({ id: "session-1", createdAt: 100 });
  assert.deepEqual(resolveSessionId(existing, 500, () => "session-2", 1000), { id: "session-1", createdAt: 100, isNew: false });
  assert.deepEqual(resolveSessionId(existing, 1200, () => "session-2", 1000), { id: "session-2", createdAt: 1200, isNew: true });
});

test("analytics metrics summarize bounded event pages", () => {
  const event = (eventName: any, properties: object) => ({ $id: eventName, eventName, propertiesJson: JSON.stringify(properties), createdAt: "2026-01-01T00:00:00.000Z" });
  const metrics = summarizeAnalyticsEvents([
    event("checkout_started", {}), event("order_placed", { orderValue: 1200 }),
    event("product_viewed", { productId: "p1" }), event("product_viewed", { productId: "p1" }),
    event("product_added_to_cart", { productId: "p1" }), event("product_searched", { resultCount: 0 }),
  ]);
  assert.equal(metrics.checkoutCompletionRate, 1);
  assert.equal(metrics.averageOrderValue, 1200);
  assert.deepEqual(metrics.mostViewedProducts[0], { productId: "p1", count: 2 });
  assert.equal(metrics.zeroResultSearches, 1);
});
