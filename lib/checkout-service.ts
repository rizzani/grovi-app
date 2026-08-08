import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExecutionMethod } from "appwrite";
import * as Crypto from "expo-crypto";
import { functions } from "./appwrite-client";
import { reusableAttempt } from "./checkout-lifecycle";

export const CHECKOUT_FUNCTION_ID = "place-order";
export const DELIVERY_QUOTE_FUNCTION_ID = "quote-delivery";
export const CASH_ON_DELIVERY = "cash_on_delivery" as const;

export interface CheckoutRequest {
  schemaVersion: 1;
  addressId: string;
  paymentMethod: typeof CASH_ON_DELIVERY;
  cartRevision: string;
  clientRequestId: string;
}

export interface CheckoutSuccessData {
  orderId: string;
  orderNumber: string;
  status: "placed";
  paymentStatus: string;
  currency: "JMD";
  itemCount: number;
  storeCount: number;
  subtotalJmdCents: number;
  deliveryFeeJmdCents: number;
  discountJmdCents: number;
  totalJmdCents: number;
  deliveryDistanceMeters?: number;
  deliveryDurationSeconds?: number;
  deliveryPricingVersion?: string;
  consumedRevision: string;
  idempotentReplay: boolean;
  cartReconciliation?: "cleared" | "revision_changed" | "failed" | "unknown";
}

export interface CheckoutSuccessResponse { ok: true; data: CheckoutSuccessData }
export interface CheckoutErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
    requestId?: string;
  };
}

export type CheckoutResponse = CheckoutSuccessResponse | CheckoutErrorResponse;

export interface DeliveryQuoteData {
  addressId: string;
  cartRevision: string;
  subtotalJmdCents: number;
  deliveryFeeJmdCents: number;
  discountJmdCents: number;
  totalJmdCents: number;
  deliveryDistanceMeters: number;
  deliveryDurationSeconds?: number;
  deliveryPricingVersion: string;
}

interface DeliveryQuoteSuccessResponse { ok: true; data: DeliveryQuoteData }
interface DeliveryQuoteResponse { ok: false; error: { code: string; message: string; details?: Record<string, unknown>; retryable: boolean; requestId?: string } }

export async function getDeliveryQuote(addressId: string, cartRevision: string): Promise<DeliveryQuoteData> {
  const execution = await functions.createExecution({
    functionId: DELIVERY_QUOTE_FUNCTION_ID,
    body: JSON.stringify({ addressId, cartRevision }),
    async: false,
    method: ExecutionMethod.POST,
    headers: { "content-type": "application/json" },
  });
  let response: DeliveryQuoteSuccessResponse | DeliveryQuoteResponse;
  try { response = JSON.parse(execution.responseBody); }
  catch { throw new CheckoutError("DELIVERY_DISTANCE_UNAVAILABLE", "We couldn't calculate delivery pricing right now.", true); }
  if (!response.ok) throw new CheckoutError(response.error.code, response.error.message, response.error.retryable, response.error.details, response.error.requestId);
  return response.data;
}
export type CheckoutAttemptState = "ready" | "submitting" | "outcome_unknown" | "succeeded";

export interface CheckoutAttempt {
  version: 1;
  userId: string;
  request: CheckoutRequest;
  state: CheckoutAttemptState;
  createdAt: string;
  orderId?: string;
  successData?: CheckoutSuccessData;
  checkoutStartedTracked?: boolean;
}

export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

const storageKey = (userId: string) => `grovi_checkout_attempt_v1:${userId}`;

export function generateCheckoutId(): string {
  return Crypto.randomUUID();
}

export async function loadCheckoutAttempt(userId: string): Promise<CheckoutAttempt | null> {
  const value = await AsyncStorage.getItem(storageKey(userId));
  if (!value) return null;
  try {
    const attempt = JSON.parse(value) as CheckoutAttempt;
    return attempt.version === 1 && attempt.userId === userId ? attempt : null;
  } catch {
    await AsyncStorage.removeItem(storageKey(userId));
    return null;
  }
}

export async function persistCheckoutAttempt(attempt: CheckoutAttempt): Promise<void> {
  await AsyncStorage.setItem(storageKey(attempt.userId), JSON.stringify(attempt));
}

export async function cancelCheckoutAttempt(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}

export async function getOrCreateCheckoutAttempt(
  userId: string,
  addressId: string,
  cartRevision: string
): Promise<CheckoutAttempt> {
  const existing = await loadCheckoutAttempt(userId);
  const reusable = reusableAttempt(existing, { addressId, cartRevision, paymentMethod: CASH_ON_DELIVERY });
  if (reusable) return reusable;
  const attempt: CheckoutAttempt = {
    version: 1,
    userId,
    state: "ready",
    createdAt: new Date().toISOString(),
    request: {
      schemaVersion: 1,
      addressId,
      paymentMethod: CASH_ON_DELIVERY,
      cartRevision,
      clientRequestId: generateCheckoutId(),
    },
  };
  await persistCheckoutAttempt(attempt);
  return attempt;
}

export async function markCheckoutStarted(attempt: CheckoutAttempt): Promise<boolean> {
  if (attempt.checkoutStartedTracked) return false;
  await persistCheckoutAttempt({ ...attempt, checkoutStartedTracked: true });
  return true;
}

export async function executeCheckout(attempt: CheckoutAttempt): Promise<CheckoutSuccessData> {
  if (attempt.state === "succeeded" && attempt.successData) {
    if (__DEV__) console.log("[Checkout] Reusing completed checkout attempt", {
      checkoutAttemptId: attempt.request.clientRequestId,
      orderId: attempt.orderId,
      cartRevision: attempt.request.cartRevision,
    });
    return { ...attempt.successData, idempotentReplay: true };
  }
  await persistCheckoutAttempt({ ...attempt, state: "submitting" });
  try {
    const execution = await functions.createExecution({
      functionId: CHECKOUT_FUNCTION_ID,
      body: JSON.stringify(attempt.request),
      async: false,
      method: ExecutionMethod.POST,
      headers: { "content-type": "application/json" },
    });
    let response: CheckoutResponse;
    try {
      response = JSON.parse(execution.responseBody) as CheckoutResponse;
    } catch {
      if (__DEV__) {
        console.error("[Checkout] Function returned a non-JSON response", {
          executionId: execution.$id,
          status: execution.status,
          responseStatusCode: execution.responseStatusCode,
          responseBody: execution.responseBody,
          errors: execution.errors,
        });
      }
      throw new CheckoutError("INVALID_RESPONSE", "Checkout is temporarily unavailable.", true, {
        executionId: execution.$id,
        executionStatus: execution.status,
        responseStatusCode: execution.responseStatusCode,
      });
    }
    if (!response.ok) {
      throw new CheckoutError(
        response.error.code,
        response.error.message,
        response.error.retryable,
        response.error.details,
        response.error.requestId
      );
    }
    if (__DEV__) console.log("[Checkout] Appwrite order confirmed", {
      checkoutAttemptId: attempt.request.clientRequestId,
      orderId: response.data.orderId,
      cartRevision: response.data.consumedRevision,
      cartReconciliation: response.data.cartReconciliation,
    });
    await persistCheckoutAttempt({
      ...attempt,
      state: "succeeded",
      orderId: response.data.orderId,
      successData: response.data,
    });
    return response.data;
  } catch (error) {
    if (error instanceof CheckoutError && !error.retryable) throw error;
    await persistCheckoutAttempt({ ...attempt, state: "outcome_unknown" });
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(
      "SERVICE_UNAVAILABLE",
      "We could not confirm your order. Your cart is safe; retry to check the same order.",
      true
    );
  }
}
