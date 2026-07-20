import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import OrderDetailsView from "../../components/OrderDetailsView";
import { useUser } from "../../contexts/UserContext";
import { useOrderDetails } from "../../lib/use-order-details";

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { userId, isAuthenticated, isLoading: authLoading } = useUser();
  const { details, loading, error, reload } = useOrderDetails(id, userId);

  if (authLoading || loading) return <State loading message="Loading order…" />;
  if (!isAuthenticated || !userId) return <State message="Sign in to view this order." action="Sign In" onPress={() => router.replace("/sign-in")} />;
  if (!id) return <State message="This order link is invalid." action="View Orders" onPress={() => router.replace("/(tabs)/orders")} />;
  if (error || !details) return <State message={error || "Order not found."} action={error === "Order not found." ? "View Orders" : "Retry"} onPress={error === "Order not found." ? () => router.replace("/(tabs)/orders") : reload} />;

  return <SafeAreaView style={styles.container} edges={["top", "bottom"]}><View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#111827" /></Pressable><Text style={styles.headerTitle}>Order</Text><View style={styles.back} /></View><OrderDetailsView details={details} /></SafeAreaView>;
}

function State({ message, loading, action, onPress }: { message: string; loading?: boolean; action?: string; onPress?: () => void }) { return <SafeAreaView style={styles.container}><View style={styles.state}>{loading && <ActivityIndicator size="large" color="#10B981" />}<Text style={styles.message}>{message}</Text>{action && <Pressable style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{action}</Text></Pressable>}</View></SafeAreaView>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F9FAFB" }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }, message: { color: "#6B7280", textAlign: "center", fontSize: 16 }, button: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 22 }, buttonText: { color: "#FFF", fontWeight: "700" } });
