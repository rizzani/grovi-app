import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExecutionMethod } from "appwrite";
import * as Crypto from "expo-crypto";
import { functions } from "./appwrite-client";
import { reusableAttempt } from "./checkout-lifecycle";

export const CHECKOUT_FUNCTION_ID = "place-order";
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
  consumedRevision: string;
  idempotentReplay: boolean;
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
export type CheckoutAttemptState = "ready" | "submitting" | "outcome_unknown" | "succeeded";

export interface CheckoutAttempt {
  version: 1;
  userId: string;
  request: CheckoutRequest;
  state: CheckoutAttemptState;
  createdAt: string;
  orderId?: string;
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

export async function executeCheckout(attempt: CheckoutAttempt): Promise<CheckoutSuccessData> {
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
    await persistCheckoutAttempt({ ...attempt, state: "succeeded", orderId: response.data.orderId });
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
