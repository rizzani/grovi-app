import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DeliveryLocationPicker } from "../components/DeliveryLocationPicker";
import { GeocodedLocation } from "../lib/location-utils";
import { setPendingLocation } from "../lib/location-selection";

export default function LocationPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ addressId?: string; latitude?: string; longitude?: string }>();
  const initialLocation = params.latitude && params.longitude ? { latitude: Number(params.latitude), longitude: Number(params.longitude) } : undefined;
  const confirm = (location: GeocodedLocation) => {
    setPendingLocation(location);
    router.back();
  };
  return <SafeAreaView style={styles.container}><View style={styles.header}><Text style={styles.title}>Set Delivery Location</Text><Text style={styles.subtitle}>Choose the exact place where you want your groceries delivered.</Text></View><DeliveryLocationPicker initialLocation={initialLocation} onConfirm={confirm} /></SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16 }, header: { marginBottom: 12, gap: 4 }, title: { fontSize: 22, fontWeight: "700", color: "#111827" }, subtitle: { color: "#6B7280", lineHeight: 20 } });
