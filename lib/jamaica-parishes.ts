/**
 * Jamaica Parishes - Complete list of all 14 parishes
 */
export const JAMAICA_PARISHES = [
  "Kingston & St. Andrew",
  "St. Catherine",
  "Clarendon",
  "Manchester",
  "St. Elizabeth",
  "Westmoreland",
  "Hanover",
  "St. James",
  "Trelawny",
  "St. Ann",
  "St. Mary",
  "Portland",
  "St. Thomas",
] as const;

export type JamaicaParish = typeof JAMAICA_PARISHES[number];

/**
 * Validates if a string is a valid Jamaica parish
 */
export function isValidJamaicaParish(parish: string): boolean {
  return JAMAICA_PARISHES.includes(parish as JamaicaParish);
}

/** Converts geocoder parish variants to the canonical form used by the form. */
export function normalizeJamaicaParish(value?: string | null): JamaicaParish | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/\s+parish$/i, "")
    .replace(/^saint\s+/i, "St. ")
    .replace(/^st\s+/i, "St. ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (normalized === "kingston" || normalized === "st. andrew" || normalized === "kingston and st. andrew") {
    return "Kingston & St. Andrew";
  }

  return JAMAICA_PARISHES.find((parish) => parish.toLowerCase() === normalized);
}
