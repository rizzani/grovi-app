import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import OrderDetailsView from "../components/OrderDetailsView";
import { useUser } from "../contexts/UserContext";
import { useCart } from "../contexts/CartContext";
import { cancelCheckoutAttempt, loadCheckoutAttempt } from "../lib/checkout-service";
import { useOrderDetails } from "../lib/use-order-details";

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { userId, isAuthenticated, isLoading: authLoading } = useUser();
  const { reconcilePurchasedCart } = useCart();
  const { details, loading, error, reload } = useOrderDetails(orderId, userId);
  const reconciledOrder = useRef<string | null>(null);

  useEffect(() => {
    if (!details || !userId || reconciledOrder.current === details.order.$id) return;
    reconciledOrder.current = details.order.$id;
    void (async () => {
      const attempt = await loadCheckoutAttempt(userId);
      if (attempt?.state === "succeeded" && attempt.orderId === details.order.$id && details.order.cartUpdatedAt) {
        try { await reconcilePurchasedCart(details.order.cartUpdatedAt); await cancelCheckoutAttempt(userId); }
        catch (cause) { console.warn("[Checkout] Cart reconciliation remains pending.", cause); }
      }
    })();
  }, [details, reconcilePurchasedCart, userId]);

  if (!authLoading && !isAuthenticated) return <State message="Sign in to view your order." action="Sign In" onPress={() => router.replace("/sign-in")} />;
  if (!orderId) return <State message="This order link is invalid." action="View Orders" onPress={() => router.replace("/(tabs)/orders")} />;
  if (loading || authLoading) return <State loading message="Loading your order…" />;
  if (error || !details) return <State message={error || "Order not found."} action="Retry" onPress={reload} />;
  return <SafeAreaView style={styles.container} edges={["top", "bottom"]}><OrderDetailsView confirmation details={details} footer={<Pressable style={styles.button} onPress={() => router.replace("/(tabs)/orders")}><Text style={styles.buttonText}>View Orders</Text></Pressable>} /></SafeAreaView>;
}

function State({ message, loading, action, onPress }: { message: string; loading?: boolean; action?: string; onPress?: () => void }) { return <SafeAreaView style={styles.container}><View style={styles.state}>{loading && <ActivityIndicator color="#10B981" />}<Text style={styles.message}>{message}</Text>{action && <Pressable style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{action}</Text></Pressable>}</View></SafeAreaView>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F9FAFB" }, state: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }, message: { color: "#6B7280", textAlign: "center" }, button: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center", marginTop: 10 }, buttonText: { color: "#FFF", fontWeight: "700", fontSize: 16 } });
