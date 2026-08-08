import { Client } from "node-appwrite";
import { AppwriteRepository } from "./appwrite-repository.js";
import { quoteOrder } from "./checkout.js";
import { CheckoutError, publicError } from "./errors.js";

function header(headers, name) {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1] || "";
}

export default async ({ req, res, error: logError }) => {
  const requestId = header(req.headers, "x-appwrite-execution-id") || undefined;
  try {
    const userId = header(req.headers, "x-appwrite-user-id");
    if (!userId) throw new CheckoutError("UNAUTHENTICATED", "Authentication is required.", 401);
    const dynamicKey = header(req.headers, "x-appwrite-key");
    if (!dynamicKey) throw new CheckoutError("SERVICE_UNAVAILABLE", "Function credentials are unavailable.", 503, undefined, true);
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(dynamicKey);
    const repo = new AppwriteRepository(client);
    const input = req.bodyJson ?? JSON.parse(req.bodyText || "{}");
    if (!input || typeof input !== "object" || Array.isArray(input)
      || typeof input.addressId !== "string" || typeof input.cartRevision !== "string") {
      throw new CheckoutError("INVALID_REQUEST", "A delivery address and cart revision are required.", 400);
    }
    return res.json(await quoteOrder({ userId, addressId: input.addressId, cartRevision: input.cartRevision, repo }), 200);
  } catch (caught) {
    if (!(caught instanceof CheckoutError)) logError?.(caught?.stack || String(caught));
    const failure = publicError(caught);
    return res.json({ ok: false, error: { code: failure.code, message: failure.message, ...(failure.details ? { details: failure.details } : {}), retryable: failure.retryable, ...(requestId ? { requestId } : {}) } }, failure.status);
  }
};
