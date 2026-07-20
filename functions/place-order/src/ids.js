import { createHash } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function requestFingerprint(userId, request) {
  return sha256(JSON.stringify({
    userId,
    addressId: request.addressId,
    paymentMethod: request.paymentMethod,
    cartRevision: request.cartRevision,
  }));
}

export function documentId(prefix, ...parts) {
  return `${prefix}_${sha256(parts.join("\u001f")).slice(0, 36 - prefix.length - 1)}`;
}

export function orderNumber(orderId) {
  return `GRV-${orderId.slice(-12).toUpperCase()}`;
}
