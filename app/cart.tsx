import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../contexts/CartContext";
import { CartItem } from "../lib/cart-service";
import Constants from "expo-constants";
import { useUser } from "../contexts/UserContext";

/**
 * Transform Appwrite image URL for cart display
 */
function getOptimizedImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;

  const isAppwriteStorageUrl = imageUrl.includes("/storage/buckets/") && imageUrl.includes("/files/");
  
  if (!isAppwriteStorageUrl) {
    return imageUrl;
  }

  let viewUrl = imageUrl;
  
  if (viewUrl.includes("/preview")) {
    viewUrl = viewUrl.replace("/preview", "/view");
  } else if (!viewUrl.includes("/view")) {
    const queryIndex = viewUrl.indexOf("?");
    const hashIndex = viewUrl.indexOf("#");
    const insertIndex = queryIndex !== -1 ? queryIndex : (hashIndex !== -1 ? hashIndex : viewUrl.length);
    viewUrl = viewUrl.substring(0, insertIndex) + "/view" + viewUrl.substring(insertIndex);
  }

  const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID || 
    process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "";

  if (projectId) {
    const separator = viewUrl.includes("?") ? "&" : "?";
    return `${viewUrl}${separator}project=${projectId}`;
  }

  return viewUrl;
}

interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (productId: string, storeId: string, quantity: number) => void;
  onRemove: (productId: string, storeId: string) => void;
  validation?: {
    isAvailable: boolean;
    priceChanged: boolean;
    currentPriceJmdCents: number | null;
    priceDifference: number;
  };
}

interface StoreGroupHeaderProps {
  storeName: string;
  storeLogoUrl?: string;
  subtotal: number;
}

function StoreGroupHeader({ storeName, storeLogoUrl, subtotal }: StoreGroupHeaderProps) {
  const [logoError, setLogoError] = useState(false);
  const showLogo = storeLogoUrl && !logoError;


  return (
    <View style={styles.storeGroupHeader}>
      {showLogo ? (
        <Image
          source={{ uri: storeLogoUrl }}
          style={styles.storeLogo}
          onError={() => {
            setLogoError(true);
          }}
        />
      ) : (
        <View style={styles.storeLogoPlaceholder}>
          <Ionicons name="storefront" size={18} color="#10B981" />
        </View>
      )}
      <View style={styles.storeGroupTitleContainer}>
        <Text style={styles.storeGroupTitle}>{storeName}</Text>
        <Text style={styles.storeGroupSubtotalLabel}>Subtotal</Text>
      </View>
      <Text style={styles.storeGroupTotal}>
        ${(subtotal / 100).toFixed(2)}
      </Text>
    </View>
  );
}

