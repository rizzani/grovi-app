import { Query } from "appwrite";
import { AnalyticsEventName } from "./analytics-core";
export const ANALYTICS_COLLECTION_ID = "analytics_events";

export interface AnalyticsDocument { $id: string; eventName: AnalyticsEventName; propertiesJson: string; createdAt: string; [key: string]: unknown; }
export interface AnalyticsPage { documents: AnalyticsDocument[]; hasMore: boolean; nextOffset: number; }
export interface AnalyticsMetrics {
  totalByEventName: Record<string, number>;
  totalOrdersPlaced: number;
  checkoutStarts: number;
  checkoutCompletionRate: number;
  totalOrderValue: number;
  averageOrderValue: number;
  zeroResultSearches: number;
  mostViewedProducts: { productId: string; count: number }[];
  mostAddedToCartProducts: { productId: string; count: number }[];
}

export function summarizeAnalyticsEvents(events: AnalyticsDocument[]): AnalyticsMetrics {
  const totalByEventName: Record<string, number> = {};
  const viewed: Record<string, number> = {};
  const added: Record<string, number> = {};
  let totalOrderValue = 0;
  let totalOrdersPlaced = 0;
  let zeroResultSearches = 0;
  for (const event of events) {
    totalByEventName[event.eventName] = (totalByEventName[event.eventName] || 0) + 1;
    let properties: Record<string, unknown> = {};
    try { properties = JSON.parse(event.propertiesJson || "{}"); } catch { /* Ignore malformed legacy records. */ }
    if (event.eventName === "order_placed") { totalOrdersPlaced++; totalOrderValue += Number(properties.orderValue || 0); }
    if (event.eventName === "product_searched" && Number(properties.resultCount) === 0) zeroResultSearches++;
    if (event.eventName === "product_viewed" && typeof properties.productId === "string") viewed[properties.productId] = (viewed[properties.productId] || 0) + 1;
    if (event.eventName === "product_added_to_cart" && typeof properties.productId === "string") added[properties.productId] = (added[properties.productId] || 0) + 1;
  }
  const rank = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([productId, count]) => ({ productId, count }));
  const checkoutStarts = totalByEventName.checkout_started || 0;
  return { totalByEventName, totalOrdersPlaced, checkoutStarts, checkoutCompletionRate: checkoutStarts ? totalOrdersPlaced / checkoutStarts : 0, totalOrderValue, averageOrderValue: totalOrdersPlaced ? totalOrderValue / totalOrdersPlaced : 0, zeroResultSearches, mostViewedProducts: rank(viewed), mostAddedToCartProducts: rank(added) };
}

/** Paginated helper for trusted/admin callers. The client collection intentionally has no read permission. */
export async function listAnalyticsEvents(
  databases: { listDocuments: (databaseId: string, collectionId: string, queries?: string[]) => Promise<{ documents: AnalyticsDocument[]; total: number }> },
  databaseId: string,
  options: { eventName?: AnalyticsEventName; limit?: number; offset?: number } = {}
): Promise<AnalyticsPage> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const queries = [Query.limit(limit), Query.offset(options.offset ?? 0), Query.orderDesc("createdAt")];
  if (options.eventName) queries.push(Query.equal("eventName", options.eventName));
  const result = await databases.listDocuments(databaseId, ANALYTICS_COLLECTION_ID, queries);
  return { documents: result.documents, hasMore: result.documents.length === limit, nextOffset: (options.offset ?? 0) + result.documents.length };
}
