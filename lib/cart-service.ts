import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearServerCartIfRevisionMatches,
  getCartForUser,
  getServerCartSnapshot,
  saveCartForUser,
  migrateCartOnLogin,
} from "./cart-persistence-service";

/**
 * Cart Service
 * 
 * Manages shopping cart state with multi-store support.
 * Each cart item is uniquely identified by productId + storeId combination.
 * 
 * Now supports persistence for both logged-in and anonymous users:
 * - Logged-in users: Cart stored in Appwrite (syncs across devices)
 * - Anonymous users: Cart stored locally
 */

export interface CartItem {
  /** Product ID */
  productId: string;
  /** Store location ID (store_location_id) */
  storeId: string;
  /** Product SKU for display */
  sku: string;
  /** Product title for display */
  title: string;
  /** Product brand (optional) */
  brand?: string;
  /** Product image URL (optional) */
  imageUrl?: string;
  /** Price in JMD cents */
  priceJmdCents: number;
  /** Quantity */
  quantity: number;
  /** Store name for display */
  storeName: string;
  /** Store logo URL (optional) */
  storeLogoUrl?: string;
  /** Timestamp when item was added */
  addedAt: string;
}

export interface Cart {
  items: CartItem[];
  /** Total number of items (sum of quantities) */
  totalItems: number;
  /** Total price in JMD cents */
  totalPriceJmdCents: number;
  /** Unique store IDs in cart */
  storeIds: string[];
  /** Last updated timestamp */
  updatedAt: string;
}

// Legacy storage key for backward compatibility (will be migrated)
const LEGACY_CART_STORAGE_KEY = "grovi_cart";

// Current authentication state (set by CartContext)
let currentUserId: string | null = null;
let currentIsAuthenticated: boolean = false;

/**
 * Initialize cart service with user authentication state
 * This should be called by CartContext when auth state changes
 */
export function setCartAuthState(userId: string | null, isAuthenticated: boolean): void {
  currentUserId = userId;
  currentIsAuthenticated = isAuthenticated;
}

/**
 * Migrate cart when user logs in
 * This should be called by CartContext when user authenticates
 */
export async function migrateCartOnUserLogin(userId: string): Promise<Cart> {
  return await migrateCartOnLogin(userId);
}

/**
 * Get cart from storage (uses persistence service based on auth state)
 */
