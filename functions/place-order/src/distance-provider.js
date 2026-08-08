import { validateCoordinates } from "./delivery-pricing.js";

export class DistanceProviderError extends Error {
  constructor(message, cause) { super(message, { cause }); this.name = "DistanceProviderError"; }
}

export class OsrmDistanceProvider {
  constructor({ baseUrl = process.env.GROVI_ROUTING_PROVIDER_URL || "https://router.project-osrm.org", timeoutMs = Number(process.env.GROVI_ROUTING_TIMEOUT_MS || 5000), apiKey = process.env.GROVI_ROUTING_API_KEY, fetchImpl = fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async getDrivingDistance({ origin, destination }) {
    if (!validateCoordinates(origin) || !validateCoordinates(destination)) {
      throw new DistanceProviderError("Invalid route coordinates.");
    }
    const url = `${this.baseUrl}/route/v1/driving/${Number(origin.longitude)},${Number(origin.latitude)};${Number(destination.longitude)},${Number(destination.latitude)}?overview=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal, headers: { accept: "application/json", ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) } });
      if (!response.ok) throw new Error(`routing provider returned ${response.status}`);
      const body = await response.json();
      const route = body?.routes?.[0];
      if (!Number.isFinite(route?.distance) || route.distance < 0) throw new Error("routing provider returned no distance");
      return { distanceMeters: route.distance, durationSeconds: Number.isFinite(route.duration) ? route.duration : undefined };
    } catch (error) {
      throw new DistanceProviderError("Driving distance is unavailable.", error);
    } finally { clearTimeout(timeout); }
  }
}
