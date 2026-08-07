/**
 * Search Ranking Module
 * 
 * Provides deterministic, configurable relevance ranking for product search results.
 * Supports multi-word queries, user preferences, configurable weights, typo tolerance,
 * and Jamaican naming variations.
 */

import { normalizeJamaicanTerms } from "./jamaican-terms";
import { fuzzyMatchScore as calculateFuzzyScore, similarityRatio, FUZZY_MATCH_CONFIG } from "./fuzzy-match";

// Minimal type definitions to avoid circular dependency
// These match the types from search-service.ts
export interface RankingProduct {
  $id: string;
  title: string;
  sku: string;
  brand?: string;
  category_leaf_id: string;
  category_path_ids: string[];
}

export interface RankingCategory {
  $id: string;
  name: string;
}

/**
 * Ranking weights configuration
 * 
 * Adjust these values to tune ranking behavior:
 * - Higher values = higher priority
 * - Keep relative differences meaningful (e.g., exact matches should be significantly higher)
 * 
 * Note: Priority is enforced via weights; ordering reflects intended outcomes given default weights.
 * The actual ranking order depends on the computed scores, which combine multiple match types.
 * 
 * Default weight ordering (intended outcomes):
 * 1. Exact title match (1000)
 * 2. Title starts with query (700)
 * 3. Title contains query (450)
 * 4. Token coverage in title (up to 300, proportional)
 * 5. Brand exact match (350)
 * 6. Brand starts with query (250)
 * 7. Brand contains query (150)
 * 8. Category exact match (200)
 * 9. Category contains query (100)
 * 10. User preference boosts (60 for category, 40 for dietary)
 */
export const RANKING_WEIGHTS = {
  exactTitle: 1000,
  titleStartsWith: 700,
  titleContains: 450,
  tokenCoverageTitleMax: 300, // Computed proportionally based on token matches
  brandExact: 350,
  brandStartsWith: 250,
  brandContains: 150,
  categoryExact: 200,
  categoryContains: 100,
  frequentlySearched: 0, // Placeholder for future analytics
  preferenceCategoryBoost: 60, // Small boost if product category is in user preferred categories
  preferenceDietaryBoost: 40, // Small boost if product matches dietary preference tags
  fuzzyMatch: 200, // Score for fuzzy matches (typo tolerance) - lower than exact but still significant
} as const;

/**
 * Match information for a product
 */
export interface MatchInfo {
  exactTitle: boolean;
  titleStartsWith: boolean;
  titleContains: boolean;
  tokensMatched: number; // Number of query tokens found in title
  tokensTotal: number; // Total number of query tokens
  brandExact: boolean;
  brandStartsWith: boolean;
  brandContains: boolean;
  categoryExact: boolean;
  categoryContains: boolean;
  titleStartsWithQuery: boolean; // For tie-breaking
  fuzzyMatchScore: number; // Fuzzy matching score (0-1) for typo tolerance
  fuzzyMatch: boolean; // Whether this is a fuzzy match (typo-tolerant)
}

/**
 * User preferences for ranking (optional, non-breaking)
 */
export interface RankingUserPrefs {
  preferredCategories?: string[]; // Category IDs or names
  dietaryPreferences?: string[]; // Dietary preference tags
}

/**
 * Normalize text for comparison
 * 
 * Steps:
 * 1. Lowercase
 * 2. Trim
 * 3. Collapse multiple spaces
 * 4. Remove punctuation/special characters
 * 5. Strip unit/size tokens (numbers with units, pack indicators, multipliers)
 * 6. Normalize Jamaican terms (apply corrections and canonical forms)
 * 
 * Examples:
 * - "Grace Corned Beef 340g" -> "grace corned beef"
 * - "Milk 2L" -> "milk"
 * - "Tuna x2" -> "tuna"
 * - "corn beef" -> "corned beef" (Jamaican term correction)
 * - "graece" -> "grace" (typo correction)
 * 
 * @param input - Text to normalize
 * @returns Normalized text
 */
