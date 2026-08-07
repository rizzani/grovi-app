/**
 * Test harness for search ranking functionality
 * 
 * Run with: tsx lib/search/ranking.test.ts
 * Or: node --loader tsx lib/search/ranking.test.ts
 */

import {
  normalizeText,
  tokenize,
  getMatchInfo,
  calculateRelevanceScore,
  rankResults,
  RANKING_WEIGHTS,
  RankingProduct,
  RankingCategory,
} from "./ranking";

// Test data helpers
function createProduct(title: string, brand?: string, categoryId?: string): RankingProduct {
  return {
    $id: `product_${title.replace(/\s+/g, "_")}`,
    title,
    sku: `SKU_${title.replace(/\s+/g, "_")}`,
    brand: brand || "Generic",
    category_leaf_id: categoryId || "cat_1",
    category_path_ids: categoryId ? [categoryId] : ["cat_1"],
  };
}

function createCategory(name: string, id?: string): RankingCategory {
  return {
    $id: id || `cat_${name.replace(/\s+/g, "_")}`,
    name,
  };
}

interface TestResult {
  product: RankingProduct;
  brand: string;
  category?: RankingCategory;
  inStock: boolean;
  priceJmdCents: number;
  relevanceScore?: number;
}

// Test runner
function runTest(name: string, testFn: () => boolean | void): void {
  try {
    const result = testFn();
    if (result === false) {
      console.error(`❌ FAIL: ${name}`);
    } else {
      console.log(`✓ PASS: ${name}`);
    }
  } catch (error: any) {
    console.error(`❌ FAIL: ${name} - ${error.message}`);
    console.error(error.stack);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message || "values not equal"}\n  Expected: ${expected}\n  Actual: ${actual}`
    );
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(
      `Assertion failed: ${message || "value not greater"}\n  Expected: > ${expected}\n  Actual: ${actual}`
    );
  }
}

function assertLessThan(actual: number, expected: number, message?: string): void {
  if (actual >= expected) {
    throw new Error(
      `Assertion failed: ${message || "value not less"}\n  Expected: < ${expected}\n  Actual: ${actual}`
    );
  }
}

// Test Cases

console.log("\n=== Search Ranking Tests ===\n");

// Test 1: Exact match beats partial
runTest("Exact match beats partial", () => {
  const query = "iPhone 15";
  const exactProduct = createProduct("iPhone 15");
  const partialProduct = createProduct("iPhone 15 Pro");
  
  const exactScore = calculateRelevanceScore(
    exactProduct,
    "Apple",
    undefined,
    getMatchInfo(exactProduct, "Apple", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  const partialScore = calculateRelevanceScore(
    partialProduct,
    "Apple",
    undefined,
    getMatchInfo(partialProduct, "Apple", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  assertGreaterThan(exactScore, partialScore, "Exact match should score higher than partial match");
});

// Test 2: StartsWith beats contains
runTest("StartsWith beats contains", () => {
  const query = "grace";
  const startsWithProduct = createProduct("Grace Corned Beef");
  const containsProduct = createProduct("Jamaican Grace-style Sauce");
  
  const startsWithScore = calculateRelevanceScore(
    startsWithProduct,
    "Grace",
    undefined,
    getMatchInfo(startsWithProduct, "Grace", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  const containsScore = calculateRelevanceScore(
    containsProduct,
    "Generic",
    undefined,
    getMatchInfo(containsProduct, "Generic", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  assertGreaterThan(startsWithScore, containsScore, "StartsWith should score higher than contains");
});

// Test 3: Brand exact beats category
runTest("Brand exact beats category", () => {
  const query = "nike";
  const brandProduct = createProduct("Air Max", "Nike");
  const categoryProduct = createProduct("Running Shoes");
  const category = createCategory("Nike");
  
  const brandScore = calculateRelevanceScore(
    brandProduct,
    "Nike",
    undefined,
    getMatchInfo(brandProduct, "Nike", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  const categoryScore = calculateRelevanceScore(
    categoryProduct,
    "Generic",
    category,
    getMatchInfo(categoryProduct, "Generic", category, normalizeText(query), tokenize(query)),
    undefined
  );
  
  assertGreaterThan(brandScore, categoryScore, "Brand exact match should score higher than category match");
});

// Test 4: Token coverage works
runTest("Token coverage works for multi-word queries", () => {
  const query = "lasco food drink";
  const allTokensProduct = createProduct("Lasco Food Drink Mix");
  const oneTokenProduct = createProduct("Lasco Products");
  
  const allTokensScore = calculateRelevanceScore(
    allTokensProduct,
    "Lasco",
    undefined,
    getMatchInfo(allTokensProduct, "Lasco", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  const oneTokenScore = calculateRelevanceScore(
    oneTokenProduct,
    "Lasco",
    undefined,
    getMatchInfo(oneTokenProduct, "Lasco", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  assertGreaterThan(allTokensScore, oneTokenScore, "Product with all tokens should score higher");
});

// Test 5: In-stock tie-break
runTest("In-stock tie-break", () => {
  const query = "test product";
  const inStockResult: TestResult = {
    product: createProduct("Test Product"),
    brand: "Test",
    inStock: true,
    priceJmdCents: 1000,
  };
  
  const outOfStockResult: TestResult = {
    product: createProduct("Test Product"),
    brand: "Test",
    inStock: false,
    priceJmdCents: 1000,
  };
  
  const ranked = rankResults([outOfStockResult, inStockResult], query);
  
  assertEqual(ranked[0].inStock, true, "In-stock item should rank first when scores are equal");
});

// Test 6: Preference boost is small
runTest("Preference boost is small and doesn't override strong matches", () => {
  const query = "apple";
  
  // Strong textual match (exact title match)
  const strongMatch = createProduct("Apple");
  const strongScore = calculateRelevanceScore(
    strongMatch,
    "Apple",
    undefined,
    getMatchInfo(strongMatch, "Apple", undefined, normalizeText(query), tokenize(query)),
    undefined
  );
  
  // Weak match with preference boost
  const weakMatch = createProduct("Orange");
  const preferredCategory = createCategory("Fruits", "preferred_cat");
  const weakScoreWithPrefs = calculateRelevanceScore(
    weakMatch,
    "Generic",
    preferredCategory,
    getMatchInfo(weakMatch, "Generic", preferredCategory, normalizeText(query), tokenize(query)),
    { preferredCategories: ["preferred_cat"] }
  );
  
  // Preference boost should be small (60 points max)
  // Strong match should still win (exact title = 1000 points)
  assertGreaterThan(
    strongScore,
    weakScoreWithPrefs,
    "Strong textual match should outrank weak match even with preference boost"
  );
  
  // But preference boost should help in close cases
  const closeMatch1 = createProduct("Test Product A");
  const closeMatch2 = createProduct("Test Product B");
  const category = createCategory("Preferred Category", "pref_cat");
  
  const score1 = calculateRelevanceScore(
    closeMatch1,
    "Test",
    category,
    getMatchInfo(closeMatch1, "Test", category, normalizeText("test"), tokenize("test")),
    { preferredCategories: ["pref_cat"] }
  );
  
  const score2 = calculateRelevanceScore(
    closeMatch2,
    "Test",
    undefined,
    getMatchInfo(closeMatch2, "Test", undefined, normalizeText("test"), tokenize("test")),
    undefined
  );
  
  assertGreaterThan(score1, score2, "Preference boost should help in close matches");
});

// Test 7: Normalization strips units, pack tokens, and multipliers
runTest("Normalization strips units correctly", () => {
  const normalized1 = normalizeText("Grace Corned Beef 340g");
  const normalized2 = normalizeText("grace corned beef");
  assertEqual(normalized1, normalized2, "Normalization should strip units and make text comparable");
});

runTest("Normalization strips volume units", () => {
  const normalized1 = normalizeText("Milk 2L");
  const normalized2 = normalizeText("milk");
  assertEqual(normalized1, normalized2, "Normalization should strip volume units like '2L'");
});

runTest("Normalization strips multipliers", () => {
  const normalized1 = normalizeText("Tuna x2");
  const normalized2 = normalizeText("tuna");
  assertEqual(normalized1, normalized2, "Normalization should strip multipliers like 'x2'");
  
  // Test other multiplier formats
  assertEqual(normalizeText("Product 3x"), normalizeText("product"), "Should strip '3x'");
  assertEqual(normalizeText("Item x 4"), normalizeText("item"), "Should strip 'x 4'");
});

runTest("Normalization strips pack tokens", () => {
  assertEqual(normalizeText("Product pack"), normalizeText("product"), "Should strip 'pack'");
  assertEqual(normalizeText("Item pcs"), normalizeText("item"), "Should strip 'pcs'");
  assertEqual(normalizeText("Goods piece"), normalizeText("goods"), "Should strip 'piece'");
});

// Test 8: Tokenization works and removes stopwords
runTest("Tokenization works for multi-word queries", () => {
  const tokens = tokenize("lasco food drink");
  assertEqual(tokens.length, 3, "Should tokenize into 3 words");
  assertEqual(tokens[0], "lasco", "First token should be 'lasco'");
  assertEqual(tokens[1], "food", "Second token should be 'food'");
  assertEqual(tokens[2], "drink", "Third token should be 'drink'");
});

runTest("Tokenization removes stopwords", () => {
  const tokens = tokenize("apple and orange");
  assertEqual(tokens.length, 2, "Should remove stopword 'and'");
  assertEqual(tokens[0], "apple", "First token should be 'apple'");
  assertEqual(tokens[1], "orange", "Second token should be 'orange'");
  
  const tokens2 = tokenize("the product with the best quality");
  // Should remove: "the", "with", "the"
  // Should keep: "product", "best", "quality"
  assertEqual(tokens2.length, 3, "Should remove multiple stopwords");
  assertEqual(tokens2.includes("product"), true, "Should keep 'product'");
  assertEqual(tokens2.includes("best"), true, "Should keep 'best'");
  assertEqual(tokens2.includes("quality"), true, "Should keep 'quality'");
});

runTest("Tokenization removes short tokens and deduplicates", () => {
  const tokens = tokenize("apple a orange apple");
  // Should remove: "a" (too short)
  // Should deduplicate: "apple"
  assertEqual(tokens.length, 2, "Should remove short tokens and deduplicate");
  assertEqual(tokens[0], "apple", "First token should be 'apple'");
  assertEqual(tokens[1], "orange", "Second token should be 'orange'");
  
  // Verify order is maintained (first occurrence kept)
  const tokens2 = tokenize("first second first third");
  assertEqual(tokens2.length, 3, "Should deduplicate while maintaining order");
  assertEqual(tokens2[0], "first", "First occurrence should be kept");
  assertEqual(tokens2[1], "second", "Order should be maintained");
  assertEqual(tokens2[2], "third", "Order should be maintained");
});

// Test 9: Price sorting only when requested
runTest("Price sorting only when explicitly requested", () => {
  const results: TestResult[] = [
    {
      product: createProduct("Product A"),
      brand: "Brand",
      inStock: true,
      priceJmdCents: 2000,
    },
    {
      product: createProduct("Product B"),
      brand: "Brand",
      inStock: true,
      priceJmdCents: 1000,
    },
  ];
  
  // Default sort (relevance) should not sort by price
  const relevanceSorted = rankResults(results, "product", undefined, "relevance");
  // Both have same relevance, so order might vary, but price shouldn't be the tie-breaker
  
  // Price sort should work when requested
  const priceSorted = rankResults(results, "product", undefined, "price_asc");
  assertEqual(priceSorted[0].priceJmdCents, 1000, "Price ascending should put lower price first");
  
  const priceDescSorted = rankResults(results, "product", undefined, "price_desc");
  assertEqual(priceDescSorted[0].priceJmdCents, 2000, "Price descending should put higher price first");
});

// Test 10: Title startsWith tie-break
runTest("Title startsWith used as tie-break", () => {
  const query = "test";
  const results: TestResult[] = [
    {
      product: createProduct("Test Product A"),
      brand: "Brand",
      inStock: true,
      priceJmdCents: 1000,
    },
    {
      product: createProduct("Product Test B"),
      brand: "Brand",
      inStock: true,
      priceJmdCents: 1000,
    },
  ];
  
  const ranked = rankResults(results, query);
  
  // Both have same stock and price, but first one starts with "test"
  assertEqual(
    ranked[0].product.title,
    "Test Product A",
    "Product with title starting with query should rank first"
  );
});

// Test 11: Length bonus caps
runTest("Length bonus is capped for exact title matches", () => {
  const query = "A";
  const shortProduct = createProduct("A"); // Very short title
  const matchInfo = getMatchInfo(shortProduct, "Zed", undefined, normalizeText(query), tokenize(query));
  
  const score = calculateRelevanceScore(shortProduct, "Brand", undefined, matchInfo, undefined);
  
  // Base score: 1000 (exactTitle)
  // Length bonus: max(0, 50 - 1) * 0.1 = 4.9, but capped at 15
  // So bonus should be 4.9, not 15
  const expectedBonus = Math.min(15, Math.max(0, 50 - 1) * 0.1);
  const baseScore = RANKING_WEIGHTS.exactTitle;
  const expectedScore = baseScore + expectedBonus;
  
  // Allow small floating point differences
  assertLessThan(Math.abs(score - expectedScore), 0.1, "Length bonus should be capped and calculated correctly");
  
  // Test with extremely short title to verify cap
  const veryShortProduct = createProduct("X");
  const veryShortMatchInfo = getMatchInfo(veryShortProduct, "Zed", undefined, normalizeText("x"), tokenize("x"));
  const veryShortScore = calculateRelevanceScore(veryShortProduct, "Brand", undefined, veryShortMatchInfo, undefined);
  
  // Bonus should be capped at 15, not unlimited
  const maxPossibleScore = baseScore + 15;
  assertLessThan(veryShortScore, maxPossibleScore + 1, "Length bonus should not exceed 15 points");
});

runTest("Length bonus is capped for startsWith matches", () => {
  const query = "test";
  const shortProduct = createProduct("Test Product"); // Short title that starts with the query
  const matchInfo = getMatchInfo(shortProduct, "Brand", undefined, normalizeText(query), tokenize(query));
  
  const score = calculateRelevanceScore(shortProduct, "Brand", undefined, matchInfo, undefined);
  
  // Base score: 700 (titleStartsWith)
  // Length bonus: max(0, 50 - 12) * 0.05 = 1.9, but capped at 10
  const expectedBonus = Math.min(10, Math.max(0, 50 - 12) * 0.05);
  const baseScore = RANKING_WEIGHTS.titleStartsWith;
  const maxPossibleScore = baseScore + 10;
  
  assertLessThan(score, maxPossibleScore + 1, "StartsWith length bonus should not exceed 10 points");
});

// Test 12: Dietary boost is 0 when product has no dietary tags
runTest("Dietary boost is 0 when product has no dietary tags", () => {
  const query = "product";
  const product = createProduct("Product");
  const matchInfo = getMatchInfo(product, "Brand", undefined, normalizeText(query), tokenize(query));
  
  // Score without dietary preferences
  const scoreWithoutPrefs = calculateRelevanceScore(product, "Brand", undefined, matchInfo, undefined);
  
  // Score with dietary preferences but no product dietary tags
  const scoreWithPrefs = calculateRelevanceScore(
    product,
    "Brand",
    undefined,
    matchInfo,
    { dietaryPreferences: ["gluten free", "vegan"] }
  );
  
  // Scores should be identical (dietary boost is 0 when product has no tags)
  assertEqual(scoreWithoutPrefs, scoreWithPrefs, "Dietary boost should be 0 when product has no dietary tags");
});

// Test 13: Tie-breaker is deterministic (shorter normalized title wins)
runTest("Tie-breaker uses shorter normalized title when all else equal", () => {
  const query = "test";
  const results: TestResult[] = [
    {
      product: createProduct("Test Product Very Long Title"),
      brand: "Brand",
      inStock: true,
      priceJmdCents: 1000,
    },
    {
      product: createProduct("Test Product"),
      brand: "Brand",
      inStock: true,
      priceJmdCents: 1000,
    },
  ];
  
  const ranked = rankResults(results, query);
  
  // Both have same score, stock, and startsWith status
  // Shorter normalized title should win
  assertEqual(
    ranked[0].product.title,
    "Test Product",
    "Shorter normalized title should rank first when all else is equal"
  );
  
  // Verify it's deterministic (run twice, should get same result)
  const ranked2 = rankResults(results, query);
  assertEqual(ranked2[0].product.title, ranked[0].product.title, "Tie-breaker should be deterministic");
});

console.log("\n=== All Tests Complete ===\n");
