export function formatOrderMoney(cents: number, currency = "JMD"): string {
  try {
    return new Intl.NumberFormat("en-JM", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return `J$${(cents / 100).toFixed(2)}`;
  }
}

export function formatOrderDate(value?: string, includeTime = false): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-JM", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

export function formatOrderLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
