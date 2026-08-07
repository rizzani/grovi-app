import { databases, databaseId } from "./appwrite-client";
import { ID, Query, Permission, Role, Models } from "appwrite";
import { logPreferencesUpdated } from "./audit-service";

const USER_PREFERENCES_COLLECTION_ID = "user_preferences";

export interface UserPreferences {
  $id: string;
  userId: string;
  dietaryPreferences: string[];
  categoryPreferences: string[];
  createdAt: string;
  updatedAt: string;
}

type UserPreferencesDocument = Models.Document & UserPreferences;
type UserPreferencesCreateDocument = Models.Document & Omit<UserPreferences, "createdAt" | "updatedAt">;

export interface UpdatePreferencesParams {
  userId: string;
  dietaryPreferences?: string[];
  categoryPreferences?: string[];
}

/**
 * Retrieves user preferences by userId
 * @param userId - User ID
 * @returns Promise with the preferences or null if not found
 */
export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const result = await databases.listDocuments<UserPreferencesDocument>(
      databaseId,
      USER_PREFERENCES_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (result.documents.length === 0) {
      return null;
    }

    return result.documents[0];
  } catch (error: any) {
    const errorMessage = error.message || "Failed to retrieve preferences";
    console.error("Preferences retrieval error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Creates or updates user preferences
 * @param params - Preferences data
 * @returns Promise with the created/updated preferences
 */
export async function createOrUpdatePreferences(
  params: UpdatePreferencesParams
): Promise<UserPreferences> {
  try {
    const { userId, dietaryPreferences, categoryPreferences } = params;

    // Check if preferences already exist
    try {
      const existingPreferences = await databases.listDocuments<UserPreferencesDocument>(
        databaseId,
        USER_PREFERENCES_COLLECTION_ID,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      if (existingPreferences.documents.length > 0) {
        // Update existing preferences
        const existing = existingPreferences.documents[0];
        
        const updateData: any = {};

        if (dietaryPreferences !== undefined) {
          updateData.dietaryPreferences = dietaryPreferences;
        }
        if (categoryPreferences !== undefined) {
          updateData.categoryPreferences = categoryPreferences;
        }

        const updatedPreferences = await databases.updateDocument<UserPreferencesDocument>(
          databaseId,
          USER_PREFERENCES_COLLECTION_ID,
          existing.$id,
          updateData
        );

        // Log audit event (non-blocking)
        logPreferencesUpdated(userId, updateData).catch((error) => {
          console.warn("Failed to log preferences update:", error);
        });

        return updatedPreferences;
      }
    } catch (error: any) {
      // If query fails, continue to create new preferences
      if (error.code !== 404) {
        throw error;
      }
    }

    // Create new preferences with document-level permissions
    // Note: createdAt and updatedAt are automatically handled by Appwrite
    const newPreferences = await databases.createDocument<UserPreferencesCreateDocument>(
      databaseId,
      USER_PREFERENCES_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        dietaryPreferences: dietaryPreferences || [],
        categoryPreferences: categoryPreferences || [],
      },
      [
        Permission.read(Role.user(userId)),
        Permission.write(Role.user(userId)),
      ]
    );

    // Log audit event (non-blocking)
    logPreferencesUpdated(userId, {
      dietaryPreferences: dietaryPreferences || [],
      categoryPreferences: categoryPreferences || [],
    }).catch((error) => {
      console.warn("Failed to log preferences creation:", error);
    });

    return {
      ...newPreferences,
      userId,
      dietaryPreferences: dietaryPreferences || [],
      categoryPreferences: categoryPreferences || [],
      createdAt: newPreferences.$createdAt,
      updatedAt: newPreferences.$createdAt,
    };
  } catch (error: any) {
    const errorMessage = error.message || "Failed to create/update preferences";
    console.error("Preferences creation/update error:", errorMessage);
    throw new Error(errorMessage);
  }
}
