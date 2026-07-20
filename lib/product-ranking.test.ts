import assert from "node:assert/strict";
import test from "node:test";
import { HOME_FEED_CONFIG } from "./home-feed-config";
import {
  isActiveDeal, isActiveFeatured, popularityScore, preferLocalWithFallback,
  rankNewProducts, rankPopular, visibleSection,
} from "./product-ranking";
import type { SearchResult } from "./search-service";

const now = new Date("2026-07-20T12:00:00.000Z");
function item(id: string, overrides: Partial<SearchResult["product"]> = {}, inStock = true): SearchResult {
  return {
    product: { $id: id, title: id, sku: id, category_leaf_id: "cat", category_path_ids: ["cat"],
      isActive: true, $createdAt: "2026-07-01T00:00:00.000Z", ...overrides },
    brand: "", storeLocation: { $id: `store-${id}`, name: "Store", display_name: "Store", is_active: true, brand_id: "brand", slug: "store" },
    priceJmdCents: 1000, inStock, sku: id,
  };
}

test("orders have more weight than views", () => {
  assert.ok(popularityScore(item("order", { orderCount: 1 }), false) >
    popularityScore(item("views", { viewCount: 5 }), false));
});
test("out-of-stock products are excluded", () => {
  assert.deepEqual(rankPopular([item("off", {}, false)]).items, []);
});
test("expired featured products are excluded", () => {
  assert.equal(isActiveFeatured(item("old", { isFeatured: true, featuredEndAt: "2026-07-19T00:00:00Z" }), now), false);
});
test("active deals are detected correctly", () => {
  assert.equal(isActiveDeal({ ...item("deal", { salePrice: 700 }), priceJmdCents: 1000 }, now), true);
  assert.equal(isActiveDeal({ ...item("fake", { salePrice: 1100 }), priceJmdCents: 1000 }, now), false);
});
test("new products are sorted by creation date", () => {
  const ranked = rankNewProducts([
    item("older", { $createdAt: "2026-07-01T00:00:00Z" }),
    item("newer", { $createdAt: "2026-07-19T00:00:00Z" }),
    item("third", { $createdAt: "2026-06-01T00:00:00Z" }),
    item("fourth", { $createdAt: "2026-05-01T00:00:00Z" }),
  ], now);
  assert.equal(ranked[0].product.$id, "newer");
});
test("manual ranking is dominant during cold start", () => {
  const ranked = rankPopular([item("manual", { manualPopularityScore: 5 }), item("engaged", { orderCount: 2 })]);
  assert.equal(ranked.coldStart, true); assert.equal(ranked.items[0].product.$id, "manual");
});
test("real engagement becomes dominant after the threshold", () => {
  const ranked = rankPopular([item("manual", { manualPopularityScore: 20 }),
    item("engaged", { orderCount: HOME_FEED_CONFIG.minRealActivity })]);
  assert.equal(ranked.coldStart, false); assert.equal(ranked.items[0].product.$id, "engaged");
});
test("local products are preferred when location data exists", () => {
  const local = ["1", "2", "3", "4"].map((id) => item(id));
  assert.deepEqual(preferLocalWithFallback(local, [item("5")]).map((x) => x.product.$id), ["1", "2", "3", "4"]);
});
test("fallback products are returned when local data is insufficient", () => {
  assert.deepEqual(preferLocalWithFallback([item("1")], [item("1"), item("2"), item("3"), item("4")]).map((x) => x.product.$id), ["1", "2", "3", "4"]);
});
test("sections are hidden below the minimum item count", () => {
  assert.deepEqual(visibleSection([item("1"), item("2"), item("3")]), []);
});
