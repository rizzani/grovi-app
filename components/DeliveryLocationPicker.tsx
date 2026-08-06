import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Coordinates, getCurrentLocation, GeocodedLocation, geocodeAddress, reverseGeocode } from "../lib/location-utils";

interface Props { initialLocation?: Coordinates; onConfirm: (location: GeocodedLocation) => void; }

export function DeliveryLocationPicker({ initialLocation, onConfirm }: Props) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: () => Promise<GeocodedLocation>) {
    setBusy(true); setError(null);
    try { setLocation(await action()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not identify this location."); }
    finally { setBusy(false); }
  }

  return <View style={styles.container}>
    <View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} placeholder="Search for an address" style={styles.input} /><TouchableOpacity style={styles.searchButton} disabled={busy} onPress={() => void resolve(async () => { const result = (await geocodeAddress(query))[0]; if (!result) throw new Error("No matching address found."); return result; })}><Ionicons name="search" size={21} color="#fff" /></TouchableOpacity></View>
    <TouchableOpacity style={styles.currentButton} disabled={busy} onPress={() => void resolve(async () => reverseGeocode(await getCurrentLocation()))}><Ionicons name="navigate" size={19} color="#10B981" /><Text style={styles.currentText}>{busy ? "Obtaining location..." : "Use Current Location"}</Text></TouchableOpacity>
    <View style={styles.webMap}><Ionicons name="map-outline" size={44} color="#10B981" /><Text style={styles.webMapTitle}>Map pin selection is available in the mobile app.</Text><Text style={styles.webMapText}>Search for an address or use your current location to continue.</Text></View>
    {initialLocation && !location && <Text style={styles.hint}>Existing coordinates are saved. Search again to update them on web.</Text>}
    {error && <Text style={styles.error}>{error}</Text>}
    {location && <View style={styles.result}><Text style={styles.address}>{location.formattedAddress}</Text><Text style={styles.meta}>{[location.community, location.parish].filter(Boolean).join(", ")}</Text><TouchableOpacity style={styles.confirmButton} onPress={() => onConfirm(location)}><Text style={styles.confirmText}>Confirm Location</Text></TouchableOpacity></View>}
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, gap: 10 }, searchRow: { flexDirection: "row", gap: 8 }, input: { flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 12, height: 46, backgroundColor: "#FFF" }, searchButton: { width: 46, borderRadius: 10, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" }, currentButton: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 11, borderWidth: 1, borderColor: "#A7F3D0", borderRadius: 10, backgroundColor: "#ECFDF5" }, currentText: { color: "#047857", fontWeight: "600" }, webMap: { flex: 1, minHeight: 320, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", padding: 24, gap: 10 }, webMapTitle: { color: "#047857", fontWeight: "700", textAlign: "center" }, webMapText: { color: "#6B7280", textAlign: "center" }, hint: { color: "#6B7280", fontSize: 13 }, error: { color: "#DC2626", fontSize: 14 }, result: { padding: 14, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D1D5DB", gap: 5 }, address: { color: "#111827", fontWeight: "600" }, meta: { color: "#6B7280" }, confirmButton: { backgroundColor: "#10B981", borderRadius: 10, padding: 13, alignItems: "center", marginTop: 6 }, confirmText: { color: "#FFF", fontWeight: "700" } });
