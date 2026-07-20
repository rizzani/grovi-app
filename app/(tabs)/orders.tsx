import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../../contexts/UserContext";
import { getOrdersForUser } from "../../lib/order-service";
import { Order } from "../../lib/order-types";
import { formatOrderDate, formatOrderLabel, formatOrderMoney } from "../../lib/order-formatters";

const PAGE_SIZE = 20;

export default function OrdersScreen() {
  const router = useRouter();
  const { userId, isAuthenticated, isLoading: authLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);

  const loadFirstPage = useCallback(async (refresh = false) => {
    if (!userId) { setLoading(false); setRefreshing(false); return; }
    const currentRequest = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await getOrdersForUser(userId, { limit: PAGE_SIZE });
      if (currentRequest !== requestId.current) return;
      setOrders(page.orders); setNextCursor(page.nextCursor); setHasMore(page.hasMore);
    } catch {
      if (currentRequest === requestId.current) setError("We couldn't load your orders. Please try again.");
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadFirstPage(); }, [loadFirstPage]));

  const loadMore = useCallback(async () => {
    if (!userId || !nextCursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getOrdersForUser(userId, { limit: PAGE_SIZE, cursor: nextCursor });
      setOrders((current) => {
        const known = new Set(current.map((order) => order.$id));
        return [...current, ...page.orders.filter((order) => !known.has(order.$id))];
      });
      setNextCursor(page.nextCursor); setHasMore(page.hasMore);
    } catch { setError("Some orders couldn't be loaded. Pull to refresh or try again."); }
    finally { setLoadingMore(false); }
  }, [hasMore, loadingMore, nextCursor, userId]);

  if (authLoading) return <ScreenState loading message="Loading orders…" />;
  if (!isAuthenticated || !userId) return <ScreenState icon="person-outline" message="Sign in to view your orders." action="Sign In" onPress={() => router.push("/sign-in")} />;
  if (loading && orders.length === 0) return <OrderSkeleton />;
  if (error && orders.length === 0) return <ScreenState icon="alert-circle-outline" message={error} action="Retry" onPress={() => void loadFirstPage()} />;

  return <SafeAreaView style={styles.container} edges={["top"]}>
    <View style={styles.header}><Text style={styles.headerTitle}>Orders</Text><Text style={styles.headerSubtitle}>Your order history</Text></View>
    <FlatList
      data={orders}
      keyExtractor={(order) => order.$id}
      renderItem={({ item }) => <OrderCard order={item} onPress={() => router.push(`/orders/${item.$id}` as Href)} />}
      contentContainerStyle={[styles.list, orders.length === 0 && styles.emptyList]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFirstPage(true)} tintColor="#10B981" />}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="receipt-outline" size={64} color="#9CA3AF" /><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>When you place an order, it will appear here.</Text><Pressable style={styles.button} onPress={() => router.push("/")}><Text style={styles.buttonText}>Start Shopping</Text></Pressable></View>}
      ListHeaderComponent={error && orders.length > 0 ? <Pressable style={styles.inlineError} onPress={() => void loadFirstPage(true)}><Text style={styles.inlineErrorText}>{error} Tap to retry.</Text></Pressable> : null}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color="#10B981" /> : null}
    />
  </SafeAreaView>;
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const problem = order.status === "cancelled" || order.status === "failed" || order.paymentStatus === "failed";
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
    <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.orderNumber}>{order.orderNumber}</Text><Text style={styles.muted}>{formatOrderDate(order.placedAt)}</Text></View><Text style={[styles.badge, problem && styles.badgeProblem]}>{formatOrderLabel(order.status)}</Text></View>
    <View style={styles.meta}><Text style={styles.metaText}>{order.storeCount} store{order.storeCount === 1 ? "" : "s"}</Text><Text style={styles.dot}>•</Text><Text style={styles.metaText}>{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</Text></View>
    <View style={styles.cardBottom}><View><Text style={styles.muted}>{formatOrderLabel(order.paymentMethod)}</Text><Text style={[styles.payment, order.paymentStatus === "failed" && styles.problemText]}>{formatOrderLabel(order.paymentStatus)}</Text></View><Text style={styles.total}>{formatOrderMoney(order.totalJmdCents, order.currency)}</Text></View>
  </Pressable>;
}

function OrderSkeleton() { return <SafeAreaView style={styles.container} edges={["top"]}><View style={styles.header}><View style={[styles.skeleton, { width: 120, height: 30 }]} /></View><View style={styles.list}>{[0, 1, 2].map((key) => <View key={key} style={styles.card}><View style={[styles.skeleton, { width: "55%" }]} /><View style={[styles.skeleton, { width: "35%" }]} /><View style={[styles.skeleton, { width: "80%" }]} /></View>)}</View></SafeAreaView>; }
function ScreenState({ message, loading, icon, action, onPress }: { message: string; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap; action?: string; onPress?: () => void }) { return <SafeAreaView style={styles.container}><View style={styles.state}>{loading ? <ActivityIndicator size="large" color="#10B981" /> : icon ? <Ionicons name={icon} size={64} color="#9CA3AF" /> : null}<Text style={styles.stateText}>{message}</Text>{action && <Pressable style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{action}</Text></Pressable>}</View></SafeAreaView>; }

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F9FAFB" }, header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, headerTitle: { fontSize: 28, fontWeight: "800", color: "#111827" }, headerSubtitle: { color: "#6B7280", marginTop: 3 }, list: { padding: 16, paddingBottom: 40, gap: 12 }, emptyList: { flexGrow: 1 }, card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 16, gap: 13 }, pressed: { opacity: 0.72 }, cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, flex: { flex: 1 }, orderNumber: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 }, muted: { color: "#6B7280", lineHeight: 20 }, badge: { backgroundColor: "#ECFDF5", color: "#047857", borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: "700" }, badgeProblem: { backgroundColor: "#FEF2F2", color: "#B91C1C" }, meta: { flexDirection: "row", alignItems: "center" }, metaText: { color: "#4B5563" }, dot: { color: "#9CA3AF", marginHorizontal: 8 }, cardBottom: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }, payment: { color: "#047857", fontWeight: "600", marginTop: 2 }, problemText: { color: "#B91C1C" }, total: { color: "#111827", fontSize: 18, fontWeight: "800" }, state: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28, gap: 16 }, stateText: { color: "#6B7280", fontSize: 16, textAlign: "center" }, button: { backgroundColor: "#10B981", borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13, marginTop: 6 }, buttonText: { color: "#FFF", fontWeight: "700", fontSize: 16 }, empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 }, emptyTitle: { color: "#111827", fontSize: 21, fontWeight: "700", marginTop: 14, marginBottom: 6 }, inlineError: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12 }, inlineErrorText: { color: "#B91C1C", textAlign: "center" }, footer: { paddingVertical: 20 }, skeleton: { height: 17, borderRadius: 6, backgroundColor: "#E5E7EB" } });
