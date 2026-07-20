import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { getOrderDetails, OrderDetails } from "../lib/order-service";
import { useCart } from "../contexts/CartContext";
import { cancelCheckoutAttempt, loadCheckoutAttempt } from "../lib/checkout-service";

const money = (cents: number) => `J$${(cents / 100).toFixed(2)}`;
export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { userId, isAuthenticated, isLoading: authLoading } = useUser();
  const { reconcilePurchasedCart } = useCart();
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!orderId || !userId) return;
    setLoading(true); setError(null);
    try {
      const loaded = await getOrderDetails(orderId, userId);
      setDetails(loaded);
      const attempt = await loadCheckoutAttempt(userId);
      if (attempt?.state === "succeeded" && attempt.orderId === orderId && loaded.order.cartUpdatedAt) {
        try {
          await reconcilePurchasedCart(loaded.order.cartUpdatedAt);
          await cancelCheckoutAttempt(userId);
        } catch (reconciliationError) {
          console.warn("[Checkout] Cart reconciliation remains pending.", reconciliationError);
        }
      }
    }
    catch { setError("We couldn't load this order. Please try again."); }
    finally { setLoading(false); }
  }, [orderId, reconcilePurchasedCart, userId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!authLoading && !isAuthenticated) return <State message="Sign in to view your order." action="Sign In" onPress={() => router.replace("/sign-in")} />;
  if (!orderId) return <State message="This order link is invalid." action="View Orders" onPress={() => router.replace("/(tabs)/orders")} />;
  if (loading || authLoading) return <State loading message="Loading your order…" />;
  if (error || !details) return <State message={error || "Order not found."} action="Retry" onPress={load} />;
  const { order, storeOrders, items } = details;
  return <SafeAreaView style={styles.container} edges={["top", "bottom"]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.check}>✓</Text><Text style={styles.title}>Order placed</Text><Text style={styles.orderNumber}>{order.orderNumber}</Text>
    <View style={styles.card}><Row label="Status" value={order.status} /><Row label="Total" value={money(order.totalJmdCents)} /><Row label="Payment" value="Cash on Delivery" /><Row label="Placed" value={new Date(order.placedAt).toLocaleString()} /></View>
    <Text style={styles.heading}>Delivery address</Text><View style={styles.card}><Text style={styles.strong}>{order.addressLabel}</Text><Text style={styles.muted}>{[order.deliveryHouseDetails, order.deliveryStreet, order.deliveryCommunity, order.deliveryParish].filter(Boolean).join(", ")}</Text><Text style={styles.muted}>{order.deliveryLandmarkDirections}</Text><Text style={styles.muted}>{order.deliveryContactPhone}</Text></View>
    <Text style={styles.heading}>Items</Text>{storeOrders.map((store) => <View style={styles.card} key={store.$id}><Text style={styles.strong}>{store.storeName}</Text>{items.filter((item) => item.storeOrderId === store.$id).map((item) => <View style={styles.item} key={item.$id}><View style={styles.flex}><Text>{item.title}</Text><Text style={styles.muted}>Qty {item.quantity}</Text></View><Text style={styles.strong}>{money(item.lineTotalJmdCents)}</Text></View>)}</View>)}
    <TouchableOpacity style={styles.button} onPress={() => router.replace("/(tabs)/orders")}><Text style={styles.buttonText}>View Orders</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={styles.muted}>{label}</Text><Text style={[styles.strong, styles.capitalize]}>{value}</Text></View>; }
function State({ message, loading, action, onPress }: { message: string; loading?: boolean; action?: string; onPress?: () => void }) { return <SafeAreaView style={styles.container}><View style={styles.state}>{loading && <ActivityIndicator color="#10B981" />}<Text style={styles.muted}>{message}</Text>{action && <TouchableOpacity style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{action}</Text></TouchableOpacity>}</View></SafeAreaView>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F9FAFB" }, content: { padding: 20, paddingBottom: 40 }, check: { alignSelf: "center", fontSize: 46, color: "#10B981", fontWeight: "800" }, title: { textAlign: "center", fontSize: 26, fontWeight: "700", color: "#111827" }, orderNumber: { textAlign: "center", color: "#6B7280", marginTop: 6, marginBottom: 22 }, heading: { fontSize: 17, fontWeight: "700", marginTop: 8, marginBottom: 10, color: "#111827" }, card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, marginBottom: 16, gap: 10 }, row: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, item: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10, gap: 12 }, flex: { flex: 1 }, strong: { fontWeight: "600", color: "#111827" }, muted: { color: "#6B7280", lineHeight: 20 }, capitalize: { textTransform: "capitalize" }, button: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center", marginTop: 10 }, buttonText: { color: "#FFF", fontWeight: "700", fontSize: 16 }, state: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 } });