export function normalizeText(input: string): string {
  if (!input) return "";
  
  // Step 1: Lowercase and trim
  let normalized = input
    .toLowerCase()
    .trim();
  
  // Step 2: Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ");
  
  // Step 3: Remove punctuation and special characters (keep alphanumeric and spaces)
  normalized = normalized.replace(/[^\w\s]/g, "");
  
  // Step 4: Strip unit/size tokens
  // Pattern 4a: Numbers with units (e.g., "340g", "2.5kg", "500ml", "1L")
  // Matches: optional decimal number followed by unit
  const numberWithUnitPattern = /\b(\d+(\.\d+)?)\s*(g|kg|ml|l|oz|lb|litre|liter|gal|gallon)\b/gi;
  normalized = normalized.replace(numberWithUnitPattern, "");
  
  // Pattern 4b: Standalone pack/count tokens (e.g., "pack", "pcs", "piece", "pk", "ct")
  // Matches: standalone words for pack indicators
  const packTokenPattern = /\b(pack|pcs|piece|pieces|pk|ct|count)\b/gi;
  normalized = normalized.replace(packTokenPattern, "");
  
  // Pattern 4c: Multipliers (e.g., "x2", "2x", "x 3", "3 x")
  // Matches: "x" followed by number, or number followed by "x"
  const multiplierPattern = /\b(x\s*\d+|\d+\s*x)\b/gi;
  normalized = normalized.replace(multiplierPattern, "");
  
  // Step 5: Normalize Jamaican terms (apply corrections and canonical forms)
  normalized = normalizeJamaicanTerms(normalized);
  
  // Step 6: Clean up any double spaces left after removal
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

/**
 * Tokenize a query into individual words
 * 
 * Steps:
 * 1. Normalize the input (reuse normalizeText)
 * 2. Split into tokens
 * 3. Remove stopwords: ["and", "or", "the", "of", "with"]
 * 4. Remove tokens shorter than 2 characters
 * 5. De-duplicate tokens (maintain original order)
 * 
 * @param input - Query string
 * @returns Array of normalized, filtered, deduplicated tokens in stable order
 */
export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  
  // Step 1: Split into tokens
  const tokens = normalized.split(/\s+/).filter(token => token.length > 0);
  
  // Step 2: Remove stopwords and short tokens
  const stopwords = new Set(["and", "or", "the", "of", "with"]);
  const filtered: string[] = [];
  const seen = new Set<string>();
  
  // Maintain original order while filtering and deduplicating
  for (const token of tokens) {
    // Skip stopwords
    if (stopwords.has(token)) continue;
    
    // Skip tokens shorter than 2 characters
    if (token.length < 2) continue;
    
    // De-duplicate (keep first occurrence)
    if (!seen.has(token)) {
      seen.add(token);
      filtered.push(token);
    }
  }
  
  return filtered;
}

/**
 * Get match information for a product against a query
 * Includes fuzzy matching for typo tolerance
 * 
 * @param product - Product to analyze
 * @param brand - Brand name (normalized)
 * @param category - Category (optional)
 * @param queryNormalized - Normalized query string
 * @param queryTokens - Tokenized query
 * @returns Match information including fuzzy match scores
 */
