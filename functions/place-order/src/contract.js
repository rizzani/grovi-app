import { CheckoutError } from "./errors.js";

const ALLOWED_FIELDS = new Set([
  "schemaVersion",
  "addressId",
  "paymentMethod",
  "cartRevision",
  "clientRequestId",
]);

function boundedString(value, field, max) {
  if (typeof value !== "string" || value.length === 0 || value.length > max || value.trim() !== value) {
    throw new CheckoutError("INVALID_REQUEST", `${field} is invalid.`, 400, { field });
  }
  return value;
}

export function validateRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CheckoutError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }
  const unknown = Object.keys(input).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) {
    throw new CheckoutError("INVALID_REQUEST", "Request contains unsupported fields.", 400, { fields: unknown });
  }
  if (input.schemaVersion !== 1) {
    throw new CheckoutError("INVALID_REQUEST", "schemaVersion must be 1.", 400, { field: "schemaVersion" });
  }
  if (input.paymentMethod !== "cash_on_delivery") {
    throw new CheckoutError("INVALID_REQUEST", "Only cash_on_delivery is supported.", 400, { field: "paymentMethod" });
  }
  return {
    schemaVersion: 1,
    addressId: boundedString(input.addressId, "addressId", 36),
    paymentMethod: input.paymentMethod,
    cartRevision: boundedString(input.cartRevision, "cartRevision", 50),
    clientRequestId: boundedString(input.clientRequestId, "clientRequestId", 255),
  };
}

export function parseCart(cartDocument) {
  let items;
  try {
    items = typeof cartDocument.items === "string" ? JSON.parse(cartDocument.items) : cartDocument.items;
  } catch {
    throw new CheckoutError("ORDER_CREATION_FAILED", "Stored cart data is malformed.", 500);
  }
  if (!Array.isArray(items)) {
    throw new CheckoutError("ORDER_CREATION_FAILED", "Stored cart data is malformed.", 500);
  }
  if (items.length === 0) {
    throw new CheckoutError("EMPTY_CART", "The cart is empty.", 409);
  }
  return items;
}
