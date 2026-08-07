import { databases, databaseId } from "./appwrite-client";
import { Query, Models } from "appwrite";
import { logPaymentMethodRemoved } from "./audit-service";

const PAYMENT_METHODS_COLLECTION_ID = "payment_methods";

export interface PaymentMethod {
  $id: string;
  userId: string;
  type: "card" | "cash_on_delivery" | "other"; // Type of payment method
  brand?: string; // Card brand (e.g., "Visa", "Mastercard") - only for cards
  last4?: string; // Last 4 digits of card - only for cards
  maskedNumber?: string; // Full masked number (e.g., "•••• 4242") - only for cards
  label?: string; // Optional label (e.g., "My Visa Card")
  createdAt: string;
}

type PaymentMethodDocument = Models.Document & PaymentMethod;

/**
 * Retrieves all payment methods for a user
 * @param userId - User ID
 * @returns Promise with array of payment methods, sorted by creation date (most recent first)
 */
export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  try {
    const result = await databases.listDocuments<PaymentMethodDocument>(
      databaseId,
      PAYMENT_METHODS_COLLECTION_ID,
      [Query.equal("userId", userId), Query.orderDesc("$createdAt")]
    );

    return result.documents;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to retrieve payment methods";
    console.error("Payment methods retrieval error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Deletes a payment method
 * @param paymentMethodId - Payment method document ID
 * @returns Promise that resolves when payment method is deleted
 */
export async function deletePaymentMethod(paymentMethodId: string): Promise<void> {
  try {
    // Get the payment method to check userId and get details for audit log
    const paymentMethod = await databases.getDocument<PaymentMethodDocument>(
      databaseId,
      PAYMENT_METHODS_COLLECTION_ID,
      paymentMethodId
    );

    const userId = paymentMethod.userId;

    // Delete the payment method
    await databases.deleteDocument(
      databaseId,
      PAYMENT_METHODS_COLLECTION_ID,
      paymentMethodId
    );

    // Log audit event (non-blocking)
    logPaymentMethodRemoved(userId, paymentMethodId, {
      type: paymentMethod.type,
      brand: paymentMethod.brand || null,
      last4: paymentMethod.last4 || null,
    }).catch((error) => {
      console.warn("Failed to log payment method removal:", error);
    });
  } catch (error: any) {
    const errorMessage = error.message || "Failed to delete payment method";
    console.error("Payment method deletion error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Formats a payment method for display
 * @param paymentMethod - Payment method to format
 * @returns Formatted string (e.g., "Visa •••• 4242" or "Cash on Delivery")
 */
export function formatPaymentMethod(paymentMethod: PaymentMethod): string {
  if (paymentMethod.type === "cash_on_delivery") {
    return "Cash on Delivery";
  }

  if (paymentMethod.type === "card") {
    const brand = paymentMethod.brand || "Card";
    const masked = paymentMethod.maskedNumber || (paymentMethod.last4 ? `•••• ${paymentMethod.last4}` : "••••");
    return `${brand} ${masked}`;
  }

  // Fallback for other types
  return paymentMethod.label || "Payment Method";
}
