export const AnalyticsEvent = {
  AppOpened: "app_opened", UserSignedUp: "user_signed_up", UserLoggedIn: "user_logged_in",
  LocationSelected: "location_selected", ProductSearched: "product_searched", ProductViewed: "product_viewed",
  ProductAddedToCart: "product_added_to_cart", ProductRemovedFromCart: "product_removed_from_cart",
  CheckoutStarted: "checkout_started", CheckoutAbandoned: "checkout_abandoned", OrderPlaced: "order_placed", OrderCancelled: "order_cancelled",
} as const;
export type AnalyticsEventName = typeof AnalyticsEvent[keyof typeof AnalyticsEvent];
export type AnalyticsEventProperties = Record<string, string | number | boolean | null | undefined>;
export const isSupportedAnalyticsEvent = (eventName: string): eventName is AnalyticsEventName => Object.values(AnalyticsEvent).includes(eventName as AnalyticsEventName);
export const removeUndefinedProperties = (properties: AnalyticsEventProperties = {}) => Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined));
export function resolveSessionId(stored: string | null, now: number, createId: () => string, ttlMs: number): { id: string; createdAt: number; isNew: boolean } {
  try {
    if (stored) {
      const parsed = JSON.parse(stored) as { id?: string; createdAt?: number };
      if (parsed.id && parsed.createdAt && now - parsed.createdAt < ttlMs) return { id: parsed.id, createdAt: parsed.createdAt, isNew: false };
    }
  } catch { /* Generate a fresh session for malformed storage. */ }
  return { id: createId(), createdAt: now, isNew: true };
}
