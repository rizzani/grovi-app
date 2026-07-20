import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import {
  Cart,
  CartItem,
  getCart,
  addToCart as addToCartService,
  removeFromCart as removeFromCartService,
  updateCartItemQuantity as updateCartItemQuantityService,
  clearCart as clearCartService,
  isProductInCart as isProductInCartService,
  getCartItemQuantity as getCartItemQuantityService,
  saveCart,
  setCartAuthState,
  migrateCartOnUserLogin,
  reconcilePurchasedCart as reconcilePurchasedCartService,
} from "../lib/cart-service";
import {
  validateCart,
  getUpdatedCart,
  CartValidationResult,
  CartItemValidation,
} from "../lib/cart-validation-service";
import { useUser } from "./UserContext";

export interface CartValidationState {
  /** Current validation result */
  validation: CartValidationResult | null;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Items that were automatically removed due to unavailability */
  removedItems: CartItem[];
  /** Items that had price updates */
  updatedItems: CartItem[];
}

interface CartContextType {
  cart: Cart;
  isLoading: boolean;
  validationState: CartValidationState;
  addToCart: (
    productId: string,
    storeId: string,
    sku: string,
    title: string,
    priceJmdCents: number,
    storeName: string,
    brand?: string,
    imageUrl?: string,
    quantity?: number,
    storeLogoUrl?: string
  ) => Promise<void>;
  removeFromCart: (productId: string, storeId: string) => Promise<void>;
  updateQuantity: (productId: string, storeId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  reconcilePurchasedCart: (revision: string) => Promise<"cleared" | "revision_changed">;
  isProductInCart: (productId: string, storeId: string) => boolean;
  getItemQuantity: (productId: string, storeId: string) => number;
  refreshCart: () => Promise<void>;
  validateCart: () => Promise<CartValidationResult>;
  syncCart: () => Promise<void>;
  canCheckout: () => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthenticated, isLoading: isUserLoading } = useUser();
  const [cart, setCart] = useState<Cart>({
    items: [],
    totalItems: 0,
    totalPriceJmdCents: 0,
    storeIds: [],
    updatedAt: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [validationState, setValidationState] = useState<CartValidationState>({
    validation: null,
    isValidating: false,
    removedItems: [],
    updatedItems: [],
  });

  // Track previous auth state to detect login/logout
  const prevUserIdRef = useRef<string | null>(null);
  const prevIsAuthenticatedRef = useRef<boolean>(false);

  // Update cart service auth state when it changes
  useEffect(() => {
    setCartAuthState(userId, isAuthenticated);
  }, [userId, isAuthenticated]);

  // Handle cart migration when user logs in
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const prevIsAuthenticated = prevIsAuthenticatedRef.current;

    // User just logged in (was not authenticated, now is)
    if (!prevIsAuthenticated && isAuthenticated && userId) {
      handleUserLogin(userId);
    }
    // User just logged out (was authenticated, now is not)
    else if (prevIsAuthenticated && !isAuthenticated) {
      handleUserLogout();
    }
    // User changed (different userId)
    else if (prevUserId !== userId && isAuthenticated && userId) {
      handleUserChange(userId);
    }

    // Update refs
    prevUserIdRef.current = userId;
    prevIsAuthenticatedRef.current = isAuthenticated;
  }, [userId, isAuthenticated]);

  // Load cart on mount and when auth state stabilizes
  useEffect(() => {
    // Wait for user context to finish loading before loading cart
    if (!isUserLoading) {
      loadCartAndValidate();
    }
  }, [isUserLoading]);

