import { Client, Databases, Query } from "node-appwrite";

const EARTH_RADIUS_KM = 6371;

export function isValidCoordinates(value) {
  return value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude))
    && Number(value.latitude) >= -90 && Number(value.latitude) <= 90
    && Number(value.longitude) >= -180 && Number(value.longitude) <= 180;
}

export function calculateDistance(from, to) {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) throw new Error("Invalid coordinates.");
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(Number(to.latitude) - Number(from.latitude));
  const dLon = radians(Number(to.longitude) - Number(from.longitude));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(Number(from.latitude)))
    * Math.cos(radians(Number(to.latitude))) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async ({ req, res, log, error }) => {
  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (!isValidCoordinates(input.customer)) return res.json({ ok: false, error: "A valid customer location is required." }, 400);
    let stores = Array.isArray(input.stores) ? input.stores : null;
    if (!stores) {
      const client = new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
      const db = new Databases(client);
      const result = await db.listDocuments(process.env.GROVI_DATABASE_ID, process.env.GROVI_STORE_LOCATIONS_COLLECTION_ID || "store_location", [Query.equal("is_active", true), Query.limit(100)]);
      stores = result.documents;
    }
    const distances = stores.filter((store) => isValidCoordinates(store)).map((store) => ({
      storeId: store.$id || store.id,
      distanceKm: Number(calculateDistance(input.customer, store).toFixed(3)),
      deliveryFeeJmdCents: null,
    })).sort((a, b) => a.distanceKm - b.distanceKm);
    return res.json({ ok: true, customer: input.customer, distances, deliveryFee: null });
  } catch (caught) {
    error(caught instanceof Error ? caught.message : String(caught));
    return res.json({ ok: false, error: "Distance calculation failed." }, 500);
  }
};
