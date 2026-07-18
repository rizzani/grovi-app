import { Query } from "appwrite";
import { databases, databaseId } from "./appwrite-client";
import { SearchSuggestion } from "../components/SearchBar";
import {
  rankResults,
  RankingUserPrefs,
  SortMode,
  normalizeText,
} from "./search/ranking";
import { UserPreferences } from "./preferences-service";
import { normalizeJamaicanTerms, expandQueryWithSynonyms } from "./search/jamaican-terms";
import { logSearchResults } from "./search-analytics-service";

/**
 * Core Search Backend Service
 * 
 * This service implements global product search across all active stores.
 * 
 * Requirements (based on actual database schema):
 * - products collection with 'title' field (full-text index exists: idx_title_fulltext)
 * - products collection with 'brand' string field (no separate brands collection)
 * - categories collection with 'name' field
 * - store_location collection with 'is_active' boolean field
 * - store_location_product collection (already exists)
 * 
 * Indexes:
 * - Full-text index on products.title (idx_title_fulltext) ✓
 * - Indexes on store_location_product: in_stock (recommended), store_location_id, brand_id, category_leaf_id
 */

// Collection IDs (matching actual database schema)
const STORE_LOCATION_PRODUCT_COLLECTION_ID = "store_location_product";
const PRODUCTS_COLLECTION_ID = "products";
const CATEGORIES_COLLECTION_ID = "categories";
const STORE_LOCATIONS_COLLECTION_ID = "store_location"; // Note: singular, not plural
const STORE_BRAND_COLLECTION_ID = "store_brand";

// Type definitions (matching actual database schema)
// Image object structure from Appwrite
export interface ProductImageObject {
  fileId: string;
  url: string;
}

export interface Product {
  $id: string;
  title: string; // Products use 'title' not 'name'
  sku: string;
  brand?: string; // Brand is a string field, not a reference
  description?: string;
  unit_size?: string; // Optional: e.g., "500g", "1L", "296 ml"
  package_quantity?: number; // Optional: e.g., 16 (units per package)
  net_weight?: string; // Optional: e.g., "500g"
  country_of_origin?: string; // Optional: country where product is from (future)
  primary_image_url?: string; // Primary image URL
  images?: ProductImageObject[] | string; // Array of image objects or JSON string
  category_leaf_id: string;
  category_path_ids: string[];
  rating?: number; // Optional: average customer rating (0-5) - for future use
  review_count?: number; // Optional: number of reviews - for future use
  createdAt?: string;
  updatedAt?: string;
}

export interface Brand {
  name: string; // Brand is just a string in products, not a separate collection
}

