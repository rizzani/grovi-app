export class CheckoutError extends Error {
  constructor(code, message, status = 400, details = undefined, retryable = false) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
  }
}

export function publicError(error) {
  if (error instanceof CheckoutError) return error;
  return new CheckoutError(
    "SERVICE_UNAVAILABLE",
    "Checkout is temporarily unavailable.",
    503,
    undefined,
    true,
  );
}
