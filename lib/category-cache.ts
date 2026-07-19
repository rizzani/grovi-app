import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Category, SearchResult } from "./search-service";

const CATEGORIES_KEY = "grovi:categories:v1";
const CATEGORY_PRODUCTS_PREFIX = "grovi:category-products:v1";
export const CATEGORIES_TTL_MS = 60 * 60 * 1000;
export const CATEGORY_PRODUCTS_TTL_MS = 5 * 60 * 1000;

export interface CategoriesCacheEntry {
  categories: Category[];
  imageUrls: Record<string, string>;
  fetchedAt: number;
}

export interface CategoryProductsCacheEntry {
  products: SearchResult[];
  fetchedAt: number;
  complete: boolean;
}

let categoriesMemory: CategoriesCacheEntry | undefined;
const productsMemory = new Map<string, CategoryProductsCacheEntry>();
const productsInFlight = new Map<string, Promise<SearchResult[]>>();

function productsKey(categoryId: string): string {
  return `${CATEGORY_PRODUCTS_PREFIX}:${categoryId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function removeBrokenEntry(key: string, error: unknown): Promise<void> {
  console.warn(`[Categories] Removing invalid cache entry ${key}:`, error);
  await AsyncStorage.removeItem(key).catch(() => undefined);
}

export async function getCachedCategories(): Promise<
  CategoriesCacheEntry | undefined
> {
  if (categoriesMemory) return categoriesMemory;

  try {
    const stored = await AsyncStorage.getItem(CATEGORIES_KEY);
    if (!stored) return undefined;
    const parsed: unknown = JSON.parse(stored);
    const parsedRecord = isObject(parsed) ? parsed : undefined;
    const imageUrls = isObject(parsedRecord?.imageUrls)
      ? parsedRecord.imageUrls
      : isObject(parsedRecord?.categoryImageUrls)
        ? parsedRecord.categoryImageUrls
        : undefined;

    if (
      !parsedRecord ||
      !Array.isArray(parsedRecord.categories) ||
      !parsedRecord.categories.every(
        (category) =>
          isObject(category) &&
          typeof category.$id === "string" &&
          typeof category.name === "string"
      ) ||
      !imageUrls ||
      !Object.values(imageUrls).every((url) => typeof url === "string") ||
      typeof parsedRecord.fetchedAt !== "number"
    ) {
      throw new Error("Invalid category cache payload");
    }

    categoriesMemory = {
      categories: parsedRecord.categories as Category[],
      imageUrls: imageUrls as Record<string, string>,
      fetchedAt: parsedRecord.fetchedAt,
    };

    if (!("imageUrls" in parsedRecord)) {
      await AsyncStorage.setItem(
        CATEGORIES_KEY,
        JSON.stringify(categoriesMemory)
      );
    }

    return categoriesMemory;
  } catch (error) {
    await removeBrokenEntry(CATEGORIES_KEY, error);
    return undefined;
  }
}

export async function setCachedCategories(
  categories: Category[],
  imageUrls: Record<string, string>,
  fetchedAt: number = Date.now()
): Promise<CategoriesCacheEntry> {
  const entry: CategoriesCacheEntry = {
    categories: categories.map((category) => ({
      $id: category.$id,
      name: category.name,
    })),
    imageUrls,
    fetchedAt,
  };
  categoriesMemory = entry;

  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(entry)).catch(
    (error) => console.warn("[Categories] Failed to persist categories:", error)
  );
  return entry;
}

export function isCategoriesFresh(entry: CategoriesCacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CATEGORIES_TTL_MS;
}

export async function getCachedCategoryProducts(
  categoryId: string
): Promise<CategoryProductsCacheEntry | undefined> {
  const memoryEntry = productsMemory.get(categoryId);
  if (memoryEntry) return memoryEntry;

  const key = productsKey(categoryId);
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return undefined;
    const parsed: unknown = JSON.parse(stored);
    const parsedRecord = isObject(parsed) ? parsed : undefined;

    if (
      !parsedRecord ||
      !Array.isArray(parsedRecord.products) ||
      typeof parsedRecord.fetchedAt !== "number" ||
      (parsedRecord.complete !== undefined &&
        typeof parsedRecord.complete !== "boolean")
    ) {
      throw new Error("Invalid category product cache payload");
    }

    const entry: CategoryProductsCacheEntry = {
      products: parsedRecord.products as SearchResult[],
      fetchedAt: parsedRecord.fetchedAt,
      complete:
        typeof parsedRecord.complete === "boolean"
          ? parsedRecord.complete
          : true,
    };
    productsMemory.set(categoryId, entry);

    if (parsedRecord.complete === undefined) {
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    }

    return entry;
  } catch (error) {
    await removeBrokenEntry(key, error);
    return undefined;
  }
}

export async function setCachedCategoryProducts(
  categoryId: string,
  products: SearchResult[],
  complete: boolean = true
): Promise<void> {
  // Keep only the fields rendered by this screen or required for detail routing.
  const compactProducts: SearchResult[] = products.map((result) => ({
    product: {
      $id: result.product.$id,
      title: result.product.title,
      sku: result.product.sku,
      brand: result.product.brand,
      primary_image_url: result.product.primary_image_url,
      category_leaf_id: result.product.category_leaf_id,
      category_path_ids: result.product.category_path_ids,
    },
    brand: result.brand,
    storeLocation: {
      $id: result.storeLocation.$id,
      name: result.storeLocation.name,
      display_name: result.storeLocation.display_name,
      is_active: result.storeLocation.is_active,
      brand_id: result.storeLocation.brand_id,
      slug: result.storeLocation.slug,
    },
    priceJmdCents: result.priceJmdCents,
    inStock: result.inStock,
    sku: result.sku,
  }));
  const entry: CategoryProductsCacheEntry = {
    products: compactProducts,
    fetchedAt: Date.now(),
    complete,
  };
  productsMemory.set(categoryId, entry);

  await AsyncStorage.setItem(productsKey(categoryId), JSON.stringify(entry)).catch(
    (error) =>
      console.warn(
        `[Categories] Failed to persist products for ${categoryId}:`,
        error
      )
  );
}

export function isCategoryProductsFresh(
  entry: CategoryProductsCacheEntry
): boolean {
  return (
    entry.complete && Date.now() - entry.fetchedAt < CATEGORY_PRODUCTS_TTL_MS
  );
}

export function fetchCategoryProductsOnce(
  categoryId: string,
  fetchProducts: () => Promise<SearchResult[]>
): Promise<SearchResult[]> {
  const existing = productsInFlight.get(categoryId);
  if (existing) return existing;

  const request = fetchProducts()
    .then(async (products) => {
      await setCachedCategoryProducts(categoryId, products);
      return products;
    })
    .finally(() => {
      if (productsInFlight.get(categoryId) === request) {
        productsInFlight.delete(categoryId);
      }
    });
  productsInFlight.set(categoryId, request);
  return request;
}