function CartItemRow({ item, onQuantityChange, onRemove, validation }: CartItemRowProps) {
  // No loading state needed - updates are instant (optimistic updates)
  const handleIncrease = () => {
    // Fire and forget - UI updates instantly, save happens in background
    onQuantityChange(item.productId, item.storeId, item.quantity + 1).catch((error) => {
      console.error("Error updating quantity:", error);
    });
  };

  const handleDecrease = () => {
    // Fire and forget - UI updates instantly, save happens in background
    if (item.quantity > 1) {
      onQuantityChange(item.productId, item.storeId, item.quantity - 1).catch((error) => {
        console.error("Error updating quantity:", error);
      });
    } else {
      onRemove(item.productId, item.storeId).catch((error) => {
        console.error("Error removing item:", error);
      });
    }
  };

  const handleRemove = () => {
    Alert.alert(
      "Remove Item",
      `Remove ${item.title} from your cart?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onRemove(item.productId, item.storeId),
        },
      ]
    );
  };

  const imageUrl = getOptimizedImageUrl(item.imageUrl);
  const itemTotal = item.priceJmdCents * item.quantity;
  const isUnavailable = validation && !validation.isAvailable;
  const hasPriceChange = validation && validation.priceChanged && validation.isAvailable;

  return (
    <View style={[styles.cartItem, isUnavailable && styles.cartItemUnavailable]}>
      {/* Product Image */}
      <View style={styles.itemImageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Ionicons name="cube-outline" size={24} color="#D1D5DB" />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleContainer}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.brand && (
              <Text style={styles.itemBrand} numberOfLines={1}>
                {item.brand}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Store Info */}
        <View style={styles.itemStoreContainer}>
          <Ionicons name="storefront" size={12} color="#9CA3AF" />
          <Text style={styles.itemStore} numberOfLines={1}>
            {item.storeName}
          </Text>
        </View>

        {/* Validation Warnings */}
        {isUnavailable && (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.warningText}>This item is no longer available</Text>
          </View>
        )}
        {hasPriceChange && validation && (
          <View style={styles.priceChangeBanner}>
            <Ionicons 
              name={validation.priceDifference > 0 ? "arrow-up" : "arrow-down"} 
              size={16} 
              color={validation.priceDifference > 0 ? "#EF4444" : "#10B981"} 
            />
            <Text style={styles.priceChangeText}>
              Price {validation.priceDifference > 0 ? "increased" : "decreased"} by $
              {Math.abs(validation.priceDifference / 100).toFixed(2)}
            </Text>
          </View>
        )}

        {/* Price and Quantity Controls */}
        <View style={styles.itemFooter}>
          <View>
            {hasPriceChange && validation?.currentPriceJmdCents ? (
              <>
                <Text style={styles.itemPriceOld}>
                  ${(itemTotal / 100).toFixed(2)}
                </Text>
                <Text style={styles.itemPrice}>
                  ${((validation.currentPriceJmdCents * item.quantity) / 100).toFixed(2)}
                </Text>
              </>
            ) : (
              <Text style={styles.itemPrice}>
                ${(itemTotal / 100).toFixed(2)}
              </Text>
            )}
          </View>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={handleDecrease}
              disabled={isUnavailable}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={18} color={isUnavailable ? "#9CA3AF" : "#10B981"} />
            </TouchableOpacity>
            <Text style={[styles.quantityText, isUnavailable && styles.quantityTextDisabled]}>
              {item.quantity}
            </Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={handleIncrease}
              disabled={isUnavailable}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={isUnavailable ? "#9CA3AF" : "#10B981"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { unavailableProductId } = useLocalSearchParams<{ unavailableProductId?: string }>();
  const { isAuthenticated } = useUser();
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    isLoading,
    validationState,
    syncCart,
    validateCart,
    canCheckout,
  } = useCart();
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Validate cart when screen is focused
  useEffect(() => {
    if (cart.items.length > 0 && !isLoading) {
      validateCart().catch((error) => {
        console.error("Error validating cart:", error);
      });
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await validateCart();
    } catch (error) {
      console.error("Error refreshing cart:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncCart();
      Alert.alert(
        "Cart Updated",
        validationState.removedItems.length > 0 || validationState.updatedItems.length > 0
          ? `Updated ${validationState.updatedItems.length} item(s) and removed ${validationState.removedItems.length} unavailable item(s).`
          : "Your cart is up to date.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error syncing cart:", error);
      Alert.alert("Error", "Failed to sync cart. Please try again.", [{ text: "OK" }]);
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        "Sign in to Checkout",
        "Please sign in before choosing a delivery address and reviewing your checkout.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/sign-in") },
        ]
      );
      return;
    }

    // Validate before checkout
    const validation = await validateCart();
    
    if (!validation.isValid) {
      Alert.alert(
        "Cart Issues",
        `Some items in your cart are no longer available. Please sync your cart to update prices and remove unavailable items.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sync Cart",
            onPress: handleSync,
          },
        ]
      );
      return;
    }

    if (validation.priceChangedItems.length > 0) {
      Alert.alert(
        "Price Changes",
        `The prices of ${validation.priceChangedItems.length} item(s) have changed. Would you like to update your cart with the latest prices?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Update Prices",
            onPress: handleSync,
          },
          {
            text: "Continue Anyway",
            style: "default",
            onPress: () => router.push("/checkout/review" as Href),
          },
        ]
      );
      return;
    }

    router.push("/checkout/review" as Href);
  };

  const handleClearCart = () => {
    if (cart.items.length === 0) return;

    Alert.alert(
      "Clear Cart",
      "Are you sure you want to remove all items from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearCart();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Group items by store
  const itemsByStore = cart.items.reduce((acc, item) => {
    if (!acc[item.storeId]) {
      acc[item.storeId] = {
        storeName: item.storeName,
        storeLogoUrl: item.storeLogoUrl, // Will be updated if we find a logo in later items
        items: [],
        subtotal: 0,
      };
    }
    acc[item.storeId].items.push(item);
    acc[item.storeId].subtotal += item.priceJmdCents * item.quantity;
    // If current item has a logo and we don't have one yet, use it
    if (item.storeLogoUrl && !acc[item.storeId].storeLogoUrl) {
      acc[item.storeId].storeLogoUrl = item.storeLogoUrl;
    }
    return acc;
  }, {} as Record<string, { storeName: string; storeLogoUrl?: string; items: CartItem[]; subtotal: number }>);

  // Calculate delivery fees per store (placeholder - will be implemented when backend provides this)
  // TODO: Fetch delivery fees from backend API when available
  const deliveryFeesByStore: Record<string, number> = {};
  Object.keys(itemsByStore).forEach((storeId) => {
    deliveryFeesByStore[storeId] = 0; // Placeholder: set to 0 until backend provides delivery fee API
  });

  // Calculate overall total including delivery fees
  const overallTotalJmdCents = cart.totalPriceJmdCents + 
    Object.values(deliveryFeesByStore).reduce((sum, fee) => sum + fee, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        {cart.items.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearCart}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
        {cart.items.length === 0 && <View style={styles.headerPlaceholder} />}
      </View>

      {unavailableProductId && (
        <View style={styles.checkoutWarning}>
          <Ionicons name="alert-circle" size={18} color="#B91C1C" />
          <Text style={styles.checkoutWarningText}>An item became unavailable and was highlighted or removed. Please review your cart.</Text>
        </View>
      )}

      {cart.items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Start adding items from any store to see them here
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push("/(tabs)/search")}
            activeOpacity={0.7}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Validation Status Banner */}
          {validationState.validation && validationState.validation.issueCount > 0 && (
            <View style={styles.validationBanner}>
              <Ionicons name="information-circle" size={20} color="#F59E0B" />
              <View style={styles.validationBannerContent}>
                <Text style={styles.validationBannerText}>
                  {validationState.validation.unavailableItems.length > 0 && (
                    <Text>
                      {validationState.validation.unavailableItems.length} item(s) unavailable.{" "}
                    </Text>
                  )}
                  {validationState.validation.priceChangedItems.length > 0 && (
                    <Text>
                      {validationState.validation.priceChangedItems.length} price change(s) detected.
                    </Text>
                  )}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={handleSync}
                disabled={syncing || validationState.isValidating}
                activeOpacity={0.7}
              >
                {syncing || validationState.isValidating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {/* Cart Items Grouped by Store */}
            {Object.entries(itemsByStore).map(([storeId, storeData]) => (
              <View key={storeId} style={styles.storeGroup}>
                <StoreGroupHeader
                  storeName={storeData.storeName}
                  storeLogoUrl={storeData.storeLogoUrl}
                  subtotal={storeData.subtotal}
                />
                {storeData.items.map((item) => {
                  const validation = validationState.validation?.validations.find(
                    (v) => v.item.productId === item.productId && v.item.storeId === item.storeId
                  );
                  return (
                    <CartItemRow
                      key={`${item.productId}-${item.storeId}`}
                      item={item}
                      onQuantityChange={updateQuantity}
                      onRemove={removeFromCart}
                      validation={validation}
                    />
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Footer with Total and Checkout */}
          <View style={styles.footer}>
            <View style={styles.footerSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>{cart.totalItems}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Stores</Text>
                <Text style={styles.summaryValue}>{cart.storeIds.length}</Text>
              </View>
              
              {/* Store Subtotals Breakdown (only show if multiple stores) */}
              {cart.storeIds.length > 1 && Object.entries(itemsByStore).map(([storeId, storeData]) => {
                const deliveryFeeJmdCents = deliveryFeesByStore[storeId] || 0;
                const storeTotal = storeData.subtotal + deliveryFeeJmdCents;
                
                return (
                  <View key={storeId} style={styles.storeSubtotalRow}>
                    <View style={styles.storeSubtotalHeader}>
                      <Text style={styles.storeSubtotalLabel}>{storeData.storeName}</Text>
                    </View>
                    <View style={styles.storeSubtotalDetails}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>
                          ${(storeData.subtotal / 100).toFixed(2)}
                        </Text>
                      </View>
                      {deliveryFeeJmdCents > 0 && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Delivery</Text>
                          <Text style={styles.summaryValue}>
                            ${(deliveryFeeJmdCents / 100).toFixed(2)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Store Total</Text>
                        <Text style={styles.summaryValue}>
                          ${(storeTotal / 100).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              
              {/* Overall Total - includes all stores and delivery fees */}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  ${(overallTotalJmdCents / 100).toFixed(2)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.checkoutButton,
                (!canCheckout() || validationState.isValidating) && styles.checkoutButtonDisabled,
              ]}
              onPress={handleCheckout}
              disabled={!canCheckout() || validationState.isValidating}
              activeOpacity={0.7}
            >
              {validationState.isValidating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  headerPlaceholder: {
    width: 40,
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
  },
  shopButton: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  storeGroup: {
    marginBottom: 24,
  },
  storeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  storeLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#F3F4F6",
  },
  storeLogoPlaceholder: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
  },
  storeGroupTitleContainer: {
    flex: 1,
  },
  storeGroupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  storeGroupSubtotalLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  storeGroupTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  storeSubtotalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  storeSubtotalHeader: {
    marginBottom: 8,
  },
  storeSubtotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  storeSubtotalDetails: {
    paddingLeft: 8,
  },
  cartItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  itemImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  itemImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  itemTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  itemBrand: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  removeButton: {
    padding: 4,
  },
  itemStoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  itemStore: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    minWidth: 24,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  footerSummary: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#10B981",
  },
  checkoutButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  checkoutButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  validationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
    gap: 12,
  },
  validationBannerContent: {
    flex: 1,
  },
  validationBannerText: {
    fontSize: 14,
    color: "#92400E",
    fontWeight: "500",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  cartItemUnavailable: {
    opacity: 0.6,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
    flex: 1,
  },
  priceChangeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    gap: 6,
  },
  priceChangeText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
  },
  itemPriceOld: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  quantityTextDisabled: {
    color: "#9CA3AF",
  },
  checkoutWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  checkoutWarningText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 13,
  },
});
