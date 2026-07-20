import { HOME_FEED_CONFIG } from "./home-feed-config";
import type { SearchResult } from "./search-service";

export type HomeProduct = SearchResult;

const numberOrZero = (value: number | null | undefined): number =>
  Number.isFinite(value) ? (value as number) : 0;

const timestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function isEligibleProduct(result: HomeProduct): boolean {
  return result.inStock && result.product.isActive !== false;
}

export function calculateDiscountPercentage(
  regularPrice: number,
  salePrice?: number | null
): number {
  if (!Number.isFinite(regularPrice) || regularPrice <= 0 ||
      !Number.isFinite(salePrice) || (salePrice as number) <= 0 ||
      (salePrice as number) >= regularPrice) return 0;
  return Math.round(((regularPrice - (salePrice as number)) / regularPrice) * 100);
}

export function isPromotionActive(product: HomeProduct["product"], now: Date): boolean {
  const current = now.getTime();
  return (!product.promotionStartAt || timestamp(product.promotionStartAt) <= current) &&
    (!product.promotionEndAt || timestamp(product.promotionEndAt) >= current);
}

export function getSalePrice(result: HomeProduct): number | null {
  return result.storeProductSalePrice ?? result.product.salePrice ?? null;
}

export function isActiveDeal(result: HomeProduct, now: Date): boolean {
  return isEligibleProduct(result) && isPromotionActive(result.product, now) &&
    calculateDiscountPercentage(result.priceJmdCents, getSalePrice(result)) > 0;
}

export function isActiveFeatured(result: HomeProduct, now: Date): boolean {
  const product = result.product;
  const current = now.getTime();
  return isEligibleProduct(result) && product.isFeatured === true &&
    (!product.featuredStartAt || timestamp(product.featuredStartAt) <= current) &&
    (!product.featuredEndAt || timestamp(product.featuredEndAt) >= current);
}

export function realActivity(result: HomeProduct): number {
  const product = result.product;
  return numberOrZero(product.viewCount) + numberOrZero(product.cartAddCount) +
    numberOrZero(product.orderCount);
}

export function popularityScore(result: HomeProduct, coldStart: boolean): number {
  const product = result.product;
  const weights = coldStart
    ? HOME_FEED_CONFIG.popularityWeights.coldStart
    : HOME_FEED_CONFIG.popularityWeights.real;
  let score = numberOrZero(product.orderCount) * weights.order +
    numberOrZero(product.cartAddCount) * weights.cartAdd +
    numberOrZero(product.viewCount) * weights.view +
    numberOrZero(product.manualPopularityScore) * weights.manual;
  if (coldStart) {
    if (product.isFeatured) score += HOME_FEED_CONFIG.coldStartBonuses.featured;
    if (product.isEssential) score += HOME_FEED_CONFIG.coldStartBonuses.essential;
    if (isActiveDeal(result, new Date())) score += HOME_FEED_CONFIG.coldStartBonuses.deal;
  }
  return score;
}

export function rankFeatured(items: HomeProduct[], now: Date): HomeProduct[] {
  return items.filter((item) => isActiveFeatured(item, now)).sort((a, b) =>
    numberOrZero(b.product.featuredPriority) - numberOrZero(a.product.featuredPriority) ||
    timestamp(b.product.$createdAt ?? b.product.createdAt) - timestamp(a.product.$createdAt ?? a.product.createdAt));
}

export function rankDeals(items: HomeProduct[], now: Date): HomeProduct[] {
  return items.filter((item) => isActiveDeal(item, now)).sort((a, b) =>
    calculateDiscountPercentage(b.priceJmdCents, getSalePrice(b)) -
      calculateDiscountPercentage(a.priceJmdCents, getSalePrice(a)) ||
    numberOrZero(b.product.featuredPriority) - numberOrZero(a.product.featuredPriority) ||
    timestamp(b.product.$createdAt ?? b.product.createdAt) - timestamp(a.product.$createdAt ?? a.product.createdAt));
}

export function rankNewProducts(items: HomeProduct[], now: Date): HomeProduct[] {
  const eligible = items.filter(isEligibleProduct).sort((a, b) =>
    timestamp(b.product.$createdAt ?? b.product.createdAt) - timestamp(a.product.$createdAt ?? a.product.createdAt));
  const cutoff = now.getTime() - HOME_FEED_CONFIG.recentDays * 86_400_000;
  const recent = eligible.filter((item) => timestamp(item.product.$createdAt ?? item.product.createdAt) >= cutoff);
  return recent.length >= HOME_FEED_CONFIG.minimumItems ? recent : eligible;
}

export function rankPopular(items: HomeProduct[]): { items: HomeProduct[]; coldStart: boolean } {
  const eligible = items.filter(isEligibleProduct);
  const coldStart = eligible.reduce((sum, item) => sum + realActivity(item), 0) < HOME_FEED_CONFIG.minRealActivity;
  return { coldStart, items: [...eligible].sort((a, b) => popularityScore(b, coldStart) - popularityScore(a, coldStart)) };
}

export function visibleSection(items: HomeProduct[]): HomeProduct[] {
  return items.length >= HOME_FEED_CONFIG.minimumItems
    ? items.slice(0, HOME_FEED_CONFIG.sectionLimit) : [];
}

export function preferLocalWithFallback(local: HomeProduct[], fallback: HomeProduct[]): HomeProduct[] {
  if (local.length >= HOME_FEED_CONFIG.minimumItems) return local;
  const seen = new Set(local.map((item) => item.product.$id));
  return [...local, ...fallback.filter((item) => !seen.has(item.product.$id))];
}
