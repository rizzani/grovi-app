import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "../../contexts/CartContext";
import { useCheckout } from "../../contexts/CheckoutContext";
import { useUser } from "../../contexts/UserContext";
import { CartItem, getCheckoutCartSnapshot } from "../../lib/cart-service";
import { Address, getAddresses } from "../../lib/profile-service";
import { cancelCheckoutAttempt, CheckoutError, executeCheckout, getOrCreateCheckoutAttempt, loadCheckoutAttempt } from "../../lib/checkout-service";
import { finishSuccessfulCheckout, SubmissionGate } from "../../lib/checkout-lifecycle";

interface StoreGroup {
  storeName: string;
  items: CartItem[];
  subtotal: number;
}

const formatJmd = (cents: number) => `J$${(cents / 100).toFixed(2)}`;

const formatAddress = (address: Address) =>
  [address.houseDetails, address.street, address.community, address.parish]
    .filter(Boolean)
    .join(", ");

export default function CheckoutReviewScreen() {
  const router = useRouter();
  const { userId, isAuthenticated } = useUser();
  const { cart, refreshCart, syncCart, reconcilePurchasedCart } = useCart();
  const { selectedAddressId, setSelectedAddressId } = useCheckout();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionRef = useRef(false);
  const submissionGate = useRef(new SubmissionGate());

  const loadAddresses = useCallback(async () => {
    if (!userId) {
      setAddresses([]);
      setIsLoading(false);
      return;
    }

    try {
      setAddressError(null);
      const result = await getAddresses(userId);
      setAddresses(result);
      const selectionStillExists = result.some((address) => address.$id === selectedAddressId);
      if (!selectionStillExists) {
        setSelectedAddressId(result.find((address) => address.default)?.$id ?? result[0]?.$id ?? null);
      }
    } catch (err: any) {
      setAddressError(err.message || "Failed to load delivery addresses");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAddressId, setSelectedAddressId, userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadAddresses();
      if (userId) loadCheckoutAttempt(userId).then((attempt) => {
        if (attempt?.state === "succeeded" && attempt.orderId) router.replace(`/order-confirmation?orderId=${encodeURIComponent(attempt.orderId)}` as Href);
      }).catch(() => undefined);
    }, [loadAddresses, router, userId])
  );

  const selectedAddress = addresses.find((address) => address.$id === selectedAddressId) ?? null;
  const itemsByStore = cart.items.reduce<Record<string, StoreGroup>>((groups, item) => {
    if (!groups[item.storeId]) {
      groups[item.storeId] = { storeName: item.storeName, items: [], subtotal: 0 };
    }
    groups[item.storeId].items.push(item);
    groups[item.storeId].subtotal += item.priceJmdCents * item.quantity;
    return groups;
  }, {});

  const handlePlaceOrder = async () => {
    if (!submissionGate.current.enter() || submissionRef.current || !userId || !selectedAddress || cart.items.length === 0) { submissionGate.current.leave(); return; }
    submissionRef.current = true; setIsSubmitting(true); setSubmissionError(null);
    try {
      const snapshot = await getCheckoutCartSnapshot(userId);
      if (snapshot.items.length === 0) { router.replace("/cart"); return; }
      const attempt = await getOrCreateCheckoutAttempt(userId, selectedAddress.$id, snapshot.updatedAt);
      const result = await executeCheckout(attempt);
      await finishSuccessfulCheckout(
        () => reconcilePurchasedCart(result.consumedRevision),
        () => router.replace(`/order-confirmation?orderId=${encodeURIComponent(result.orderId)}` as Href),
        (clearError) => console.warn("[Checkout] Order placed; cart reconciliation will retry later.", clearError)
      );
    } catch (caught) {
      const failure = caught instanceof CheckoutError ? caught : new CheckoutError("UNKNOWN", "We couldn't place your order. Your cart is safe.");
      switch (failure.code) {
        case "UNAUTHENTICATED": setSubmissionError("Please sign in again to continue. Your checkout is saved."); router.replace("/sign-in"); break;
        case "ADDRESS_NOT_FOUND":
        case "ADDRESS_NOT_OWNED":
          await cancelCheckoutAttempt(userId);
          await loadAddresses();
          setSubmissionError("That delivery address could not be used. Choose an address, then try again.");
          break;
        case "EMPTY_CART": router.replace("/cart"); break;
        case "CART_REVISION_CONFLICT": await cancelCheckoutAttempt(userId); await refreshCart(); setSubmissionError("Your cart changed. Please review it before placing the order."); break;
        case "PRICE_CHANGED": await cancelCheckoutAttempt(userId); await syncCart().catch(() => undefined); setSubmissionError("A price changed. Please review the updated total."); break;
        case "PRODUCT_UNAVAILABLE": await cancelCheckoutAttempt(userId); await syncCart().catch(() => undefined); router.replace({ pathname: "/cart", params: { unavailableProductId: String(failure.details?.productId || "") } }); break;
        case "STORE_UNAVAILABLE": await cancelCheckoutAttempt(userId); router.replace("/cart"); break;
        case "IDEMPOTENCY_CONFLICT": setSubmissionError("We couldn't safely match this checkout attempt. Your cart was not changed. Please contact support if this continues."); break;
        default:
          console.error("[Checkout] Submission failed", caught);
          setSubmissionError(failure.retryable ? "We couldn't confirm the order. Tap Retry to safely check the same attempt." : "We couldn't place your order. Your cart is safe. Please review it and try again.");
      }
    } finally { submissionRef.current = false; submissionGate.current.leave(); setIsSubmitting(false); }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Header onBack={() => router.replace("/cart")} />
        <View style={styles.centerState}>
          <Ionicons name="person-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.stateTitle}>Sign in to checkout</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/sign-in")}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Header onBack={() => router.replace("/cart")} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.stateText}>Loading checkout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Header onBack={() => router.replace("/cart")} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Delivery address" />
        {addressError ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{addressError}</Text>
            <TouchableOpacity onPress={loadAddresses}>
              <Text style={styles.actionText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : selectedAddress ? (
          <View style={[styles.card, styles.selectedCard]}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <View style={styles.labelRow}>
                  <Text style={styles.cardTitle}>{selectedAddress.label}</Text>
                  {selectedAddress.default && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <Text style={styles.secondaryText}>{formatAddress(selectedAddress)}</Text>
                <Text style={styles.secondaryText} numberOfLines={2}>
                  {selectedAddress.landmarkDirections}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/checkout/address" as Href)}>
                <Text style={styles.actionText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyAddressCard}>
            <Ionicons name="location-outline" size={32} color="#10B981" />
            <Text style={styles.cardTitle}>Add a delivery address</Text>
            <Text style={styles.secondaryText}>A delivery address is required before an order can be placed.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/address-form")}>
              <Text style={styles.primaryButtonText}>Add Address</Text>
            </TouchableOpacity>
          </View>
        )}

        <SectionTitle title="Items by store" />
        {Object.entries(itemsByStore).map(([storeId, group]) => (
          <View key={storeId} style={styles.card}>
            <View style={styles.storeHeader}>
              <View style={styles.storeTitleRow}>
                <Ionicons name="storefront" size={18} color="#10B981" />
                <Text style={styles.cardTitle}>{group.storeName}</Text>
              </View>
              <Text style={styles.storeSubtotal}>{formatJmd(group.subtotal)}</Text>
            </View>
            {group.items.map((item) => (
              <View key={`${item.productId}-${item.storeId}`} style={styles.itemRow}>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.secondaryText}>Qty {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatJmd(item.priceJmdCents * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.summaryLabel}>Store subtotal</Text>
              <Text style={styles.summaryValue}>{formatJmd(group.subtotal)}</Text>
            </View>
          </View>
        ))}

        <SectionTitle title="Payment" />
        <View style={styles.card}>
          <View style={styles.storeTitleRow}>
            <Ionicons name="cash-outline" size={22} color="#10B981" />
            <View>
              <Text style={styles.cardTitle}>Cash on Delivery</Text>
              <Text style={styles.secondaryText}>Pay when your groceries arrive.</Text>
            </View>
          </View>
        </View>

        <SectionTitle title="Order summary" />
        <View style={styles.card}>
          <SummaryRow label="Items subtotal" value={formatJmd(cart.totalPriceJmdCents)} />
          <SummaryRow label="Delivery fee" value="J$0.00" />
          <Text style={styles.policyText}>MVP policy: delivery is free while delivery pricing is being finalized.</Text>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand total</Text>
            <Text style={styles.grandTotalValue}>{formatJmd(cart.totalPriceJmdCents)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submissionError && <Text style={styles.submissionError}>{submissionError}</Text>}
        <TouchableOpacity
          style={[styles.placeOrderButton, (!selectedAddress || cart.items.length === 0 || isSubmitting) && styles.disabledButton]}
          disabled={!selectedAddress || cart.items.length === 0 || isSubmitting}
          onPress={handlePlaceOrder}
          activeOpacity={0.7}
        >
          {isSubmitting ? <View style={styles.progressRow}><ActivityIndicator color="#FFFFFF" /><Text style={styles.primaryButtonText}>Placing order…</Text></View> : <Text style={styles.primaryButtonText}>{submissionError ? "Retry" : "Place Order"}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Review Checkout</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  content: { padding: 16, paddingBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, marginBottom: 16 },
  selectedCard: { borderColor: "#10B981", backgroundColor: "#F0FDF4" },
  emptyAddressCard: { alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 24, marginBottom: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  flex: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  defaultBadge: { fontSize: 11, fontWeight: "600", color: "#FFFFFF", backgroundColor: "#10B981", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  secondaryText: { fontSize: 14, lineHeight: 20, color: "#6B7280" },
  actionText: { color: "#10B981", fontSize: 15, fontWeight: "600" },
  errorText: { color: "#DC2626", marginBottom: 12 },
  storeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  storeTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  storeSubtotal: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemRow: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemTitle: { fontSize: 14, fontWeight: "500", color: "#111827" },
  itemPrice: { fontSize: 14, fontWeight: "600", color: "#111827" },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  summaryLabel: { fontSize: 15, color: "#6B7280" },
  summaryValue: { fontSize: 15, fontWeight: "600", color: "#111827" },
  policyText: { fontSize: 12, lineHeight: 17, color: "#6B7280", paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 14 },
  grandTotalLabel: { fontSize: 17, fontWeight: "700", color: "#111827" },
  grandTotalValue: { fontSize: 20, fontWeight: "700", color: "#10B981" },
  footer: { backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB", padding: 16 },
  placeOrderButton: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  primaryButton: { backgroundColor: "#10B981", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  disabledButton: { backgroundColor: "#9CA3AF" },
  developmentText: { fontSize: 12, color: "#6B7280", textAlign: "center", marginTop: 8 },
  submissionError: { color: "#DC2626", marginBottom: 10, textAlign: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  stateTitle: { fontSize: 20, fontWeight: "600", color: "#111827" },
  stateText: { fontSize: 15, color: "#6B7280" },
});
