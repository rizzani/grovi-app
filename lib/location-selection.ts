import { GeocodedLocation } from "./location-utils";

let pendingLocation: GeocodedLocation | null = null;

export function setPendingLocation(location: GeocodedLocation): void {
  pendingLocation = location;
}

export function consumePendingLocation(): GeocodedLocation | null {
  const location = pendingLocation;
  pendingLocation = null;
  return location;
}
