import { databases, databaseId } from "./appwrite-client";
import { ID, Query, Permission, Role, Models } from "appwrite";
import {
  logNotificationPreferencesUpdated,
  logPushTokenUpdated,
} from "./audit-service";

const NOTIFICATION_PREFERENCES_COLLECTION_ID = "notification_preferences";

export interface NotificationPreferences {
  $id: string;
  userId: string;
  // Notification types
  orderUpdatesEnabled: boolean;
  promotionsEnabled: boolean;
  // Notification channels
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  // Push token (stored when push is enabled)
  pushToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

type NotificationPreferencesDocument = Models.Document & NotificationPreferences;
type NotificationPreferencesCreateDocument = Models.Document & Omit<NotificationPreferences, "createdAt" | "updatedAt">;

export interface UpdateNotificationPreferencesParams {
  userId: string;
  orderUpdatesEnabled?: boolean;
  promotionsEnabled?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushToken?: string;
}

/**
 * Retrieves notification preferences by userId
 * @param userId - User ID
 * @returns Promise with the preferences or null if not found
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  try {
    const result = await databases.listDocuments<NotificationPreferencesDocument>(
      databaseId,
      NOTIFICATION_PREFERENCES_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (result.documents.length === 0) {
      return null;
    }

    return result.documents[0];
  } catch (error: any) {
    const errorMessage = error.message || "Failed to retrieve notification preferences";
    console.error("Notification preferences retrieval error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Creates or updates notification preferences
 * @param params - Preferences data
 * @returns Promise with the created/updated preferences
 */
export async function createOrUpdateNotificationPreferences(
  params: UpdateNotificationPreferencesParams
): Promise<NotificationPreferences> {
  try {
    const {
      userId,
      orderUpdatesEnabled,
      promotionsEnabled,
      pushEnabled,
      emailEnabled,
      smsEnabled,
      pushToken,
    } = params;

    // Check if preferences already exist
    let existingPreferences: NotificationPreferences | null = null;
    try {
      const result = await databases.listDocuments<NotificationPreferencesDocument>(
        databaseId,
        NOTIFICATION_PREFERENCES_COLLECTION_ID,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      if (result.documents.length > 0) {
        existingPreferences = result.documents[0];
      }
    } catch (error: any) {
      // If query fails, continue to create new preferences
      if (error.code !== 404) {
        throw error;
      }
    }

    if (existingPreferences) {
      // Update existing preferences
      const updateData: any = {};
      const changes: any = {};

      if (orderUpdatesEnabled !== undefined) {
        updateData.orderUpdatesEnabled = orderUpdatesEnabled;
        changes.orderUpdatesEnabled = orderUpdatesEnabled;
      }
      if (promotionsEnabled !== undefined) {
        updateData.promotionsEnabled = promotionsEnabled;
        changes.promotionsEnabled = promotionsEnabled;
      }
      if (pushEnabled !== undefined) {
        updateData.pushEnabled = pushEnabled;
        changes.pushEnabled = pushEnabled;
        // Clear push token if push is disabled
        if (!pushEnabled) {
          updateData.pushToken = null;
          changes.pushToken = null;
        }
      }
      if (emailEnabled !== undefined) {
        updateData.emailEnabled = emailEnabled;
        changes.emailEnabled = emailEnabled;
      }
      if (smsEnabled !== undefined) {
        updateData.smsEnabled = smsEnabled;
        changes.smsEnabled = smsEnabled;
      }
      if (pushToken !== undefined) {
        // Update token (can be null to clear it, or a string to set it)
        const currentPushEnabled = pushEnabled !== undefined ? pushEnabled : existingPreferences.pushEnabled;
        if (currentPushEnabled || pushToken === null) {
          // Update token if push is enabled, or if explicitly clearing (null)
          updateData.pushToken = pushToken;
          // Only log token update if it actually changed
          if (pushToken !== existingPreferences.pushToken) {
            changes.pushToken = pushToken;
          }
        }
      }

      const updatedPreferences = await databases.updateDocument<NotificationPreferencesDocument>(
        databaseId,
        NOTIFICATION_PREFERENCES_COLLECTION_ID,
        existingPreferences.$id,
        updateData
      );

      // Log audit events (non-blocking)
      if (Object.keys(changes).length > 0) {
        // Check if this is a token update or preference update
        const isTokenUpdate = changes.pushToken !== undefined && Object.keys(changes).length === 1;
        
        if (isTokenUpdate) {
          logPushTokenUpdated(userId, pushToken || null).catch((error) => {
            console.warn("Failed to log push token update:", error);
          });
        } else {
          // Remove pushToken from changes for preferences update log
          const preferencesChanges = { ...changes };
          delete preferencesChanges.pushToken;
          
          if (Object.keys(preferencesChanges).length > 0) {
            logNotificationPreferencesUpdated(userId, preferencesChanges).catch((error) => {
              console.warn("Failed to log notification preferences update:", error);
            });
          }
          
          // If token was also updated, log it separately
          if (changes.pushToken !== undefined) {
            logPushTokenUpdated(userId, pushToken || null).catch((error) => {
              console.warn("Failed to log push token update:", error);
            });
          }
        }
      }

      return updatedPreferences;
    }

    // Create new preferences with default values
    const defaultPreferences: NotificationPreferences = {
      $id: "",
      userId,
      orderUpdatesEnabled: orderUpdatesEnabled ?? true,
      promotionsEnabled: promotionsEnabled ?? true,
      pushEnabled: pushEnabled ?? false,
      emailEnabled: emailEnabled ?? true,
      smsEnabled: smsEnabled ?? false,
      pushToken: pushToken || null,
      createdAt: "",
      updatedAt: "",
    };

    const newPreferences = await databases.createDocument<NotificationPreferencesCreateDocument>(
      databaseId,
      NOTIFICATION_PREFERENCES_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        orderUpdatesEnabled: defaultPreferences.orderUpdatesEnabled,
        promotionsEnabled: defaultPreferences.promotionsEnabled,
        pushEnabled: defaultPreferences.pushEnabled,
        emailEnabled: defaultPreferences.emailEnabled,
        smsEnabled: defaultPreferences.smsEnabled,
        pushToken: defaultPreferences.pushToken || null,
      },
      [
        Permission.read(Role.user(userId)),
        Permission.write(Role.user(userId)),
      ]
    );

    // Log audit event (non-blocking)
    const initialChanges: any = {
      orderUpdatesEnabled: defaultPreferences.orderUpdatesEnabled,
      promotionsEnabled: defaultPreferences.promotionsEnabled,
      pushEnabled: defaultPreferences.pushEnabled,
      emailEnabled: defaultPreferences.emailEnabled,
      smsEnabled: defaultPreferences.smsEnabled,
    };
    
    logNotificationPreferencesUpdated(userId, initialChanges).catch((error) => {
      console.warn("Failed to log notification preferences creation:", error);
    });

    if (defaultPreferences.pushToken) {
      logPushTokenUpdated(userId, defaultPreferences.pushToken).catch((error) => {
        console.warn("Failed to log push token creation:", error);
      });
    }

    return {
      ...newPreferences,
      userId,
      orderUpdatesEnabled: defaultPreferences.orderUpdatesEnabled,
      promotionsEnabled: defaultPreferences.promotionsEnabled,
      pushEnabled: defaultPreferences.pushEnabled,
      emailEnabled: defaultPreferences.emailEnabled,
      smsEnabled: defaultPreferences.smsEnabled,
      pushToken: defaultPreferences.pushToken,
      createdAt: newPreferences.$createdAt,
      updatedAt: newPreferences.$createdAt,
    };
  } catch (error: any) {
    const errorMessage =
      error.message || "Failed to create/update notification preferences";
    console.error("Notification preferences creation/update error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Updates only the push token (for token refresh scenarios)
 * @param userId - User ID
 * @param pushToken - New push token
 * @returns Promise with the updated preferences
 */
export async function updatePushToken(
  userId: string,
  pushToken: string | null
): Promise<NotificationPreferences> {
  try {
    const existing = await getNotificationPreferences(userId);
    
    if (!existing) {
      // Create new preferences with just the push token
      return await createOrUpdateNotificationPreferences({
        userId,
        pushEnabled: pushToken !== null,
        pushToken: pushToken !== null ? pushToken : undefined,
      });
    }

    // Update existing preferences
    // If pushToken is null, we need to explicitly set it to null to clear it
    // If pushToken is a string, update it
    const updateParams: any = {
      userId,
    };
    
    if (pushToken === null) {
      // Explicitly clear the token
      updateParams.pushToken = null;
    } else if (pushToken) {
      // Update with new token
      updateParams.pushToken = pushToken;
    }
    // If pushToken is undefined, don't update it
    
    return await createOrUpdateNotificationPreferences(updateParams);
  } catch (error: any) {
    const errorMessage = error.message || "Failed to update push token";
    console.error("Push token update error:", errorMessage);
    throw new Error(errorMessage);
  }
}