export function getMatchInfo(
  product: RankingProduct,
  brand: string,
  category: RankingCategory | undefined,
  queryNormalized: string,
  queryTokens: string[]
): MatchInfo {
  const productTitleNormalized = normalizeText(product.title);
  const brandNormalized = brand ? normalizeText(brand) : "";
  const categoryNameNormalized = category ? normalizeText(category.name) : "";
  
  // Title matches (exact matches first)
  const exactTitle = productTitleNormalized === queryNormalized;
  const titleStartsWith = !exactTitle && productTitleNormalized.startsWith(queryNormalized);
  const titleContains = !exactTitle && !titleStartsWith && productTitleNormalized.includes(queryNormalized);
  
  // Fuzzy matching for typo tolerance (only if no exact match found)
  let fuzzyMatchScore = 0.0;
  let fuzzyMatch = false;
  
  if (!exactTitle && !titleStartsWith && !titleContains) {
    // Calculate fuzzy match score for the entire query
    const titleFuzzyScore = calculateFuzzyScore(product.title, queryNormalized);
    
    // Only consider it a fuzzy match if similarity is above threshold
    if (titleFuzzyScore >= FUZZY_MATCH_CONFIG.similarityThreshold) {
      fuzzyMatchScore = titleFuzzyScore;
      fuzzyMatch = true;
    }
  }
  
  // Token coverage in title (including fuzzy token matching)
  let tokensMatched = 0;
  if (queryTokens.length > 0) {
    tokensMatched = queryTokens.filter(token => {
      // Check exact match first
      if (productTitleNormalized.includes(token)) {
        return true;
      }
      // Check fuzzy match for tokens
      const tokenScore = calculateFuzzyScore(product.title, token);
      return tokenScore >= FUZZY_MATCH_CONFIG.similarityThreshold;
    }).length;
  }
  
  // Brand matches (including fuzzy matching if no exact match)
  const brandExact = brandNormalized === queryNormalized;
  let brandStartsWith = !brandExact && brandNormalized.startsWith(queryNormalized);
  let brandContains = !brandExact && !brandStartsWith && brandNormalized.includes(queryNormalized);
  
  // Apply fuzzy matching to brand if no exact match found
  if (!brandExact && !brandStartsWith && !brandContains && brandNormalized) {
    const brandFuzzyScore = calculateFuzzyScore(brand, queryNormalized);
    if (brandFuzzyScore >= FUZZY_MATCH_CONFIG.similarityThreshold) {
      // Treat fuzzy brand match as "contains" level match
      brandContains = true;
    }
  }
  
  // Category matches (including fuzzy matching if no exact match)
  const categoryExact = categoryNameNormalized === queryNormalized;
  let categoryContains = !categoryExact && categoryNameNormalized.includes(queryNormalized);
  
  // Apply fuzzy matching to category if no exact match found
  if (!categoryExact && !categoryContains && categoryNameNormalized) {
    const categoryFuzzyScore = category
      ? calculateFuzzyScore(category.name, queryNormalized)
      : 0;
    if (categoryFuzzyScore >= FUZZY_MATCH_CONFIG.similarityThreshold) {
      categoryContains = true;
    }
  }
  
  return {
    exactTitle,
    titleStartsWith,
    titleContains,
    tokensMatched,
    tokensTotal: queryTokens.length,
    brandExact,
    brandStartsWith,
    brandContains,
    categoryExact,
    categoryContains,
    titleStartsWithQuery: titleStartsWith || exactTitle,
    fuzzyMatchScore,
    fuzzyMatch,
  };
}

/**
 * Calculate relevance score for a product
 * 
 * @param product - Product to score
 * @param brand - Brand name
 * @param category - Category (optional)
 * @param matchInfo - Match information
 * @param userPrefs - User preferences (optional)
 * @returns Relevance score (higher = more relevant)
 */
export function calculateRelevanceScore(
  product: RankingProduct,
  brand: string,
  category: RankingCategory | undefined,
  matchInfo: MatchInfo,
  userPrefs?: RankingUserPrefs
): number {
  let score = 0;
  
  // Title matches (mutually exclusive, highest priority first)
  if (matchInfo.exactTitle) {
    score += RANKING_WEIGHTS.exactTitle;
    
    // Bonus for shorter product names (more specific matches)
    // Capped at 15 points to avoid short titles overpowering base weights
    const lengthBonus = Math.min(15, Math.max(0, 50 - product.title.length) * 0.1);
    score += lengthBonus;
  } else if (matchInfo.titleStartsWith) {
    score += RANKING_WEIGHTS.titleStartsWith;
    
    // Bonus for shorter product names
    // Capped at 10 points to avoid short titles overpowering base weights
    const lengthBonus = Math.min(10, Math.max(0, 50 - product.title.length) * 0.05);
    score += lengthBonus;
  } else if (matchInfo.titleContains) {
    score += RANKING_WEIGHTS.titleContains;
  } else if (matchInfo.fuzzyMatch) {
    // Fuzzy match (typo tolerance) - apply weighted score based on similarity
    // Higher similarity = higher score, but still lower than exact matches
    const fuzzyScore = RANKING_WEIGHTS.fuzzyMatch * matchInfo.fuzzyMatchScore;
    score += fuzzyScore;
  }
  
  // Token coverage (for multi-word queries)
  if (matchInfo.tokensTotal > 1 && matchInfo.tokensMatched > 0) {
    const tokenCoverageRatio = matchInfo.tokensMatched / matchInfo.tokensTotal;
    const tokenScore = RANKING_WEIGHTS.tokenCoverageTitleMax * tokenCoverageRatio;
    score += tokenScore;
  }
  
  // Brand matches (can stack with title matches)
  if (matchInfo.brandExact) {
    score += RANKING_WEIGHTS.brandExact;
  } else if (matchInfo.brandStartsWith) {
    score += RANKING_WEIGHTS.brandStartsWith;
  } else if (matchInfo.brandContains) {
    score += RANKING_WEIGHTS.brandContains;
  }
  
  // Category matches (can stack with other matches)
  if (matchInfo.categoryExact) {
    score += RANKING_WEIGHTS.categoryExact;
  } else if (matchInfo.categoryContains) {
    score += RANKING_WEIGHTS.categoryContains;
  }
  
  // User preference boosts (small, non-overriding)
  if (userPrefs) {
    // Category preference boost
    if (userPrefs.preferredCategories && category) {
      const categoryIdMatch = userPrefs.preferredCategories.includes(category.$id);
      const categoryNameMatch = userPrefs.preferredCategories.some(pref => 
        normalizeText(pref) === normalizeText(category.name)
      );
      
      if (categoryIdMatch || categoryNameMatch) {
        score += RANKING_WEIGHTS.preferenceCategoryBoost;
      }
    }
    
    // Dietary preference boost
    // IMPORTANT: Dietary boost is a no-op until product dietary tags exist.
    // Only apply boost if product actually has dietary tags/flags.
    // Do NOT add fake fields or apply boost without product dietary data.
    // 
    // When dietary tags are added to products in the future, uncomment and use:
    // if (userPrefs.dietaryPreferences && product.dietaryTags && product.dietaryTags.length > 0) {
    //   const hasMatchingDietary = userPrefs.dietaryPreferences.some(pref =>
    //     product.dietaryTags?.some(tag => normalizeText(tag) === normalizeText(pref))
    //   );
    //   if (hasMatchingDietary) {
    //     score += RANKING_WEIGHTS.preferenceDietaryBoost;
    //   }
    // }
    // 
    // For now, dietary boost is 0 (product has no dietary tags in schema)
  }
  
  // Frequently searched (placeholder for future analytics)
  // if (isFrequentlySearched(product.$id)) {
  //   score += RANKING_WEIGHTS.frequentlySearched;
  // }
  
  return score;
}

