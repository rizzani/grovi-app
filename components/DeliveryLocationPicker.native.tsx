import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Coordinates, getCurrentLocation, GeocodedLocation, geocodeAddress, reverseGeocode } from "../lib/location-utils";

interface Props { initialLocation?: Coordinates; onConfirm: (location: GeocodedLocation) => void; }
const DEFAULT_REGION: Region = { latitude: 18.1096, longitude: -77.2975, latitudeDelta: 4.2, longitudeDelta: 4.2 };

export function DeliveryLocationPicker({ initialLocation, onConfirm }: Props) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [region, setRegion] = useState<Region>({ ...DEFAULT_REGION, ...(initialLocation ?? {}) });
  const regionRef = useRef(region);
  const mapRef = useRef<MapView | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectCoordinates = useCallback(async (coordinates: Coordinates, moveMap = true) => {
    if (moveMap) {
      const nextRegion = { ...regionRef.current, ...coordinates };
      regionRef.current = nextRegion;
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 300);
    }
    setBusy(true); setError(null);
    try { const result = await reverseGeocode(coordinates); setLocation(result); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not identify this location."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (initialLocation) void selectCoordinates(initialLocation, false); }, [initialLocation, selectCoordinates]);

  async function search() {
    setBusy(true); setError(null);
    try {
      const results = await geocodeAddress(query);
      if (!results[0]) throw new Error("No matching address found. Try adding a community or parish.");
      setLocation(results[0]);
      const nextRegion = { ...regionRef.current, latitude: results[0].latitude, longitude: results[0].longitude };
      regionRef.current = nextRegion;
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 300);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Address search failed."); }
    finally { setBusy(false); }
  }

  async function useCurrentLocation() {
    setBusy(true); setError(null);
    try { await selectCoordinates(await getCurrentLocation()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not obtain your location."); setBusy(false); }
  }

  function handleMapSettled(nextRegion: Region) {
    regionRef.current = nextRegion;
    setRegion(nextRegion);
    // This is a user map movement, so reverse-geocode without animating the
    // camera again. That prevents a map/reverse-geocode feedback loop.
    void selectCoordinates({ latitude: nextRegion.latitude, longitude: nextRegion.longitude }, false);
  }

  return <View style={styles.container}>
    <View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder="Search for an address" style={styles.input} returnKeyType="search" /><TouchableOpacity style={styles.searchButton} onPress={search} disabled={busy}><Ionicons name="search" size={21} color="#fff" /></TouchableOpacity></View>
    <TouchableOpacity style={styles.currentButton} onPress={useCurrentLocation} disabled={busy}><Ionicons name="navigate" size={19} color="#10B981" /><Text style={styles.currentText}>{busy ? "Obtaining location..." : "Use Current Location"}</Text></TouchableOpacity>
    <View style={styles.mapContainer}>
      <MapView ref={mapRef} style={styles.map} initialRegion={region} onRegionChangeComplete={handleMapSettled} />
      <View pointerEvents="none" style={styles.centerPin}><Ionicons name="location" size={44} color="#EF4444" /><View style={styles.pinShadow} /></View>
    </View>
    <Text style={styles.hint}>Move the map until the pin is over your delivery point, then confirm.</Text>
    {error && <Text style={styles.error}>{error}</Text>}
    {location && <View style={styles.result}><Text style={styles.address}>{location.formattedAddress}</Text><Text style={styles.meta}>{[location.community, location.parish].filter(Boolean).join(", ")}</Text><TouchableOpacity style={styles.confirmButton} onPress={() => onConfirm(location)} disabled={busy}><Text style={styles.confirmText}>Confirm Location</Text></TouchableOpacity></View>}
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, gap: 10 }, searchRow: { flexDirection: "row", gap: 8 }, input: { flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 12, height: 46, backgroundColor: "#FFF" }, searchButton: { width: 46, borderRadius: 10, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" }, currentButton: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 11, borderWidth: 1, borderColor: "#A7F3D0", borderRadius: 10, backgroundColor: "#ECFDF5" }, currentText: { color: "#047857", fontWeight: "600" }, mapContainer: { flex: 1, minHeight: 320, borderRadius: 14, overflow: "hidden", position: "relative" }, map: { flex: 1 }, centerPin: { position: "absolute", top: "50%", left: "50%", marginLeft: -22, marginTop: -42, alignItems: "center" }, pinShadow: { width: 10, height: 4, borderRadius: 5, backgroundColor: "#9CA3AF", opacity: 0.55 }, hint: { color: "#6B7280", fontSize: 13 }, error: { color: "#DC2626", fontSize: 14 }, result: { padding: 14, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D1D5DB", gap: 5 }, address: { color: "#111827", fontWeight: "600" }, meta: { color: "#6B7280" }, confirmButton: { backgroundColor: "#10B981", borderRadius: 10, padding: 13, alignItems: "center", marginTop: 6 }, confirmText: { color: "#FFF", fontWeight: "700" } });
