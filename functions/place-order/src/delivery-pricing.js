export const DELIVERY_PRICING_VERSION = "distance-bands-v1";
export const MAX_DELIVERY_DISTANCE_KM = 20;

// Money is represented as JMD cents throughout checkout (J$300 = 30000).
export function calculateDeliveryFeeJmdCents(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error("Invalid delivery distance.");
  if (distanceKm <= 3) return 30000;
  if (distanceKm <= 6) return 50000;
  if (distanceKm <= 10) return 70000;
  if (distanceKm <= 12) return 90000;
  if (distanceKm <= 14) return 100000;
  if (distanceKm <= 16) return 110000;
  if (distanceKm <= 18) return 120000;
  return 130000;
}

export function validateCoordinates(value) {
  return value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude))
    && Number(value.latitude) >= -90 && Number(value.latitude) <= 90
    && Number(value.longitude) >= -180 && Number(value.longitude) <= 180;
}

export function distanceKmFromMeters(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new Error("Invalid route distance.");
  return distanceMeters / 1000;
}