export interface Category {
  $id: string;
  name: string;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreLocation {
  $id: string;
  name: string;
  display_name: string;
  is_active: boolean; // Uses 'is_active' not 'active'
  brand_id: string;
  slug: string;
  parish?: string;
  address_line1?: string;
  address_line2?: string;
  phone?: string;
  priority?: number;
  delivery_time_minutes?: number; // Optional: estimated delivery time in minutes - for future use
  latitude?: number; // Optional: store latitude - for future use
  longitude?: number; // Optional: store longitude - for future use
  logo_url?: string; // Optional: store logo image URL
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreLocationProduct {
  $id: string;
  product_id: string;
  store_location_id: string;
  brand_id: string;
  category_leaf_id?: string;
  category_path_ids?: string[];
  in_stock: boolean;
  price_jmd_cents: number;
  source_key?: string;
  external_id?: string;
  external_url?: string;
  price_currency?: string;
  content_hash?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchResult {
  product: Product;
  brand: string; // Brand is just a string from product.brand
  category?: Category;
  storeLocation: StoreLocation;
  priceJmdCents: number;
  inStock: boolean;
  sku: string;
  relevanceScore?: number; // Optional relevance score for debugging
}

/**
 * Filter options for product search
 */
export interface ProductFilters {
  /** Filter by specific brand names */
  brands?: string[];
  /** Filter by category IDs */
  categoryIds?: string[];
  /** Minimum price in JMD cents */
  minPrice?: number;
  /** Maximum price in JMD cents */
  maxPrice?: number;
  /** Filter by availability (true = in stock only, false = all, undefined = in stock only) */
  inStock?: boolean;
  /** Filter stores by delivery address (parish) */
  deliveryParish?: string;
  /** Filter stores by specific store location IDs */
  storeLocationIds?: string[];
}

/**
 * Pagination options for search results
 */
export interface PaginationOptions {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Offset for cursor-based pagination (alternative to page) */
  offset?: number;
}

/**
 * Paginated search result wrapper
 */
export interface PaginatedSearchResults {
  /** Current page of results */
  results: SearchResult[];
  /** Total number of results before pagination */
  totalResults: number;
  /** Current page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Number of items per page */
  pageSize: number;
  /** Whether there are more results */
  hasMore: boolean;
}

// Ranking logic has been moved to lib/search/ranking.ts
// Import rankResults, RankingUserPrefs, and SortMode from there

/**
 * Convert UserPreferences to RankingUserPrefs format
 */
function convertUserPrefsToRankingPrefs(
  userPrefs: UserPreferences | null | undefined
): RankingUserPrefs | undefined {
  if (!userPrefs) return undefined;
  
  return {
    preferredCategories: userPrefs.categoryPreferences || [],
    dietaryPreferences: userPrefs.dietaryPreferences || [],
  };
}

/**
 * Get search suggestions based on query from Appwrite
 * Fetches real suggestions from products, categories, and brands
 * Includes typo tolerance and Jamaican term normalization
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = 10
): Promise<SearchSuggestion[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Normalize query with Jamaican terms for better matching
  const normalizedQuery = normalizeText(normalizeJamaicanTerms(query.toLowerCase().trim()));
  const suggestions: SearchSuggestion[] = [];

  try {
    // Fetch product suggestions (by title)
    try {
      const productsResponse = await databases.listDocuments(
        databaseId,
        PRODUCTS_COLLECTION_ID,
        [
          Query.search("title", normalizedQuery),
          Query.limit(Math.ceil(limit * 0.6)), // 60% products
        ]
      );

      productsResponse.documents.forEach((doc: any) => {
        suggestions.push({
          id: doc.$id,
          text: doc.title,
          type: "product",
        });
      });
    } catch (error: any) {
      console.warn("Error fetching product suggestions:", error.message);
    }

    // Fetch category suggestions (by name)
    try {
      const categoriesResponse = await databases.listDocuments(
        databaseId,
        CATEGORIES_COLLECTION_ID,
        [
          Query.limit(100), // Get all to filter in memory
        ]
      );

      const matchingCategories = categoriesResponse.documents
        .filter((doc: any) =>
          doc.name && doc.name.toLowerCase().includes(normalizedQuery)
        )
        .slice(0, Math.ceil(limit * 0.3)); // 30% categories

      matchingCategories.forEach((doc: any) => {
        suggestions.push({
          id: doc.$id,
          text: doc.name,
          type: "category",
        });
      });
    } catch (error: any) {
      console.warn("Error fetching category suggestions:", error.message);
    }

    // Fetch brand suggestions (from products)
    try {
      const productsForBrands = await databases.listDocuments(
        databaseId,
        PRODUCTS_COLLECTION_ID,
        [
          Query.contains("brand", normalizedQuery),
          Query.limit(50), // Get more to extract unique brands
        ]
      );

      const brandSet = new Set<string>();
      productsForBrands.documents.forEach((doc: any) => {
        if (doc.brand && doc.brand.toLowerCase().includes(normalizedQuery)) {
          brandSet.add(doc.brand);
        }
      });

      const brandSuggestions = Array.from(brandSet)
        .slice(0, Math.ceil(limit * 0.1)) // 10% brands
        .map((brand, index) => ({
          id: `brand_${index}_${brand}`,
          text: brand,
          type: "product" as const, // Brands are shown as product type
        }));

      suggestions.push(...brandSuggestions);
    } catch (error: any) {
      console.warn("Error fetching brand suggestions:", error.message);
    }

    // Sort by relevance (exact matches first, then partial matches)
    const sorted = suggestions.sort((a, b) => {
      const aText = a.text.toLowerCase();
      const bText = b.text.toLowerCase();

      const aStartsWith = aText.startsWith(normalizedQuery);
      const bStartsWith = bText.startsWith(normalizedQuery);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // If both start with query, prefer shorter matches
      if (aStartsWith && bStartsWith) {
        return aText.length - bText.length;
      }

      return aText.localeCompare(bText);
    });

    // Remove duplicates and limit results
    const uniqueSuggestions = new Map<string, SearchSuggestion>();
    for (const suggestion of sorted) {
      const key = suggestion.text.toLowerCase();
      if (!uniqueSuggestions.has(key)) {
        uniqueSuggestions.set(key, suggestion);
        if (uniqueSuggestions.size >= limit) break;
      }
    }

    return Array.from(uniqueSuggestions.values());
  } catch (error: any) {
    console.error("Error fetching search suggestions:", error);
    return [];
  }
}

/**
 * Get all categories for filter selection
 */
export async function getAllCategories(): Promise<Category[]> {
  try {
    const response = await databases.listDocuments(
      databaseId,
      CATEGORIES_COLLECTION_ID,
      [Query.limit(1000)]
    );
    return response.documents as Category[];
  } catch (error: any) {
    console.error("[Categories] Error fetching all categories:", error);
    throw error;
  }
}

/**
 * Get the first available product image for each requested category.
 * Category paths are included so parent categories can use a descendant product image.
 */
export async function getCategoryImageUrls(
  categoryIds: string[]
): Promise<Record<string, string>> {
  if (categoryIds.length === 0) return {};

  const requestedIds = new Set(categoryIds);
  const imageUrls: Record<string, string> = {};
  const pageSize = 100;
  let offset = 0;
  let total = 0;

  try {
    do {
      const response = await databases.listDocuments(
        databaseId,
        PRODUCTS_COLLECTION_ID,
        [
          Query.orderAsc("$sequence"),
          Query.limit(pageSize),
          Query.offset(offset),
        ]
      );

      total = response.total;

      response.documents.forEach((document: any) => {
        if (!document.primary_image_url) return;

        const productCategoryIds = new Set<string>([
          ...(Array.isArray(document.category_path_ids)
            ? document.category_path_ids
            : []),
          ...(document.category_leaf_id ? [document.category_leaf_id] : []),
        ]);

        productCategoryIds.forEach((categoryId) => {
          if (requestedIds.has(categoryId) && !imageUrls[categoryId]) {
            imageUrls[categoryId] = document.primary_image_url;
          }
        });
      });

      offset += response.documents.length;
    } while (
      offset < total &&
      Object.keys(imageUrls).length < requestedIds.size
    );

    return imageUrls;
  } catch (error: any) {
    console.error("[Categories] Error fetching category images:", error);
    throw error;
  }
}

/**
 * Get all unique brands from products for filter selection
 */
export async function getAllBrands(): Promise<string[]> {
  try {
    // Fetch a sample of products to extract brands
    const response = await databases.listDocuments(
      databaseId,
      PRODUCTS_COLLECTION_ID,
      [Query.limit(1000)]
    );
    
    const brands = new Set<string>();
    response.documents.forEach((doc: any) => {
      if (doc.brand && doc.brand.trim()) {
        brands.add(doc.brand);
      }
    });
    
    return Array.from(brands).sort();
  } catch (error: any) {
    console.error("Error fetching all brands:", error);
    return [];
  }
}

/**
 * Get all active store location IDs
 * 
 * First tries to fetch from store_location collection.
 * If that fails (permissions issue), falls back to getting distinct
 * store_location_ids from store_location_product collection.
 */
async function getActiveStoreLocationIds(): Promise<string[]> {
  // Try to fetch from store_location collection first
  try {
    const response = await databases.listDocuments(
      databaseId,
      STORE_LOCATIONS_COLLECTION_ID,
      [
        Query.equal("is_active", true), // Uses 'is_active' not 'active'
        Query.limit(1000), // Adjust limit as needed
      ]
    );

    return response.documents.map((doc: any) => doc.$id);
  } catch (error: any) {
    // Log the error with full details so you know what happened
    console.error("❌ ERROR: Cannot access store_location collection:", {
      error: error.message,
      code: error.code,
      type: error.type,
      collection: STORE_LOCATIONS_COLLECTION_ID,
      reason: "This is likely a permissions issue. The collection may not allow read access for the current user.",
      action: "Falling back to extracting store IDs from store_location_product collection",
    });
    
    // If we can't access store_location collection (permissions issue),
    // fall back to getting store locations from store_location_product
    try {
      console.warn("⚠️  Attempting fallback: Extracting store location IDs from store_location_product...");
      
      // Get distinct store_location_ids from store_location_product
      // This works because we can query products that are in stock
      const response = await databases.listDocuments(
        databaseId,
        STORE_LOCATION_PRODUCT_COLLECTION_ID,
        [
          Query.equal("in_stock", true),
          Query.limit(1000), // Get a sample to extract store IDs
        ]
      );

      // Extract unique store_location_ids
      const storeIds = new Set<string>();
      response.documents.forEach((doc: any) => {
        if (doc.store_location_id) {
          storeIds.add(doc.store_location_id);
        }
      });

      const fallbackCount = storeIds.size;
      if (fallbackCount > 0) {
        console.warn(`⚠️  Fallback successful: Found ${fallbackCount} store location(s) from store_location_product`);
        console.warn("⚠️  NOTE: These may include inactive stores. Consider fixing store_location collection permissions.");
      } else {
        console.warn("⚠️  Fallback returned no store locations. Search will work but won't filter by active stores.");
      }

      return Array.from(storeIds);
    } catch (fallbackError: any) {
      console.error("❌ ERROR: Fallback method also failed:", {
        error: fallbackError.message,
        code: fallbackError.code,
        type: fallbackError.type,
        action: "Search will continue without store filtering",
      });
      // Return empty array - search will still work but won't filter by store
      return [];
    }
  }
}

/**
 * Search products by title (partial match)
 * Uses full-text search on 'title' field (idx_title_fulltext index exists)
 * Includes Jamaican term normalization for better matching
 */
async function searchProductsByTitle(
  query: string,
  limit: number = 100
): Promise<string[]> {
  try {
    // Normalize query with Jamaican terms for better matching
    const normalizedQuery = normalizeText(normalizeJamaicanTerms(query.toLowerCase().trim()));
    
    // Use full-text search on 'title' field (index exists: idx_title_fulltext)
    // Note: Appwrite's full-text search handles basic matching, but fuzzy matching
    // and synonym expansion are handled in ranking (in-memory after fetching results)
    const response = await databases.listDocuments(
      databaseId,
      PRODUCTS_COLLECTION_ID,
      [
        Query.search("title", normalizedQuery),
        Query.limit(limit),
      ]
    );
    return response.documents.map((doc: any) => doc.$id);
  } catch (error: any) {
    console.error("Error searching products by title:", error);
    return [];
  }
}

/**
 * Search products by brand (partial match)
 * Products have 'brand' as a string field
 */
async function searchProductsByBrand(
  query: string,
  limit: number = 100
): Promise<string[]> {
  try {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search products where brand contains the query
    // Note: Query.contains is case-sensitive, but we'll try it
    // For case-insensitive, we might need to fetch and filter
    const response = await databases.listDocuments(
      databaseId,
      PRODUCTS_COLLECTION_ID,
      [
        Query.contains("brand", normalizedQuery),
        Query.limit(limit),
      ]
    );
    
    // Filter case-insensitively in memory as fallback
    const filtered = response.documents.filter((doc: any) => 
      doc.brand && doc.brand.toLowerCase().includes(normalizedQuery)
    );
    
    return filtered.map((doc: any) => doc.$id);
  } catch (error: any) {
    console.error("Error searching products by brand:", error);
    return [];
  }
}

/**
 * Get unique brand names from products that match the query
 * Since brands are stored as strings in products, we search products and extract brands
 */
async function getMatchingBrands(
  query: string,
  limit: number = 100
): Promise<string[]> {
  try {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search products by brand field
    const response = await databases.listDocuments(
      databaseId,
      PRODUCTS_COLLECTION_ID,
      [
        Query.contains("brand", normalizedQuery),
        Query.limit(limit),
      ]
    );
    
    // Extract unique brand names
    const brands = new Set<string>();
    response.documents.forEach((doc: any) => {
      if (doc.brand && doc.brand.toLowerCase().includes(normalizedQuery)) {
        brands.add(doc.brand);
      }
    });
    
    return Array.from(brands);
  } catch (error: any) {
    console.error("Error getting matching brands:", error);
    return [];
  }
}

/**
 * Search categories by name (partial match)
 * Uses contains query (no full-text index exists, but we can filter in memory)
 */
async function searchCategoriesByName(
  query: string,
  limit: number = 100
): Promise<string[]> {
  try {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Fetch categories and filter in memory for case-insensitive matching
    const response = await databases.listDocuments(
      databaseId,
      CATEGORIES_COLLECTION_ID,
      [Query.limit(1000)] // Get all categories to filter
    );
    
    // Filter case-insensitively
    const matching = response.documents.filter((doc: any) => 
      doc.name && doc.name.toLowerCase().includes(normalizedQuery)
    );
    
    return matching.slice(0, limit).map((doc: any) => doc.$id);
  } catch (error: any) {
    console.error("Error searching categories by name:", error);
    return [];
  }
}

/**
 * Fetch product details by IDs
 */
async function getProductsByIds(productIds: string[]): Promise<Map<string, Product>> {
  const productMap = new Map<string, Product>();

  if (productIds.length === 0) return productMap;

  try {
    // Fetch products in batches (Appwrite limit is typically 100)
    const batchSize = 100;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const response = await databases.listDocuments(
        databaseId,
        PRODUCTS_COLLECTION_ID,
        [
          Query.equal("$id", batch),
          Query.limit(batchSize),
        ]
      );

      response.documents.forEach((doc: any) => {
        productMap.set(doc.$id, doc as Product);
      });
    }
  } catch (error: any) {
    console.error("Error fetching products:", error);
  }

  return productMap;
}

/**
 * Get brand names from products
 * Since brands are stored as strings in products, we extract them from product documents
 */
async function getBrandsFromProducts(productIds: string[]): Promise<Map<string, string>> {
  const brandMap = new Map<string, string>();

  if (productIds.length === 0) return brandMap;

  try {
    const batchSize = 100;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const response = await databases.listDocuments(
        databaseId,
        PRODUCTS_COLLECTION_ID,
        [
          Query.equal("$id", batch),
          Query.limit(batchSize),
        ]
      );

      response.documents.forEach((doc: any) => {
        if (doc.brand) {
          brandMap.set(doc.$id, doc.brand);
        }
      });
    }
  } catch (error: any) {
    console.error("Error fetching brands from products:", error);
  }

  return brandMap;
}

/**
 * Fetch category details by IDs
 */
async function getCategoriesByIds(categoryIds: string[]): Promise<Map<string, Category>> {
  const categoryMap = new Map<string, Category>();

  if (categoryIds.length === 0) return categoryMap;

  try {
    const batchSize = 100;
    for (let i = 0; i < categoryIds.length; i += batchSize) {
      const batch = categoryIds.slice(i, i + batchSize);
      const response = await databases.listDocuments(
        databaseId,
        CATEGORIES_COLLECTION_ID,
        [
          Query.equal("$id", batch),
          Query.limit(batchSize),
        ]
      );

      response.documents.forEach((doc: any) => {
        categoryMap.set(doc.$id, doc as Category);
      });
    }
  } catch (error: any) {
    console.error("Error fetching categories:", error);
  }

  return categoryMap;
}

/**
 * Get store brands by IDs
 */
async function getStoreBrandsByIds(brandIds: string[]): Promise<Map<string, { logo_url?: string }>> {
  const brandMap = new Map<string, { logo_url?: string }>();

  if (brandIds.length === 0) return brandMap;

  try {
    const batchSize = 100;
    for (let i = 0; i < brandIds.length; i += batchSize) {
      const batch = brandIds.slice(i, i + batchSize);
      const response = await databases.listDocuments(
        databaseId,
        STORE_BRAND_COLLECTION_ID,
        [
          Query.equal("$id", batch),
          Query.limit(batchSize),
        ]
      );

      response.documents.forEach((doc: any) => {
        brandMap.set(doc.$id, { logo_url: doc.logo_url });
      });
    }
  } catch (error: any) {
    console.error("Error fetching store brands:", error);
  }

  return brandMap;
}

/**
 * Fetch store location details by IDs
 * Also fetches store brand logos and includes them in the StoreLocation
 */
async function getStoreLocationsByIds(storeLocationIds: string[]): Promise<Map<string, StoreLocation>> {
  const storeMap = new Map<string, StoreLocation>();

  if (storeLocationIds.length === 0) return storeMap;

  try {
    const batchSize = 100;
    const brandIds = new Set<string>();
    
    // First, fetch store locations and collect brand IDs
    for (let i = 0; i < storeLocationIds.length; i += batchSize) {
      const batch = storeLocationIds.slice(i, i + batchSize);
      const response = await databases.listDocuments(
        databaseId,
        STORE_LOCATIONS_COLLECTION_ID,
        [
          Query.equal("$id", batch),
          Query.limit(batchSize),
        ]
      );

      response.documents.forEach((doc: any) => {
        if (doc.brand_id) {
          brandIds.add(doc.brand_id);
        }
        storeMap.set(doc.$id, doc as StoreLocation);
      });
    }

    // Fetch store brands to get logo URLs
    const brandsMap = await getStoreBrandsByIds(Array.from(brandIds));

    // Add logo_url from brand to each store location
    storeMap.forEach((storeLocation, storeId) => {
      if (storeLocation.brand_id) {
        const brand = brandsMap.get(storeLocation.brand_id);
        if (brand?.logo_url) {
          storeLocation.logo_url = brand.logo_url;
        }
      }
    });
  } catch (error: any) {
    console.error("Error fetching store locations:", error);
  }

  return storeMap;
}

/**
 * Get store location IDs that deliver to a specific parish
 */
async function getStoreLocationIdsByParish(parish: string): Promise<string[]> {
  try {
    const response = await databases.listDocuments(
      databaseId,
      STORE_LOCATIONS_COLLECTION_ID,
      [
        Query.equal("is_active", true),
        Query.equal("parish", parish),
        Query.limit(1000),
      ]
    );
    return response.documents.map((doc: any) => doc.$id);
  } catch (error: any) {
    console.error("Error fetching store locations by parish:", error);
    // If filtering by parish fails, return empty array (strict filtering)
    // This ensures we don't show products from stores that don't deliver to the address
    return [];
  }
}

/**
 * Helper function to fetch all results with automatic pagination
 * Fetches in batches until all results are retrieved
 */
async function fetchAllWithPagination(
  queries: any[],
  batchSize: number = 250
): Promise<any[]> {
  const allDocs: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await databases.listDocuments(
        databaseId,
        STORE_LOCATION_PRODUCT_COLLECTION_ID,
        [
          ...queries,
          Query.limit(batchSize),
          Query.offset(offset)
        ]
      );

      allDocs.push(...response.documents);
      
      // If we got fewer results than the batch size, we've reached the end
      hasMore = response.documents.length === batchSize;
      offset += batchSize;

      // Safety check to prevent infinite loops (max 10,000 results)
      if (offset >= 10000) {
        console.warn("⚠️ Reached maximum result limit (10,000). Some results may be truncated.");
        break;
      }
    } catch (error: any) {
      console.error("Error fetching batch at offset", offset, ":", error);
      break;
    }
  }

  return allDocs;
}