export async function getCart(): Promise<Cart> {
  try {
    const cart = await getCartForUser(currentUserId, currentIsAuthenticated);
    // Validate and recalculate totals
    return calculateCartTotals(cart);
  } catch (error) {
    console.error("Error loading cart:", error);
    // Fallback to empty cart
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
 * Save cart to storage (uses persistence service based on auth state)
 * This is the blocking version - use saveCartInBackground for non-blocking saves
 */
export async function saveCart(cart: Cart): Promise<void> {
  try {
    const cartWithTotals = calculateCartTotals(cart);
    await saveCartForUser(currentUserId, currentIsAuthenticated, cartWithTotals);
  } catch (error) {
    console.error("Error saving cart:", error);
    throw error;
  }
}

export async function getCheckoutCartSnapshot(userId: string): Promise<Cart> {
  const cart = await getServerCartSnapshot(userId);
  if (!cart) throw new Error("Your cart could not be loaded. Please return to your cart and try again.");
  return cart;
}

export async function reconcilePurchasedCart(
  userId: string,
  consumedRevision: string
): Promise<"cleared" | "revision_changed"> {
  return clearServerCartIfRevisionMatches(userId, consumedRevision);
}

/**
 * Save cart in background (non-blocking)
 * Updates happen instantly in UI, persistence happens asynchronously
 */
export function saveCartInBackground(cart: Cart): void {
  // Fire and forget - don't await, let it run in background
  const cartWithTotals = calculateCartTotals(cart);
  saveCartForUser(currentUserId, currentIsAuthenticated, cartWithTotals).catch((error) => {
    // Log error but don't disrupt user experience
    console.error("[CartService] Background save failed (non-critical):", error);
    // Could optionally retry or queue for later
  });
}

/**
 * Calculate cart totals
 */
function calculateCartTotals(cart: Cart): Cart {
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPriceJmdCents = cart.items.reduce(
    (sum, item) => sum + item.priceJmdCents * item.quantity,
    0
  );
  const storeIds = Array.from(new Set(cart.items.map((item) => item.storeId)));

  return {
    ...cart,
    totalItems,
    totalPriceJmdCents,
    storeIds,
    updatedAt: cart.updatedAt,
  };
}

/**
 * Add item to cart
 * If item with same productId + storeId exists, increments quantity
 * 
 * OPTIMISTIC UPDATE: Returns immediately for instant UI feedback.
 * Persistence happens in background - user experiences no lag.
 */
export async function addToCart(
  productId: string,
  storeId: string,
  sku: string,
  title: string,
  priceJmdCents: number,
  storeName: string,
  brand?: string,
  imageUrl?: string,
  quantity: number = 1,
  storeLogoUrl?: string
): Promise<Cart> {
  const cart = await getCart();
  
  // Check if item already exists (same product + store)
  const existingItemIndex = cart.items.findIndex(
    (item) => item.productId === productId && item.storeId === storeId
  );

  if (existingItemIndex >= 0) {
    // Increment quantity for existing item
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].addedAt = new Date().toISOString();
    // Update store logo if provided (in case it wasn't set before)
    if (storeLogoUrl) {
      cart.items[existingItemIndex].storeLogoUrl = storeLogoUrl;
    }
  } else {
    // Add new item
    cart.items.push({
      productId,
      storeId,
      sku,
      title,
      brand,
      imageUrl,
      priceJmdCents,
      quantity,
      storeName,
      storeLogoUrl,
      addedAt: new Date().toISOString(),
    });
  }

  cart.updatedAt = new Date().toISOString();
  // Calculate updated cart immediately (optimistic update)
  const updatedCart = calculateCartTotals(cart);
  
  // Save in background - don't wait for it
  saveCartInBackground(updatedCart);
  
  // Return immediately for instant UI update
  return updatedCart;
}

/**
 * Remove item from cart
 * 
 * OPTIMISTIC UPDATE: Returns immediately for instant UI feedback.
 * Persistence happens in background - user experiences no lag.
 */
export async function removeFromCart(
  productId: string,
  storeId: string
): Promise<Cart> {
  const cart = await getCart();
  cart.items = cart.items.filter(
    (item) => !(item.productId === productId && item.storeId === storeId)
  );
  
  cart.updatedAt = new Date().toISOString();
  // Calculate updated cart immediately (optimistic update)
  const updatedCart = calculateCartTotals(cart);
  
  // Save in background - don't wait for it
  saveCartInBackground(updatedCart);
  
  // Return immediately for instant UI update
  return updatedCart;
}

/**
 * Update item quantity
 * 
 * OPTIMISTIC UPDATE: Returns immediately for instant UI feedback.
 * Persistence happens in background - user experiences no lag.
 */
export async function updateCartItemQuantity(
  productId: string,
  storeId: string,
  quantity: number
): Promise<Cart> {
  if (quantity <= 0) {
    return removeFromCart(productId, storeId);
  }

  const cart = await getCart();
  const item = cart.items.find(
    (item) => item.productId === productId && item.storeId === storeId
  );

  if (item) {
    item.quantity = quantity;
    cart.updatedAt = new Date().toISOString();
    // Calculate updated cart immediately (optimistic update)
    const updatedCart = calculateCartTotals(cart);
    
    // Save in background - don't wait for it
    saveCartInBackground(updatedCart);
    
    // Return immediately for instant UI update
    return updatedCart;
  }

  return cart;
}

/**
 * Clear entire cart
 * 
 * OPTIMISTIC UPDATE: Returns immediately for instant UI feedback.
 * Persistence happens in background - user experiences no lag.
 */
export async function clearCart(): Promise<Cart> {
  const emptyCart: Cart = {
    items: [],
    totalItems: 0,
    totalPriceJmdCents: 0,
    storeIds: [],
    updatedAt: new Date().toISOString(),
  };
  
  // Save in background - don't wait for it
  saveCartInBackground(emptyCart);
  
  // Return immediately for instant UI update
  return emptyCart;
}

/**
 * Get cart item count (total quantity)
 */
export async function getCartItemCount(): Promise<number> {
  const cart = await getCart();
  return cart.totalItems;
}

/**
 * Check if product is in cart
 */
export async function isProductInCart(
  productId: string,
  storeId: string
): Promise<boolean> {
  const cart = await getCart();
  return cart.items.some(
    (item) => item.productId === productId && item.storeId === storeId
  );
}

/**
 * Get quantity for a specific product+store in cart
 */
export async function getCartItemQuantity(
  productId: string,
  storeId: string
): Promise<number> {
  const cart = await getCart();
  const item = cart.items.find(
    (item) => item.productId === productId && item.storeId === storeId
  );
  return item?.quantity || 0;
}
