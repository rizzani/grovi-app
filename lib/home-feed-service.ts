import { Query } from "appwrite";
import { databaseId, databases } from "./appwrite-client";
import { HOME_FEED_CONFIG } from "./home-feed-config";
import {
  preferLocalWithFallback,
  rankDeals,
  rankFeatured,
  rankNewProducts,
  rankPopular,
  visibleSection,
} from "./product-ranking";
import { getAllCategories, type Category, type Product, type SearchResult, type StoreLocation, type StoreLocationProduct } from "./search-service";

const PRODUCTS = "products";
const INVENTORY = "store_location_product";
const STORES = "store_location";

export interface HomeFeed {
  featured: SearchResult[];
  essentials: SearchResult[];
  deals: SearchResult[];
  newProducts: SearchResult[];
  popular: SearchResult[];
  popularSectionTitle: string;
  categories: Category[];
  stores?: StoreLocation[];
}

export interface HomeFeedOptions {
  deliveryParish?: string;
}

const chunks = <T,>(items: T[], size = 25): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

async function getActiveStores(parish?: string): Promise<StoreLocation[]> {
  try {
    const queries = [Query.equal("is_active", true), Query.limit(HOME_FEED_CONFIG.candidateLimit)];
    if (parish) queries.unshift(Query.equal("parish", parish));
    const response = await databases.listDocuments(databaseId, STORES, queries);
    return response.documents as unknown as StoreLocation[];
  } catch (error) {
    console.warn("[HomeFeed] Store filtering unavailable; using in-stock inventory fallback:", error);
    return [];
  }
}

async function getInventory(storeIds?: string[]): Promise<StoreLocationProduct[]> {
  const base = [Query.equal("in_stock", true), Query.limit(HOME_FEED_CONFIG.candidateLimit)];
  if (!storeIds?.length) {
    const response = await databases.listDocuments(databaseId, INVENTORY, base);
    return response.documents as unknown as StoreLocationProduct[];
  }
  const responses = await Promise.all(chunks(storeIds).map((ids) =>
    databases.listDocuments(databaseId, INVENTORY, [Query.equal("store_location_id", ids), ...base])));
  return responses.flatMap((response) => response.documents) as unknown as StoreLocationProduct[];
}

async function getProducts(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const responses = await Promise.all(chunks([...new Set(ids)]).map((batch) =>
    databases.listDocuments(databaseId, PRODUCTS, [Query.equal("$id", batch), Query.limit(batch.length)])));
  return responses.flatMap((response) => response.documents) as unknown as Product[];
}

function joinProducts(
  products: Product[], inventory: StoreLocationProduct[], stores: StoreLocation[]
): SearchResult[] {
  const productMap = new Map(products.map((product) => [product.$id, product]));
  const storeMap = new Map(stores.map((store) => [store.$id, store]));
  const best = new Map<string, SearchResult>();
  for (const stock of inventory) {
    const product = productMap.get(stock.product_id);
    if (!product || !stock.in_stock) continue;
    const store = storeMap.get(stock.store_location_id) ?? {
      $id: stock.store_location_id, name: "Grovi partner", display_name: "Grovi partner",
      is_active: true, brand_id: stock.brand_id, slug: stock.store_location_id,
    };
    const item: SearchResult = {
      product, brand: product.brand ?? "", storeLocation: store,
      priceJmdCents: stock.price_jmd_cents, inStock: stock.in_stock, sku: product.sku,
      storeProductSalePrice: stock.sale_price_jmd_cents,
    };
    const existing = best.get(product.$id);
    if (!existing || item.priceJmdCents < existing.priceJmdCents) best.set(product.$id, item);
  }
  return [...best.values()];
}

export async function getHomeFeed(options: HomeFeedOptions = {}): Promise<HomeFeed> {
  try {
    const [categories, activeStores, localStores] = await Promise.all([
      getAllCategories(), getActiveStores(),
      options.deliveryParish ? getActiveStores(options.deliveryParish) : Promise.resolve([]),
    ]);
    const [activeInventory, localInventory] = await Promise.all([
      getInventory(activeStores.map((store) => store.$id)),
      options.deliveryParish && localStores.length ? getInventory(localStores.map((store) => store.$id)) : Promise.resolve([]),
    ]);
    const allInventory = [...activeInventory, ...localInventory];
    const products = await getProducts(allInventory.map((item) => item.product_id));
    const activeItems = joinProducts(products, activeInventory, activeStores);
    const localItems = joinProducts(products, localInventory, localStores);
    const candidates = preferLocalWithFallback(localItems, activeItems);
    const now = new Date();
    const popularRanking = rankPopular(candidates);
    const manualFallback = rankPopular(activeItems.filter((item) =>
      (item.product.manualPopularityScore ?? 0) > 0 || item.product.isFeatured || item.product.isEssential)).items;
    const finalPopular = preferLocalWithFallback(popularRanking.items, manualFallback);
    const hasLocation = Boolean(options.deliveryParish && localStores.length);

    return {
      featured: visibleSection(rankFeatured(candidates, now)),
      essentials: visibleSection(candidates.filter((item) => item.product.isEssential === true)),
      deals: visibleSection(rankDeals(candidates, now)),
      newProducts: visibleSection(rankNewProducts(candidates, now)),
      popular: visibleSection(finalPopular),
      popularSectionTitle: popularRanking.coldStart
        ? "Popular picks"
        : hasLocation ? "Popular near you" : "Popular right now",
      categories: categories.slice(0, HOME_FEED_CONFIG.sectionLimit),
      stores: hasLocation && localStores.length >= HOME_FEED_CONFIG.minimumItems
        ? localStores.slice(0, HOME_FEED_CONFIG.sectionLimit) : undefined,
    };
  } catch (error) {
    console.error("[HomeFeed] Failed to load home feed:", error);
    throw error;
  }
}