/**
 * Query store_location_product with multiple filters
 * Appwrite doesn't support OR queries directly, so we query separately and combine
 * Now with automatic pagination to fetch ALL results (no artificial limits)
 */
async function queryStoreLocationProducts(
  activeStoreLocationIds: string[],
  productIds: string[],
  brandIds: string[], // Not used since brands are in products, but kept for API compatibility
  categoryIds: string[],
  filters?: ProductFilters
): Promise<StoreLocationProduct[]> {
  const allResults = new Map<string, StoreLocationProduct>();

  // Determine store location filter: delivery address > specific store IDs > active stores
  let storeLocationIdsToUse = activeStoreLocationIds;
  if (filters?.storeLocationIds && filters.storeLocationIds.length > 0) {
    storeLocationIdsToUse = filters.storeLocationIds;
  } else if (filters?.deliveryParish) {
    // Filter stores by delivery parish
    const parishStoreIds = await getStoreLocationIdsByParish(filters.deliveryParish);
    if (parishStoreIds.length > 0) {
      // Intersect with active stores (only use stores that are both active and deliver to parish)
      storeLocationIdsToUse = activeStoreLocationIds.filter(id => parishStoreIds.includes(id));
    } else {
      // No stores deliver to this parish, return empty results
      return [];
    }
  }

  // Determine stock filter: defaults to true (in stock only) if not explicitly set to false
  const inStockFilter = filters?.inStock !== false;

  // Query by product_id if we have product matches
  if (productIds.length > 0) {
    // Query in batches since Appwrite has limits
    const batchSize = 25; // Appwrite limit for Query.equal with arrays
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      try {
        const queries: any[] = [];
        
        // Apply stock filter
        if (inStockFilter) {
          queries.push(Query.equal("in_stock", true));
        }
        
        // Filter by product IDs
        queries.push(Query.equal("product_id", batch));
        
        // Only filter by store_location_id if we have store locations to filter by
        if (storeLocationIdsToUse.length > 0) {
          queries.push(Query.equal("store_location_id", storeLocationIdsToUse));
        }
        
        // Apply price range filters at database level for better performance
        if (filters?.minPrice !== undefined) {
          queries.push(Query.greaterThanEqual("price_jmd_cents", filters.minPrice));
        }
        if (filters?.maxPrice !== undefined) {
          queries.push(Query.lessThanEqual("price_jmd_cents", filters.maxPrice));
        }
        
        // Fetch all results with automatic pagination (batch size: 250)
        const documents = await fetchAllWithPagination(queries, 250);
        
        documents.forEach((doc: any) => {
          allResults.set(doc.$id, doc as StoreLocationProduct);
        });
      } catch (error: any) {
        console.error("Error querying by product_id:", error);
      }
    }
  }

  // Note: brand_id in store_location_product refers to store brand, not product brand
  // We don't query by brand_id here since we're searching product brands, not store brands

  // Query by category_leaf_id if we have category matches
  if (categoryIds.length > 0) {
    const batchSize = 25;
    for (let i = 0; i < categoryIds.length; i += batchSize) {
      const batch = categoryIds.slice(i, i + batchSize);
      try {
        const queries: any[] = [];
        
        // Apply stock filter
        if (inStockFilter) {
          queries.push(Query.equal("in_stock", true));
        }
        
        // Filter by category
        queries.push(Query.equal("category_leaf_id", batch));
        
        // Only filter by store_location_id if we have store locations to filter by
        if (storeLocationIdsToUse.length > 0) {
          queries.push(Query.equal("store_location_id", storeLocationIdsToUse));
        }
        
        // Apply price range filters at database level for better performance
        if (filters?.minPrice !== undefined) {
          queries.push(Query.greaterThanEqual("price_jmd_cents", filters.minPrice));
        }
        if (filters?.maxPrice !== undefined) {
          queries.push(Query.lessThanEqual("price_jmd_cents", filters.maxPrice));
        }
        
        // Fetch all results with automatic pagination (batch size: 250)
        const documents = await fetchAllWithPagination(queries, 250);
        
        documents.forEach((doc: any) => {
          allResults.set(doc.$id, doc as StoreLocationProduct);
        });
      } catch (error: any) {
        console.error("Error querying by category_leaf_id:", error);
      }
    }
  }

  // Filter by category_path_ids in memory (Appwrite doesn't support array contains)
  let filteredResults = Array.from(allResults.values());
  
  if (categoryIds.length > 0) {
    filteredResults = filteredResults.filter((doc) => {
      // If we're searching by category, check category_path_ids
      if (doc.category_path_ids) {
        return doc.category_path_ids.some((id) => categoryIds.includes(id));
      }
      return true;
    });
  }

  return filteredResults;
}

