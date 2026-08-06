import * as Location from "expo-location";
import { normalizeJamaicaParish } from "./jamaica-parishes";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedLocation extends Coordinates {
  formattedAddress: string;
  parish?: string;
  community?: string;
  street?: string;
  houseDetails?: string;
}

export function isValidCoordinates(location: Coordinates): boolean {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && location.latitude >= -90 && location.latitude <= 90
    && location.longitude >= -180 && location.longitude <= 180;
}

export async function getCurrentLocation(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error("Location permission was denied. You can search for your address instead.");
  }
  const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const coordinates = { latitude: result.coords.latitude, longitude: result.coords.longitude };
  if (!isValidCoordinates(coordinates)) throw new Error("Your device returned an invalid location.");
  return coordinates;
}

function formatReverseGeocode(place: Location.LocationGeocodedAddress): string {
  return [place.name, place.street, place.city, place.subregion, place.region]
    .filter((part, index, values) => Boolean(part) && values.indexOf(part) === index).join(", ");
}

function fromAddress(place: Location.LocationGeocodedAddress, fallback: Coordinates): GeocodedLocation {
  return {
    ...fallback,
    formattedAddress: formatReverseGeocode(place) || `${fallback.latitude.toFixed(5)}, ${fallback.longitude.toFixed(5)}`,
    parish: normalizeJamaicaParish(place.subregion) || normalizeJamaicaParish(place.region),
    community: place.city || place.district || undefined,
    street: place.street || undefined,
    houseDetails: place.name && place.name !== place.street ? place.name : undefined,
  };
}

export async function geocodeAddress(address: string): Promise<GeocodedLocation[]> {
  if (!address.trim()) throw new Error("Enter an address to search.");
  const results = await Location.geocodeAsync(address.trim());
  return results.filter(isValidCoordinates).map((result) => fromAddress(result as unknown as Location.LocationGeocodedAddress, {
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

export async function reverseGeocode(coordinates: Coordinates): Promise<GeocodedLocation> {
  if (!isValidCoordinates(coordinates)) throw new Error("Please choose a valid map location.");
  const results = await Location.reverseGeocodeAsync(coordinates);
  return results[0] ? fromAddress(results[0], coordinates) : {
    ...coordinates,
    formattedAddress: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
  };
}

export function calculateDistance(from: Coordinates, to: Coordinates): number {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) throw new Error("Invalid coordinates.");
  const earthRadiusKm = 6371;
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
