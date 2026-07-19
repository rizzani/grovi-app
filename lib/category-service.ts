import { Query } from "appwrite";
import { databaseId, databases } from "./appwrite-client";
import type {
  PaginatedSearchResults,
  Product,
  SearchResult,
  StoreLocation,
  StoreLocationProduct,
} from "./search-service";

const CATEGORIES_COLLECTION_ID = "categories";
const PRODUCTS_COLLECTION_ID = "products";
const STORE_LOCATION_PRODUCT_COLLECTION_ID = "store_location_product";
const STORE_LOCATIONS_COLLECTION_ID = "store_location";
const QUERY_VALUE_BATCH_SIZE = 25;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const categoryDescendantIdsCache = new Map<string, string[]>();

interface CategoryDocument {
  $id: string;
  path_ids?: string[];
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function getCategoryAndDescendantIds(categoryId: string): Promise<string[]> {
  const cachedIds = categoryDescendantIdsCache.get(categoryId);
  if (cachedIds) return cachedIds;

  const response = await databases.listDocuments(
    databaseId,
    CATEGORIES_COLLECTION_ID,
    [Query.limit(1000)]
  );

  const categoryIds = response.documents
    .filter((document: any) => {
      const category = document as CategoryDocument;
      return (
        category.$id === categoryId ||
        category.path_ids?.includes(categoryId) === true
      );
    })
    .map((document) => document.$id);

  const resolvedIds = categoryIds.length > 0 ? categoryIds : [categoryId];
  categoryDescendantIdsCache.set(categoryId, resolvedIds);
  return resolvedIds;
}

async function getProductPage(
  categoryIds: string[],
  offset: number,
  pageSize: number
): Promise<{ products: Product[]; total: number }> {
  const categoryBatches = chunk(categoryIds, QUERY_VALUE_BATCH_SIZE);

  if (categoryBatches.length === 1) {
    const response = await databases.listDocuments(
      databaseId,
      PRODUCTS_COLLECTION_ID,
      [
        Query.equal("category_leaf_id", categoryBatches[0]),
        Query.orderAsc("$sequence"),
        Query.limit(pageSize),
        Query.offset(offset),
      ]
    );

    return {
      products: response.documents as unknown as Product[],
      total: response.total,
    };
  }

  // For unusually large category trees, fetch enough ordered candidates from
  // each batch to construct the requested global page, then merge by sequence.
  const candidateLimit = offset + pageSize;
  const responses = await Promise.all(
    categoryBatches.map((categoryBatch) =>
      databases.listDocuments(databaseId, PRODUCTS_COLLECTION_ID, [
        Query.equal("category_leaf_id", categoryBatch),
        Query.orderAsc("$sequence"),
        Query.limit(candidateLimit),
      ])
    )
  );

  const products = responses
    .flatMap((response) => response.documents)
    .sort((left, right) => left.$sequence - right.$sequence)
    .slice(offset, offset + pageSize) as unknown as Product[];

  return {
    products,
    total: responses.reduce((sum, response) => sum + response.total, 0),
  };
}

async function getBestInventoryByProduct(
  productIds: string[]
): Promise<Map<string, StoreLocationProduct>> {
  const inventoryByProduct = new Map<string, StoreLocationProduct>();

  const responses = await Promise.all(
    chunk(productIds, QUERY_VALUE_BATCH_SIZE).map((productBatch) =>
      databases.listDocuments(
        databaseId,
        STORE_LOCATION_PRODUCT_COLLECTION_ID,
        [Query.equal("product_id", productBatch), Query.limit(1000)]
      )
    )
  );

  responses.forEach((response) => {
    response.documents.forEach((document: any) => {
      const inventory = document as StoreLocationProduct;
      const existing = inventoryByProduct.get(inventory.product_id);

      if (
        !existing ||
        (inventory.in_stock && !existing.in_stock) ||
        (inventory.in_stock === existing.in_stock &&
          inventory.price_jmd_cents < existing.price_jmd_cents)
      ) {
        inventoryByProduct.set(inventory.product_id, inventory);
      }
    });
  });

  return inventoryByProduct;
}

async function getStoreLocations(
  storeLocationIds: string[]
): Promise<Map<string, StoreLocation>> {
  const stores = new Map<string, StoreLocation>();
  if (storeLocationIds.length === 0) return stores;

  try {
    const responses = await Promise.all(
      chunk(storeLocationIds, QUERY_VALUE_BATCH_SIZE).map((storeBatch) =>
        databases.listDocuments(databaseId, STORE_LOCATIONS_COLLECTION_ID, [
          Query.equal("$id", storeBatch),
          Query.limit(storeBatch.length),
        ])
      )
    );

    responses.forEach((response) => {
      response.documents.forEach((document: any) => {
        stores.set(document.$id, document as StoreLocation);
      });
    });
  } catch (error) {
    console.warn(
      "[Categories] Store details unavailable; using inventory store IDs:",
      error
    );
  }

  return stores;
}

/**
 * Fetch one ordered page of products belonging to a category. Parent category
 * selections include products assigned to descendant leaf categories.
 */
export async function getProductsByCategory(
  categoryId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedSearchResults> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize))
  );
  const offset = (safePage - 1) * safePageSize;

  try {
    const categoryIds = await getCategoryAndDescendantIds(categoryId);
    const { products, total } = await getProductPage(
      categoryIds,
      offset,
      safePageSize
    );

    if (products.length === 0) {
      return {
        results: [],
        totalResults: total,
        currentPage: safePage,
        totalPages: Math.ceil(total / safePageSize),
        pageSize: safePageSize,
        hasMore: offset + safePageSize < total,
      };
    }

    const inventoryByProduct = await getBestInventoryByProduct(
      products.map((product) => product.$id)
    );
    const storeLocationIds = [
      ...new Set(
        Array.from(inventoryByProduct.values()).map(
          (inventory) => inventory.store_location_id
        )
      ),
    ];
    const stores = await getStoreLocations(storeLocationIds);

    const results: SearchResult[] = products.flatMap((product) => {
      const inventory = inventoryByProduct.get(product.$id);
      if (!inventory) return [];

      const storeLocation = stores.get(inventory.store_location_id) || {
        $id: inventory.store_location_id,
        name: `Store ${inventory.store_location_id.substring(0, 8)}`,
        display_name: `Store ${inventory.store_location_id.substring(0, 8)}`,
        is_active: true,
        brand_id: inventory.brand_id,
        slug: inventory.store_location_id,
      };

      return [
        {
          product,
          brand: product.brand || "",
          storeLocation,
          priceJmdCents: inventory.price_jmd_cents,
          inStock: inventory.in_stock,
          sku: product.sku,
        },
      ];
    });

    return {
      results,
      totalResults: total,
      currentPage: safePage,
      totalPages: Math.ceil(total / safePageSize),
      pageSize: safePageSize,
      hasMore: offset + safePageSize < total,
    };
  } catch (error) {
    console.error(
      `[Categories] Failed to fetch products for category ${categoryId}:`,
      error
    );
    throw error;
  }
}