/**
 * Sort mode for results
 * 
 * Available sort options:
 * - relevance: Sort by search relevance score (default)
 * - price_asc: Sort by price (low to high)
 * - price_desc: Sort by price (high to low)
 * - rating_desc: Sort by customer rating (high to low) - requires rating field
 * - review_count_desc: Sort by review count (high to low) - requires review_count field
 * - delivery_time_asc: Sort by delivery time (fastest first) - requires delivery_time field
 * - distance_asc: Sort by distance from delivery location (nearest first) - requires location coordinates
 */
export type SortMode = 
  | "relevance" 
  | "price_asc" 
  | "price_desc"
  | "rating_desc"
  | "review_count_desc"
  | "delivery_time_asc"
  | "distance_asc";

/**
 * Rank and sort search results
 * 
 * @param results - Search results to rank
 * @param query - Original search query
 * @param userPrefs - User preferences (optional)
 * @param sortMode - Sort mode (default: "relevance")
 * @returns Ranked and sorted results
 */
export function rankResults<T extends {
  product: RankingProduct & {
    rating?: number; // Optional: average customer rating (0-5)
    review_count?: number; // Optional: number of reviews
  };
  brand: string;
  category?: RankingCategory;
  inStock: boolean;
  priceJmdCents: number;
  storeLocation?: {
    delivery_time_minutes?: number; // Optional: estimated delivery time in minutes
    latitude?: number; // Optional: store latitude
    longitude?: number; // Optional: store longitude
  };
  deliveryAddress?: {
    latitude?: number; // Optional: delivery address latitude
    longitude?: number; // Optional: delivery address longitude
  };
  relevanceScore?: number;
}>(
  results: T[],
  query: string,
  userPrefs?: RankingUserPrefs,
  sortMode: SortMode = "relevance"
): T[] {
  if (results.length === 0) return results;
  
  const queryNormalized = normalizeText(query);
  const queryTokens = tokenize(query);
  
  // Calculate relevance scores
  const scoredResults = results.map(result => {
    const matchInfo = getMatchInfo(
      result.product,
      result.brand,
      result.category,
      queryNormalized,
      queryTokens
    );
    
    const relevanceScore = calculateRelevanceScore(
      result.product,
      result.brand,
      result.category,
      matchInfo,
      userPrefs
    );
    
    // Calculate distance if coordinates are available
    let distanceKm: number | undefined;
    if (
      result.storeLocation?.latitude !== undefined &&
      result.storeLocation?.longitude !== undefined &&
      result.deliveryAddress?.latitude !== undefined &&
      result.deliveryAddress?.longitude !== undefined
    ) {
      distanceKm = calculateDistance(
        result.storeLocation.latitude,
        result.storeLocation.longitude,
        result.deliveryAddress.latitude,
        result.deliveryAddress.longitude
      );
    }
    
    return {
      ...result,
      relevanceScore,
      _matchInfo: matchInfo, // Internal use only
      _distanceKm: distanceKm, // Internal use only
    };
  });
  
  // Sort results
  scoredResults.sort((a, b) => {
    // Primary sort based on sort mode
    if (sortMode === "relevance") {
      const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      
      // Secondary sort: in-stock items first
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      
      // Tertiary sort: title starts with query first
      if (a._matchInfo.titleStartsWithQuery && !b._matchInfo.titleStartsWithQuery) return -1;
      if (!a._matchInfo.titleStartsWithQuery && b._matchInfo.titleStartsWithQuery) return 1;
      
      // Quaternary sort: shorter normalized title first (deterministic tie-breaker)
      // This ensures consistent ordering when all other factors are equal
      const aTitleNormalized = normalizeText(a.product.title);
      const bTitleNormalized = normalizeText(b.product.title);
      const lengthDiff = aTitleNormalized.length - bTitleNormalized.length;
      if (lengthDiff !== 0) {
        return lengthDiff;
      }
      
      // No price tie-break by default (price sorting only when explicitly requested)
      return 0;
    }
    
    // Price sorting
    if (sortMode === "price_asc") {
      // In-stock items first, then sort by price
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return a.priceJmdCents - b.priceJmdCents;
    }
    if (sortMode === "price_desc") {
      // In-stock items first, then sort by price
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return b.priceJmdCents - a.priceJmdCents;
    }
    
    // Rating sorting (descending - highest rated first)
    if (sortMode === "rating_desc") {
      const aRating = a.product.rating ?? 0;
      const bRating = b.product.rating ?? 0;
      const ratingDiff = bRating - aRating;
      if (ratingDiff !== 0) return ratingDiff;
      
      // Tie-breaker: review count (more reviews = more reliable rating)
      const aReviews = a.product.review_count ?? 0;
      const bReviews = b.product.review_count ?? 0;
      const reviewDiff = bReviews - aReviews;
      if (reviewDiff !== 0) return reviewDiff;
      
      // Final tie-breaker: in-stock items first
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      
      return 0;
    }
    
    // Review count sorting (descending - most reviewed first)
    if (sortMode === "review_count_desc") {
      const aReviews = a.product.review_count ?? 0;
      const bReviews = b.product.review_count ?? 0;
      const reviewDiff = bReviews - aReviews;
      if (reviewDiff !== 0) return reviewDiff;
      
      // Tie-breaker: rating (higher rated first)
      const aRating = a.product.rating ?? 0;
      const bRating = b.product.rating ?? 0;
      const ratingDiff = bRating - aRating;
      if (ratingDiff !== 0) return ratingDiff;
      
      // Final tie-breaker: in-stock items first
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      
      return 0;
    }
    
    // Delivery time sorting (ascending - fastest delivery first)
    if (sortMode === "delivery_time_asc") {
      // Only sort in-stock items by delivery time (out of stock goes to end)
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      
      const aDeliveryTime = a.storeLocation?.delivery_time_minutes ?? Number.MAX_SAFE_INTEGER;
      const bDeliveryTime = b.storeLocation?.delivery_time_minutes ?? Number.MAX_SAFE_INTEGER;
      const timeDiff = aDeliveryTime - bDeliveryTime;
      if (timeDiff !== 0) return timeDiff;
      
      // Tie-breaker: price (lower price first)
      return a.priceJmdCents - b.priceJmdCents;
    }
    
    // Distance sorting (ascending - nearest first)
    if (sortMode === "distance_asc") {
      // Only sort in-stock items by distance (out of stock goes to end)
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      
      const aDistance = a._distanceKm ?? Number.MAX_SAFE_INTEGER;
      const bDistance = b._distanceKm ?? Number.MAX_SAFE_INTEGER;
      const distanceDiff = aDistance - bDistance;
      if (distanceDiff !== 0) return distanceDiff;
      
      // Tie-breaker: price (lower price first)
      return a.priceJmdCents - b.priceJmdCents;
    }
    
    return 0;
  });
  
  // Remove internal fields before returning
  return scoredResults.map(({ _matchInfo, _distanceKm, ...result }) => result as T);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
