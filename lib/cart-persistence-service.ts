import { ID, Query, Permission, Role } from "appwrite";
import { databases, databaseId } from "./appwrite-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cart, CartItem } from "./cart-service";

/**
 * Cart Persistence Service
 * 
 * Handles cart storage for both logged-in and anonymous users:
 * - Logged-in users: Cart stored in Appwrite database (syncs across devices)
 * - Anonymous users: Cart stored locally in AsyncStorage
 * - Automatic cart merging when user logs in
 */

const CARTS_COLLECTION_ID = "carts";
const ANONYMOUS_CART_STORAGE_KEY = "grovi_cart_anonymous";
const ANONYMOUS_USER_ID_KEY = "grovi_anonymous_user_id";
const LEGACY_CART_STORAGE_KEY = "grovi_cart"; // Old key for backward compatibility

/**
 * Get or create anonymous user ID for local cart tracking
 */
async function getAnonymousUserId(): Promise<string> {
  let anonymousId = await AsyncStorage.getItem(ANONYMOUS_USER_ID_KEY);
  if (!anonymousId) {
    anonymousId = `anonymous_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await AsyncStorage.setItem(ANONYMOUS_USER_ID_KEY, anonymousId);
  }
  return anonymousId;
}

/**
 * Get cart from server (for logged-in users)
 */
export async function getServerCart(userId: string): Promise<Cart | null> {
  try {
    const result = await databases.listDocuments(
      databaseId,
      CARTS_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (result.documents.length > 0) {
      const cartDoc = result.documents[0];
      // Parse JSON strings for items and storeIds
      let items: CartItem[] = [];
      let storeIds: string[] = [];
      
      try {
        if (typeof cartDoc.items === "string") {
          items = JSON.parse(cartDoc.items);
        } else if (Array.isArray(cartDoc.items)) {
          items = cartDoc.items;
        }
      } catch (e) {
        console.warn("Error parsing cart items:", e);
      }

      try {
        if (typeof cartDoc.storeIds === "string") {
          storeIds = JSON.parse(cartDoc.storeIds);
        } else if (Array.isArray(cartDoc.storeIds)) {
          storeIds = cartDoc.storeIds;
        }
      } catch (e) {
        console.warn("Error parsing storeIds:", e);
      }

      return {
        items,
        totalItems: cartDoc.totalItems || 0,
        totalPriceJmdCents: cartDoc.totalPriceJmdCents || 0,
        storeIds,
        updatedAt: cartDoc.updatedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching cart from server:", error);
    return null;
  }
}

/** Return the persisted cart and its authoritative checkout revision. */
export async function getServerCartSnapshot(userId: string): Promise<Cart | null> {
  return getServerCart(userId);
}

/**
 * Clear a purchased cart only when it is still the exact revision consumed by checkout.
 * The write is awaited so callers can distinguish a successful clear from a retryable one.
 */
export async function clearServerCartIfRevisionMatches(
  userId: string,
  consumedRevision: string
): Promise<"cleared" | "revision_changed"> {
  const current = await getServerCart(userId);
  if (!current || current.updatedAt !== consumedRevision) return "revision_changed";

  await saveServerCart(userId, {
    items: [],
    totalItems: 0,
    totalPriceJmdCents: 0,
    storeIds: [],
    updatedAt: new Date().toISOString(),
  });
  return "cleared";
}

/**
 * Save cart to server (for logged-in users)
 */
export async function saveServerCart(userId: string, cart: Cart): Promise<void> {
  try {
    // Check if cart document exists
    const existing = await databases.listDocuments(
      databaseId,
      CARTS_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    // Serialize arrays to JSON strings for Appwrite storage
    // Handle empty arrays by storing as empty JSON array string
    const cartData: any = {
      userId,
      items: cart.items && cart.items.length > 0 ? JSON.stringify(cart.items) : "[]",
      totalItems: cart.totalItems || 0,
      totalPriceJmdCents: cart.totalPriceJmdCents || 0,
      storeIds: cart.storeIds && cart.storeIds.length > 0 ? JSON.stringify(cart.storeIds) : "[]",
      updatedAt: new Date().toISOString(),
    };

    if (existing.documents.length > 0) {
      // Update existing cart
      await databases.updateDocument(
        databaseId,
        CARTS_COLLECTION_ID,
        existing.documents[0].$id,
        cartData,
        [
          Permission.read(Role.user(userId)),
          Permission.write(Role.user(userId)),
        ]
      );
      if (__DEV__) {
        console.log("[CartPersistence] Cart updated successfully for user:", userId);
      }
    } else {
      // Create new cart
      await databases.createDocument(
        databaseId,
        CARTS_COLLECTION_ID,
        ID.unique(),
        cartData,
        [
          Permission.read(Role.user(userId)),
          Permission.write(Role.user(userId)),
        ]
      );
      if (__DEV__) {
        console.log("[CartPersistence] Cart created successfully for user:", userId);
      }
    }
  } catch (error: any) {
    // Check if error is about missing attributes
    if (error.message && error.message.includes("Unknown attribute")) {
      console.error(
        "[CartPersistence] Cart collection attributes are missing. Please run: npm run setup-database"
      );
      throw new Error(
        "Cart collection is missing required attributes. Please run 'npm run setup-database' to fix this."
      );
    }
    console.error("Error saving cart to server:", error);
    throw error;
  }
}

/**
 * Get cart from local storage (for anonymous users)
 * Also migrates legacy cart if it exists
 */
export async function getLocalCart(): Promise<Cart | null> {
  try {
    // Try new key first
    let stored = await AsyncStorage.getItem(ANONYMOUS_CART_STORAGE_KEY);
    
    // If not found, try legacy key and migrate
    if (!stored) {
      const legacyStored = await AsyncStorage.getItem(LEGACY_CART_STORAGE_KEY);
      if (legacyStored) {
        // Migrate legacy cart to new key
        await AsyncStorage.setItem(ANONYMOUS_CART_STORAGE_KEY, legacyStored);
        await AsyncStorage.removeItem(LEGACY_CART_STORAGE_KEY);
        stored = legacyStored;
        if (__DEV__) {
          console.log("[CartPersistence] Migrated legacy cart to new key");
        }
      }
    }
    
    if (stored) {
      return JSON.parse(stored) as Cart;
    }
    return null;
  } catch (error) {
    console.error("Error loading local cart:", error);
    return null;
  }
}

/**
 * Save cart to local storage (for anonymous users)
 */
export async function saveLocalCart(cart: Cart): Promise<void> {
  try {
    await AsyncStorage.setItem(ANONYMOUS_CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error("Error saving local cart:", error);
    throw error;
  }
}

/**
 * Clear local cart storage
 */
export async function clearLocalCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ANONYMOUS_CART_STORAGE_KEY);
    await AsyncStorage.removeItem(ANONYMOUS_USER_ID_KEY);
  } catch (error) {
    console.error("Error clearing local cart:", error);
  }
}

/**
 * Merge two carts intelligently
 * - Combines items from both carts
 * - For duplicate items (same productId + storeId), uses the higher quantity
 * - Preserves most recent timestamps
 */
export function mergeCarts(localCart: Cart, serverCart: Cart): Cart {
  const mergedItems: CartItem[] = [];
  const itemMap = new Map<string, CartItem>();

  // Add all items from both carts to map
  // Key: `${productId}_${storeId}`
  [...localCart.items, ...serverCart.items].forEach((item) => {
    const key = `${item.productId}_${item.storeId}`;
    const existing = itemMap.get(key);

    if (!existing) {
      itemMap.set(key, { ...item });
    } else {
      // Merge: use higher quantity, most recent addedAt
      const mergedItem: CartItem = {
        ...existing,
        quantity: Math.max(existing.quantity, item.quantity),
        addedAt: existing.addedAt > item.addedAt ? existing.addedAt : item.addedAt,
        // Use most recent price
        priceJmdCents: existing.addedAt > item.addedAt ? existing.priceJmdCents : item.priceJmdCents,
        // Prefer non-null values for optional fields
        brand: existing.brand || item.brand,
        imageUrl: existing.imageUrl || item.imageUrl,
        storeLogoUrl: existing.storeLogoUrl || item.storeLogoUrl,
      };
      itemMap.set(key, mergedItem);
    }
  });

  mergedItems.push(...Array.from(itemMap.values()));

  // Calculate totals
  const totalItems = mergedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPriceJmdCents = mergedItems.reduce(
    (sum, item) => sum + item.priceJmdCents * item.quantity,
    0
  );
  const storeIds = Array.from(new Set(mergedItems.map((item) => item.storeId)));

  return {
    items: mergedItems,
    totalItems,
    totalPriceJmdCents,
    storeIds,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get cart based on authentication status
 * Returns the appropriate cart (server for logged-in, local for anonymous)
 */
export async function getCartForUser(
  userId: string | null,
  isAuthenticated: boolean
): Promise<Cart> {
  if (isAuthenticated && userId) {
    // Try to get from server
    const serverCart = await getServerCart(userId);
    if (serverCart) {
      return serverCart;
    }
    // If no server cart, check if there's a local cart to migrate
    const localCart = await getLocalCart();
    if (localCart && localCart.items.length > 0) {
      // Migrate local cart to server
      await saveServerCart(userId, localCart);
      // Clear local cart after migration
      await clearLocalCart();
      return localCart;
    }
    // Return empty cart
    return {
      items: [],
      totalItems: 0,
      totalPriceJmdCents: 0,
      storeIds: [],
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Anonymous user - get from local storage
    const localCart = await getLocalCart();
    if (localCart) {
      return localCart;
    }
    // Return empty cart
    return {
      items: [],
      totalItems: 0,
      totalPriceJmdCents: 0,
      storeIds: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save cart based on authentication status
 */
export async function saveCartForUser(
  userId: string | null,
  isAuthenticated: boolean,
  cart: Cart
): Promise<void> {
  if (isAuthenticated && userId) {
    // Save to server
    await saveServerCart(userId, cart);
    // Also clear any leftover local cart
    await clearLocalCart();
  } else {
    // Save to local storage
    await saveLocalCart(cart);
  }
}

/**
 * Migrate local cart to server when user logs in
 * Merges local and server carts if both exist
 */
export async function migrateCartOnLogin(userId: string): Promise<Cart> {
  const localCart = await getLocalCart();
  const serverCart = await getServerCart(userId);

  let finalCart: Cart;

  if (localCart && localCart.items.length > 0) {
    if (serverCart && serverCart.items.length > 0) {
      // Both exist - merge them
      finalCart = mergeCarts(localCart, serverCart);
    } else {
      // Only local exists - use it
      finalCart = localCart;
    }
  } else if (serverCart) {
    // Only server exists - use it
    finalCart = serverCart;
  } else {
    // Neither exists - empty cart
    finalCart = {
      items: [],
      totalItems: 0,
      totalPriceJmdCents: 0,
      storeIds: [],
      updatedAt: new Date().toISOString(),
    };
  }

  // Save merged/migrated cart to server
  await saveServerCart(userId, finalCart);
  // Clear local cart after migration
  await clearLocalCart();

  return finalCart;
}