// Ranking functions have been moved to lib/search/ranking.ts
// Use rankResults() from that module instead

/**
 * Perform a global product search across all active stores (paginated version)
 * 
 * This version supports pagination for large result sets.
 * 
 * @param query - Search query string
 * @param pagination - Pagination options (page, pageSize, or offset)
 * @param userPrefs - User preferences for ranking boost
 * @param sortMode - Sort mode: "relevance", "price_asc", or "price_desc"
 * @param userId - Optional user ID for analytics tracking
 * @param filters - Filter options (brands, categories, price range, etc.)
 * @returns Paginated search results with metadata
 */
export async function searchProductsPaginated(
  query: string,
  pagination: PaginationOptions = {},
  userPrefs?: UserPreferences | RankingUserPrefs | null,
  sortMode: SortMode = "relevance",
  userId?: string | null,
  filters?: ProductFilters
): Promise<PaginatedSearchResults> {
  // Get all results (we'll paginate in-memory for now)
  // In a production system, you'd want to paginate at the database level
  const allResults = await searchProducts(
    query,
    10000, // Get more results for pagination
    userPrefs,
    sortMode,
    userId,
    filters
  );
  
  // Calculate pagination
  const pageSize = pagination.pageSize || 50;
  const page = pagination.page || 1;
  const offset = pagination.offset !== undefined ? pagination.offset : (page - 1) * pageSize;
  
  const totalResults = allResults.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const startIndex = offset;
  const endIndex = Math.min(startIndex + pageSize, totalResults);
  
  const results = allResults.slice(startIndex, endIndex);
  
  return {
    results,
    totalResults,
    currentPage: page,
    totalPages,
    pageSize,
    hasMore: endIndex < totalResults,
  };
}

