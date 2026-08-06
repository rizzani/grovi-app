import { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { getPaymentMethods, deletePaymentMethod, PaymentMethod, formatPaymentMethod } from "../lib/payment-service";

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  onDelete: () => void;
  isDeleting: boolean;
}

function PaymentMethodCard({ paymentMethod, onDelete, isDeleting }: PaymentMethodCardProps) {
  const displayText = formatPaymentMethod(paymentMethod);

  return (
    <View style={[styles.paymentMethodCard, isDeleting && styles.paymentMethodCardDeleting]}>
      <View style={styles.paymentMethodCardContent}>
        <View style={styles.paymentMethodCardLeft}>
          <View style={styles.paymentMethodIconContainer}>
            {paymentMethod.type === "cash_on_delivery" ? (
              <Ionicons name="cash-outline" size={24} color="#10B981" />
            ) : (
              <Ionicons name="card-outline" size={24} color="#10B981" />
            )}
          </View>
          <View style={styles.paymentMethodText}>
            <Text style={styles.paymentMethodDisplayText}>{displayText}</Text>
            {paymentMethod.label && (
              <Text style={styles.paymentMethodLabel}>{paymentMethod.label}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          activeOpacity={0.7}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      const result = await getPaymentMethods(userId);
      setPaymentMethods(result);
    } catch (err: any) {
      setError(err.message || "Failed to load payment methods");
      console.error("Error loading payment methods:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadPaymentMethods();
    }, [loadPaymentMethods])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const handleDelete = (paymentMethod: PaymentMethod) => {
    const displayText = formatPaymentMethod(paymentMethod);

    Alert.alert(
      "Remove Payment Method",
      `Are you sure you want to remove "${displayText}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setDeletingId(paymentMethod.$id);
            try {
              await deletePaymentMethod(paymentMethod.$id);
              await loadPaymentMethods();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove payment method");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  if (isLoading && paymentMethods.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {error && paymentMethods.length === 0 ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadPaymentMethods}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : paymentMethods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No payment methods</Text>
            <Text style={styles.emptyText}>
              You haven&apos;t saved any payment methods yet.
            </Text>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                You can add a payment method during checkout
              </Text>
            </View>
          </View>
        ) : (
          <>
            {paymentMethods.map((paymentMethod) => (
              <PaymentMethodCard
                key={paymentMethod.$id}
                paymentMethod={paymentMethod}
                onDelete={() => handleDelete(paymentMethod)}
                isDeleting={deletingId === paymentMethod.$id}
              />
            ))}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                To add a new payment method, go to checkout
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
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
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  paymentMethodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    padding: 16,
  },
  paymentMethodCardDeleting: {
    opacity: 0.6,
  },
  paymentMethodCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentMethodCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  paymentMethodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentMethodText: {
    flex: 1,
  },
  paymentMethodDisplayText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  paymentMethodLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
