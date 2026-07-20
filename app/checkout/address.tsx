import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCheckout } from "../../contexts/CheckoutContext";
import { useUser } from "../../contexts/UserContext";
import { Address, getAddresses } from "../../lib/profile-service";

const formatAddress = (address: Address) =>
  [address.houseDetails, address.street, address.community, address.parish]
    .filter(Boolean)
    .join(", ");

export default function CheckoutAddressScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const { selectedAddressId, setSelectedAddressId } = useCheckout();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setAddresses(await getAddresses(userId));
    } catch (err: any) {
      setError(err.message || "Failed to load addresses");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadAddresses();
    }, [loadAddresses])
  );

  const selectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Address</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push("/address-form")}>
          <Ionicons name="add" size={26} color="#10B981" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.secondaryText}>Loading addresses...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.secondaryText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={loadAddresses}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="location-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No delivery addresses</Text>
          <Text style={styles.secondaryText}>Add an address, then return here to select it for checkout.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/address-form")}>
            <Text style={styles.primaryButtonText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.helperText}>Select one address for this delivery. This does not change your account default.</Text>
          {addresses.map((address) => {
            const isSelected = address.$id === selectedAddressId;
            return (
              <TouchableOpacity
                key={address.$id}
                style={[styles.addressCard, isSelected && styles.selectedCard]}
                onPress={() => selectAddress(address.$id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={isSelected ? "#10B981" : "#9CA3AF"}
                />
                <View style={styles.addressContent}>
                  <View style={styles.labelRow}>
                    <Text style={styles.addressLabel}>{address.label}</Text>
                    {address.default && <Text style={styles.defaultBadge}>Default</Text>}
                  </View>
                  <Text style={styles.secondaryText}>{formatAddress(address)}</Text>
                  <Text style={styles.secondaryText} numberOfLines={2}>{address.landmarkDirections}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.addButton} onPress={() => router.push("/address-form")}>
            <Ionicons name="add-circle-outline" size={20} color="#10B981" />
            <Text style={styles.addButtonText}>Add Another Address</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  content: { padding: 16 },
  helperText: { fontSize: 14, lineHeight: 20, color: "#6B7280", marginBottom: 14 },
  addressCard: { flexDirection: "row", gap: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, marginBottom: 12 },
  selectedCard: { borderColor: "#10B981", borderWidth: 2, backgroundColor: "#F0FDF4" },
  addressContent: { flex: 1, gap: 5 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addressLabel: { fontSize: 16, fontWeight: "600", color: "#111827" },
  defaultBadge: { fontSize: 11, fontWeight: "600", color: "#FFFFFF", backgroundColor: "#10B981", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  secondaryText: { fontSize: 14, lineHeight: 20, color: "#6B7280", textAlign: "center" },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, marginTop: 4 },
  addButtonText: { color: "#10B981", fontSize: 16, fontWeight: "600" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#111827" },
  primaryButton: { backgroundColor: "#10B981", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
