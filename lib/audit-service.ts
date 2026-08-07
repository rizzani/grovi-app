import { databases, databaseId } from "./appwrite-client";
import { ID, Permission, Role } from "appwrite";

const AUDIT_LOGS_COLLECTION_ID = "audit_logs";

export type AuditEventType =
  | "profile.name_updated"
  | "profile.phone_change_requested"
  | "profile.phone_verified"
  | "profile.email_change_requested"
  | "profile.email_verified"
  | "address.created"
  | "address.updated"
  | "address.deleted"
  | "address.default_changed"
  | "preferences.updated"
  | "notifications.preferences_updated"
  | "notifications.push_token_updated"
  | "payment_method.removed";

export interface AuditLogMetadata {
  [key: string]: any;
  oldValue?: string | null;
  newValue?: string | null;
  field?: string;
}

export interface AuditLog {
  $id: string;
  userId: string;
  eventType: AuditEventType;
  metadata: AuditLogMetadata;
  timestamp: string;
  createdAt: string;
}

export interface CreateAuditLogParams {
  userId: string;
  eventType: AuditEventType;
  metadata?: AuditLogMetadata;
}

/**
 * Creates an audit log entry in the database
 * This function is non-blocking - errors are logged but don't throw
 * to ensure audit logging failures don't break the main application flow
 * 
 * @param params - Audit log parameters
 * @returns Promise that resolves when log is created (or silently fails)
 */
export async function createAuditLog(
  params: CreateAuditLogParams
): Promise<void> {
  try {
    const { userId, eventType, metadata = {} } = params;

    // Create audit log document with document-level permissions
    // Users can only create logs for themselves (security)
    await databases.createDocument(
      databaseId,
      AUDIT_LOGS_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        eventType,
        metadata: JSON.stringify(metadata), // Store as JSON string
        timestamp: new Date().toISOString(),
      },
      [
        Permission.read(Role.users()), // All users can read (for their own logs)
        Permission.write(Role.user(userId)), // Only the user can write their own logs
      ]
    );
  } catch (error: any) {
    // Silently fail - audit logging should never break the main flow
    // Log to console for debugging in development
    console.warn("[AuditService] Failed to create audit log:", {
      eventType: params.eventType,
      userId: params.userId,
      error: error.message,
    });
  }
}

/**
 * Logs a profile name update event
 * @param userId - User ID
 * @param oldName - Previous name value
 * @param newName - New name value
 */
export async function logNameUpdate(
  userId: string,
  oldName: string | undefined,
  newName: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "profile.name_updated",
    metadata: {
      field: "name",
      oldValue: oldName || null,
      newValue: newName,
    },
  });
}

/**
 * Logs a phone change request event
 * @param userId - User ID
 * @param oldPhone - Previous phone value
 * @param newPhone - New phone value
 */
export async function logPhoneChangeRequested(
  userId: string,
  oldPhone: string | undefined,
  newPhone: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "profile.phone_change_requested",
    metadata: {
      field: "phone",
      oldValue: oldPhone || null,
      newValue: newPhone,
    },
  });
}

/**
 * Logs a phone verification event
 * @param userId - User ID
 * @param phone - Verified phone number
 */
export async function logPhoneVerified(
  userId: string,
  phone: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "profile.phone_verified",
    metadata: {
      field: "phone",
      newValue: phone,
    },
  });
}

/**
 * Logs an email change request event
 * @param userId - User ID
 * @param oldEmail - Previous email value
 * @param newEmail - New email value
 */
export async function logEmailChangeRequested(
  userId: string,
  oldEmail: string | undefined,
  newEmail: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "profile.email_change_requested",
    metadata: {
      field: "email",
      oldValue: oldEmail || null,
      newValue: newEmail,
    },
  });
}

/**
 * Logs an email verification event
 * @param userId - User ID
 * @param email - Verified email address
 */
export async function logEmailVerified(
  userId: string,
  email: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "profile.email_verified",
    metadata: {
      field: "email",
      newValue: email,
    },
  });
}

/**
 * Logs an address creation event
 * @param userId - User ID
 * @param addressId - Address document ID
 * @param label - Address label (if any)
 */
export async function logAddressCreated(
  userId: string,
  addressId: string,
  label?: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "address.created",
    metadata: {
      addressId,
      label: label || null,
    },
  });
}

/**
 * Logs an address update event
 * @param userId - User ID
 * @param addressId - Address document ID
 * @param changes - Object containing changed fields
 */
export async function logAddressUpdated(
  userId: string,
  addressId: string,
  changes: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "address.updated",
    metadata: {
      addressId,
      changes: JSON.stringify(changes),
    },
  });
}

/**
 * Logs an address deletion event
 * @param userId - User ID
 * @param addressId - Address document ID
 */
export async function logAddressDeleted(
  userId: string,
  addressId: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "address.deleted",
    metadata: {
      addressId,
    },
  });
}

/**
 * Logs a default address change event
 * @param userId - User ID
 * @param addressId - Address document ID that was set as default
 * @param previousAddressId - Previous default address ID (if any)
 */
export async function logAddressDefaultChanged(
  userId: string,
  addressId: string,
  previousAddressId?: string
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "address.default_changed",
    metadata: {
      addressId,
      previousAddressId: previousAddressId || null,
    },
  });
}

/**
 * Logs a preferences update event
 * @param userId - User ID
 * @param changes - Object containing changed preference fields
 */
export async function logPreferencesUpdated(
  userId: string,
  changes: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "preferences.updated",
    metadata: {
      changes: JSON.stringify(changes),
    },
  });
}

/**
 * Logs a notification preferences update event
 * @param userId - User ID
 * @param changes - Object containing changed notification preference fields
 */
export async function logNotificationPreferencesUpdated(
  userId: string,
  changes: Record<string, any>
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "notifications.preferences_updated",
    metadata: {
      changes: JSON.stringify(changes),
    },
  });
}

/**
 * Logs a push token update event
 * @param userId - User ID
 * @param pushToken - New push token (or null if cleared)
 */
export async function logPushTokenUpdated(
  userId: string,
  pushToken: string | null
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "notifications.push_token_updated",
    metadata: {
      pushToken: pushToken || null,
    },
  });
}

/**
 * Logs a payment method removal event
 * @param userId - User ID
 * @param paymentMethodId - Payment method document ID
 * @param details - Payment method details (type, brand, last4)
 */
export async function logPaymentMethodRemoved(
  userId: string,
  paymentMethodId: string,
  details: {
    type: string;
    brand?: string | null;
    last4?: string | null;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    eventType: "payment_method.removed",
    metadata: {
      paymentMethodId,
      type: details.type,
      brand: details.brand || null,
      last4: details.last4 || null,
    },
  });
}