/**
 * Perform a global product search across all active stores
 * 
 * Supports searching by:
 * - Product name (exact, startsWith, contains, token-based, and fuzzy matches)
 * - Brand (exact, startsWith, contains, fuzzy)
 * - Category (exact, contains, fuzzy)
 * 
 * Includes typo tolerance and Jamaican naming variations:
 * - Minor spelling errors are tolerated (fuzzy matching)
 * - Common Jamaican product terms and variations are supported
 * - Synonyms for known local terms (config-based)
 * 
 * Results are ranked by relevance using configurable weights:
 * 1. Exact title match (highest priority)
 * 2. Title starts with query
 * 3. Title contains query
 * 4. Token coverage in title (for multi-word queries)
 * 5. Fuzzy matches (typo tolerance)
 * 6. Brand matches (exact > startsWith > contains > fuzzy)
 * 7. Category matches (exact > contains > fuzzy)
 * 8. User preference boosts (optional, small)
 * 
 * Only returns active, available products (in_stock = true)
 * Results are deduplicated by SKU and sorted by relevance score
 * 
 * Search events are automatically logged for analytics (non-blocking)
 * 
 * @param query - Search query string
 * @param limit - Maximum number of results to return (default: 50)
 * @param userPrefs - User preferences for ranking boost (optional, non-breaking). Can be UserPreferences or RankingUserPrefs
 * @param sortMode - Sort mode: "relevance" (default), "price_asc", or "price_desc"
 * @param userId - Optional user ID for analytics tracking (null for anonymous searches)
 * @param filters - Filter options (brands, categories, price range, etc.)
 * @returns Array of search results sorted by relevance, with product, brand, category, and store information
 */