  const loadCart = async () => {
    try {
      setIsLoading(true);
      const loadedCart = await getCart();
      setCart(loadedCart);
      return loadedCart;
    } catch (error) {
      console.error("Error loading cart:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const loadCartAndValidate = async () => {
    const loadedCart = await loadCart();
    if (loadedCart && loadedCart.items.length > 0) {
      // Validate cart after loading
      await validateAndSyncCart(loadedCart);
    }
  };

  /**
   * Handle user login - migrate local cart to server and merge with existing server cart
   */
  const handleUserLogin = async (userId: string) => {
    try {
      setIsLoading(true);
      if (__DEV__) {
        console.log("[CartContext] User logged in, migrating cart...");
      }
      
      // Migrate cart (merges local and server carts if both exist)
      const migratedCart = await migrateCartOnUserLogin(userId);
      setCart(migratedCart);
      
      // Validate migrated cart
      if (migratedCart.items.length > 0) {
        await validateAndSyncCart(migratedCart);
      }
      
      if (__DEV__) {
        console.log("[CartContext] Cart migrated successfully", {
          itemCount: migratedCart.items.length,
        });
      }
    } catch (error) {
      console.error("[CartContext] Error migrating cart on login:", error);
      // Fallback: try to load cart normally
      await loadCartAndValidate();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle user logout - cart will automatically switch to local storage
   */
  const handleUserLogout = async () => {
    try {
      if (__DEV__) {
        console.log("[CartContext] User logged out, switching to local cart...");
      }
      // Reload cart (will now use local storage)
      await loadCartAndValidate();
    } catch (error) {
      console.error("[CartContext] Error handling logout:", error);
    }
  };

  /**
   * Handle user change - load cart for new user
   */
  const handleUserChange = async (newUserId: string) => {
    try {
      setIsLoading(true);
      if (__DEV__) {
        console.log("[CartContext] User changed, loading cart for new user...");
      }
      // Load cart for new user (from server)
      await loadCartAndValidate();
    } catch (error) {
      console.error("[CartContext] Error loading cart for new user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = async (
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
  ) => {
    try {
      // Use functional update to prevent race conditions
      // Work directly with current state - don't read from storage
      setCart((currentCart) => {
        // Check if item already exists
        const existingItemIndex = currentCart.items.findIndex(
          (item) => item.productId === productId && item.storeId === storeId
        );

        let updatedItems: CartItem[];
        if (existingItemIndex >= 0) {
          // Increment quantity for existing item
          updatedItems = currentCart.items.map((item, index) => {
            if (index === existingItemIndex) {
              return {
                ...item,
                quantity: item.quantity + quantity,
                addedAt: new Date().toISOString(),
                storeLogoUrl: storeLogoUrl || item.storeLogoUrl,
              };
            }
            return item;
          });
        } else {
          // Add new item
          updatedItems = [
            ...currentCart.items,
            {
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
            },
          ];
        }

        // Calculate totals
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPriceJmdCents = updatedItems.reduce(
          (sum, item) => sum + item.priceJmdCents * item.quantity,
          0
        );
        const storeIds = Array.from(new Set(updatedItems.map((item) => item.storeId)));

        const updatedCart = {
          ...currentCart,
          items: updatedItems,
          totalItems,
          totalPriceJmdCents,
          storeIds,
          updatedAt: new Date().toISOString(),
        };

        // Save in background - don't wait
        saveCart(updatedCart);
        return updatedCart;
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      throw error;
    }
  };

  const removeFromCart = async (productId: string, storeId: string) => {
    try {
      // Use functional update to prevent race conditions
      // Work directly with current state - don't read from storage
      setCart((currentCart) => {
        const filteredItems = currentCart.items.filter(
          (item) => !(item.productId === productId && item.storeId === storeId)
        );

        // Calculate totals
        const totalItems = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPriceJmdCents = filteredItems.reduce(
          (sum, item) => sum + item.priceJmdCents * item.quantity,
          0
        );
        const storeIds = Array.from(new Set(filteredItems.map((item) => item.storeId)));

        const updatedCart = {
          ...currentCart,
          items: filteredItems,
          totalItems,
          totalPriceJmdCents,
          storeIds,
          updatedAt: new Date().toISOString(),
        };

        // Save in background - don't wait
        saveCart(updatedCart);
        return updatedCart;
      });
    } catch (error) {
      console.error("Error removing from cart:", error);
      throw error;
    }
  };

  const updateQuantity = async (
    productId: string,
    storeId: string,
    quantity: number
  ) => {
    try {
      // Use functional update to prevent race conditions
      // Work directly with current state - don't read from storage
      setCart((currentCart) => {
        // Handle quantity <= 0 (remove item)
        if (quantity <= 0) {
          const filteredItems = currentCart.items.filter(
            (item) => !(item.productId === productId && item.storeId === storeId)
          );
          const updatedCart = {
            ...currentCart,
            items: filteredItems,
          };
          // Calculate totals
          const totalItems = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
          const totalPriceJmdCents = filteredItems.reduce(
            (sum, item) => sum + item.priceJmdCents * item.quantity,
            0
          );
          const storeIds = Array.from(new Set(filteredItems.map((item) => item.storeId)));
          
          const finalCart = {
            ...updatedCart,
            totalItems,
            totalPriceJmdCents,
            storeIds,
            updatedAt: new Date().toISOString(),
          };
          
          // Save in background
          saveCart(finalCart);
          return finalCart;
        }

        // Update quantity for existing item
        const updatedItems = currentCart.items.map((item) => {
          if (item.productId === productId && item.storeId === storeId) {
            return { ...item, quantity };
          }
          return item;
        });

        // Calculate totals
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPriceJmdCents = updatedItems.reduce(
          (sum, item) => sum + item.priceJmdCents * item.quantity,
          0
        );
        const storeIds = Array.from(new Set(updatedItems.map((item) => item.storeId)));

        const updatedCart = {
          ...currentCart,
          items: updatedItems,
          totalItems,
          totalPriceJmdCents,
          storeIds,
          updatedAt: new Date().toISOString(),
        };

        // Save in background - don't wait
        saveCart(updatedCart);
        return updatedCart;
      });
    } catch (error) {
      console.error("Error updating cart quantity:", error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      // Get empty cart immediately (optimistic update)
      const emptyCart = await clearCartService();
      // Update UI state immediately - save happens in background
      setCart(emptyCart);
    } catch (error) {
      console.error("Error clearing cart:", error);
      throw error;
    }
  };

  const reconcilePurchasedCart = async (revision: string) => {
    if (!userId) throw new Error("Authentication is required to reconcile the cart.");
    const result = await reconcilePurchasedCartService(userId, revision);
    await loadCart();
    return result;
  };

  const isProductInCart = (productId: string, storeId: string): boolean => {
    return cart.items.some(
      (item) => item.productId === productId && item.storeId === storeId
    );
  };

  const getItemQuantity = (productId: string, storeId: string): number => {
    const item = cart.items.find(
      (item) => item.productId === productId && item.storeId === storeId
    );
    return item?.quantity || 0;
  };

  const refreshCart = async () => {
    await loadCartAndValidate();
  };

  /**
   * Validate cart items against current database state
   */
  const validateCartItems = async (): Promise<CartValidationResult> => {
    try {
      setValidationState((prev) => ({ ...prev, isValidating: true }));
      const validation = await validateCart(cart);
      setValidationState((prev) => ({
        ...prev,
        validation,
        isValidating: false,
      }));
      return validation;
    } catch (error) {
      console.error("Error validating cart:", error);
      setValidationState((prev) => ({ ...prev, isValidating: false }));
      throw error;
    }
  };

  /**
   * Sync cart with current database state (update prices, remove unavailable items)
   */
  const syncCart = async (): Promise<void> => {
    try {
      setValidationState((prev) => ({ ...prev, isValidating: true }));
      const { updatedCart, removedItems, updatedItems } = await getUpdatedCart(cart);
      
      // Save updated cart
      await saveCart(updatedCart);
      setCart(updatedCart);

      // Update validation state
      const validation = await validateCart(updatedCart);
      setValidationState({
        validation,
        isValidating: false,
        removedItems,
        updatedItems,
      });
    } catch (error) {
      console.error("Error syncing cart:", error);
      setValidationState((prev) => ({ ...prev, isValidating: false }));
      throw error;
    }
  };

  /**
   * Validate and sync cart (used on load)
   */
  const validateAndSyncCart = async (cartToValidate: Cart): Promise<void> => {
    try {
      setValidationState((prev) => ({ ...prev, isValidating: true }));
      const { updatedCart, removedItems, updatedItems } = await getUpdatedCart(cartToValidate);
      
      // Only update if there were changes
      if (removedItems.length > 0 || updatedItems.length > 0) {
        await saveCart(updatedCart);
        setCart(updatedCart);
      } else {
        setCart(cartToValidate);
      }

      // Update validation state
      const validation = await validateCart(updatedCart);
      setValidationState({
        validation,
        isValidating: false,
        removedItems,
        updatedItems,
      });
    } catch (error) {
      console.error("Error validating and syncing cart:", error);
      setValidationState((prev) => ({ ...prev, isValidating: false }));
    }
  };

  /**
   * Check if cart is valid for checkout
   */
  const canCheckout = (): boolean => {
    if (cart.items.length === 0) return false;
    if (validationState.validation) {
      return validationState.validation.isValid;
    }
    // If not validated yet, assume valid (will be validated before checkout)
    return true;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        validationState,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        reconcilePurchasedCart,
        isProductInCart,
        getItemQuantity,
        refreshCart,
        validateCart: validateCartItems,
        syncCart,
        canCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