export async function searchProducts(
  query: string,
  limit: number = 50,
  userPrefs?: UserPreferences | RankingUserPrefs | null,
  sortMode: SortMode = "relevance",
  userId?: string | null,
  filters?: ProductFilters
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    // Normalize query with Jamaican terms before searching
    // This ensures "corn beef" matches "corned beef", "graece" matches "grace", etc.
    const normalizedQuery = normalizeText(normalizeJamaicanTerms(query));
    // Step 1: Get all active store location IDs (optional - search works without it)
    const activeStoreLocationIds = await getActiveStoreLocationIds();
    
    // Note: If we can't get store locations, we'll search all products
    // This is acceptable - the search will still work, just won't filter by active stores
    if (activeStoreLocationIds.length === 0) {
      console.warn("⚠️  WARNING: No active store locations found - searching all products without store filtering");
      console.warn("⚠️  This may return products from inactive stores. Check store_location collection permissions.");
    } else {
      console.log(`✓ Found ${activeStoreLocationIds.length} active store location(s) for filtering`);
    }

    // Step 2: Search for matching products, brands, and categories in parallel
    // Use normalized query for better matching with Jamaican terms
    const [productIdsByTitle, categoryIdsFromQuery] = await Promise.all([
      searchProductsByTitle(normalizedQuery),
      searchCategoriesByName(normalizedQuery),
    ]);

    // Step 2b: Search products by brand and get matching brand names
    const matchingBrands = await getMatchingBrands(normalizedQuery);
    const productIdsByBrand = await searchProductsByBrand(normalizedQuery);

    // Combine product IDs from title and brand searches
    // Keep separate arrays for ranking purposes
    const allProductIds = [...new Set([...productIdsByTitle, ...productIdsByBrand])];

    // Apply filter-based category IDs if provided
    const categoryIds = filters?.categoryIds 
      ? [...new Set([...categoryIdsFromQuery, ...filters.categoryIds])]
      : categoryIdsFromQuery;

    // If no matches found in products or categories, return empty
    if (allProductIds.length === 0 && categoryIds.length === 0) {
      return [];
    }

    // Step 3: Query store_location_product collection with all search criteria
    // Note: brandIds is now empty array since brands are strings in products
    const filteredDocs = await queryStoreLocationProducts(
      activeStoreLocationIds,
      allProductIds,
      [], // No separate brand collection
      categoryIds,
      filters // Pass filters for store location and stock filtering
    );

    // If no results after filtering, return empty
    if (filteredDocs.length === 0) {
      return [];
    }

    // Step 4: Collect unique IDs for batch fetching
    const uniqueProductIds = [...new Set(filteredDocs.map((doc) => doc.product_id))];
    const uniqueCategoryIds = [
      ...new Set(
        filteredDocs
          .map((doc) => doc.category_leaf_id)
          .filter((id): id is string => !!id)
          .concat(
            filteredDocs
              .flatMap((doc) => doc.category_path_ids || [])
              .filter((id) => !!id)
          )
      ),
    ];
    const uniqueStoreLocationIds = [...new Set(filteredDocs.map((doc) => doc.store_location_id))];

    // Step 5: Fetch all related data in parallel
    const [productsMap, brandsMap, categoriesMap, storeLocationsMap] = await Promise.all([
      getProductsByIds(uniqueProductIds),
      getBrandsFromProducts(uniqueProductIds), // Get brands from products
      getCategoriesByIds(uniqueCategoryIds),
      uniqueStoreLocationIds.length > 0 
        ? getStoreLocationsByIds(uniqueStoreLocationIds)
        : Promise.resolve(new Map<string, StoreLocation>()), // Return empty map if no store IDs
    ]);

    // Step 6: Build search results, calculate relevance scores, and deduplicate by SKU/product_id
    // Apply additional filters in memory (brand, price range)
    const resultsMap = new Map<string, SearchResult>();
    const seenSkus = new Set<string>();

    for (const doc of filteredDocs) {
      const product = productsMap.get(doc.product_id);
      const brandName = brandsMap.get(doc.product_id) || ""; // Get brand from product
      const storeLocation = storeLocationsMap.get(doc.store_location_id);
      const category = doc.category_leaf_id
        ? categoriesMap.get(doc.category_leaf_id)
        : undefined;

      // Skip if essential data is missing (product is required, storeLocation is optional)
      if (!product) {
        continue;
      }

      // Apply brand filter (in memory, since brands are in products)
      if (filters?.brands && filters.brands.length > 0) {
        if (!brandName || !filters.brands.some(b => brandName.toLowerCase() === b.toLowerCase())) {
          continue;
        }
      }

      // Price range filters are now applied at database level (see queryStoreLocationProducts)
      // This comment kept for reference - filters moved to DB queries for performance
      
      // If we can't fetch store location details, create a minimal one from the ID
      const finalStoreLocation: StoreLocation = storeLocation || {
        $id: doc.store_location_id,
        name: `Store ${doc.store_location_id.substring(0, 8)}`,
        display_name: `Store ${doc.store_location_id.substring(0, 8)}`,
        is_active: true, // Assume active if we can't verify
        brand_id: doc.brand_id,
        slug: doc.store_location_id,
      };

      // Deduplicate by SKU (products always have SKU)
      const dedupeKey = product.sku;
      if (seenSkus.has(dedupeKey)) {
        // If we've seen this SKU, keep the one with better stock status or lower price
        const existing = resultsMap.get(dedupeKey);
        if (existing) {
          // Prefer in-stock items
          if (doc.in_stock && !existing.inStock) {
            // Replace with in-stock version
          } else if (!doc.in_stock && existing.inStock) {
            // Keep existing in-stock version
            continue;
          }
          // If both have same stock status, prefer lower price
          else if (doc.price_jmd_cents < existing.priceJmdCents) {
            // Replace with lower price version
          } else {
            // Keep existing
            continue;
          }
        }
      }
      seenSkus.add(dedupeKey);

      const result: SearchResult = {
        product,
        brand: brandName, // Brand is just a string
        category,
        storeLocation: finalStoreLocation,
        priceJmdCents: doc.price_jmd_cents,
        inStock: doc.in_stock,
        sku: product.sku,
        // relevanceScore will be calculated by rankResults()
      };

      resultsMap.set(dedupeKey, result);
    }

    // Step 7: Convert to array, rank and sort by relevance, then limit results
    const results = Array.from(resultsMap.values());
    
    // Convert user preferences format if needed
    let rankingPrefs: RankingUserPrefs | undefined = undefined;
    if (userPrefs) {
      if ('categoryPreferences' in userPrefs) {
        // It's a UserPreferences object
        rankingPrefs = convertUserPrefsToRankingPrefs(userPrefs as UserPreferences);
      } else {
        // It's already a RankingUserPrefs object
        rankingPrefs = userPrefs as RankingUserPrefs;
      }
    }
    
    // Apply ranking using the new ranking module
    // Ranking includes fuzzy matching and synonym handling for typo tolerance
    // The original query is passed for ranking, but normalization happens inside ranking
    const rankedResults = rankResults(results, query, rankingPrefs, sortMode);
    
    // Limit results
    const finalResults = rankedResults.slice(0, limit);
    
    // Log search analytics (non-blocking - errors are silently caught)
    logSearchResults(userId || null, query, finalResults).catch((error) => {
      // Analytics logging failures should never break search
      if (__DEV__) {
        console.warn("[SearchService] Failed to log search analytics:", error);
      }
    });
    
    return finalResults;
  } catch (error: any) {
    console.error("Error searching products:", error);
    
    // Log no-result search even on error (non-blocking)
    logSearchResults(userId || null, query, []).catch(() => {
      // Ignore analytics errors
    });
    
    // Return empty array on error rather than throwing
    // This allows the UI to handle the error gracefully
    return [];
  }
}
