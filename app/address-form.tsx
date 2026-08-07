import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useUser } from "../contexts/UserContext";
import {
  createAddress,
  updateAddress,
  getAddresses,
  CreateAddressParams,
  UpdateAddressParams,
} from "../lib/profile-service";
import { validatePhoneNumber, normalizePhoneNumber } from "../lib/phone-validation";
import { JAMAICA_PARISHES, isValidJamaicaParish } from "../lib/jamaica-parishes";
import { isValidCoordinates, GeocodedLocation } from "../lib/location-utils";
import { consumePendingLocation } from "../lib/location-selection";
import { AnalyticsEvent, trackEvent } from "../lib/analytics";

export default function AddressFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId, user } = useUser();
  const addressId = Array.isArray(params.addressId) 
    ? params.addressId[0] 
    : (params.addressId as string | undefined);
  const isEditing = !!addressId;

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(isEditing);
  const [showParishPicker, setShowParishPicker] = useState(false);

  // Form state
  const [label, setLabel] = useState("");
  const [parish, setParish] = useState("");
  const [community, setCommunity] = useState("");
  const [street, setStreet] = useState("");
  const [houseDetails, setHouseDetails] = useState("");
  const [landmarkDirections, setLandmarkDirections] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [useMainNumber, setUseMainNumber] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeocodedLocation | null>(null);

  // Error states
  const [labelError, setLabelError] = useState<string | null>(null);
  const [parishError, setParishError] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [houseDetailsError, setHouseDetailsError] = useState<string | null>(null);
  const [landmarkDirectionsError, setLandmarkDirectionsError] = useState<string | null>(null);
  const [contactPhoneError, setContactPhoneError] = useState<string | null>(null);

  // Focus states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Load address if editing
  useEffect(() => {
    if (isEditing && userId && addressId) {
      loadAddress();
    } else if (!isEditing && user?.phone) {
      // Pre-fill with main number option checked
      setUseMainNumber(true);
    }
  }, [isEditing, userId, addressId, user?.phone]);

  useEffect(() => {
    if (typeof params.location !== "string") return;
    try {
      const location = JSON.parse(params.location) as GeocodedLocation;
      if (isValidCoordinates(location)) {
        setSelectedLocation(location);
        setParish((current) => current || location.parish || "");
        setCommunity((current) => current || location.community || "");
        setStreet((current) => current || location.street || "");
        setHouseDetails((current) => current || location.houseDetails || "");
      }
    } catch { setSelectedLocation(null); }
  }, [params.location]);

  useFocusEffect(useCallback(() => {
    const location = consumePendingLocation();
    if (!location || !isValidCoordinates(location)) return;
    setSelectedLocation(location);
    setParish((current) => current || location.parish || "");
    setCommunity((current) => current || location.community || "");
    setStreet((current) => current || location.street || "");
    setHouseDetails((current) => current || location.houseDetails || "");
  }, []));

  // Update contact phone when useMainNumber changes
  useEffect(() => {
    if (useMainNumber && user?.phone) {
      setContactPhone(user.phone);
      setContactPhoneError(null);
    } else if (useMainNumber && !user?.phone) {
      setContactPhone("");
    }
  }, [useMainNumber, user?.phone]);

  const loadAddress = async () => {
    if (!userId || !addressId) return;

    try {
      setIsLoadingAddress(true);
      const addresses = await getAddresses(userId);
      const address = addresses.find((a) => a.$id === addressId);

      if (address) {
        setLabel(address.label || "");
        setParish(address.parish || "");
        setCommunity(address.community || "");
        setStreet(address.street || "");
        setHouseDetails(address.houseDetails || "");
        setLandmarkDirections(address.landmarkDirections || "");
        setContactPhone(address.contactPhone || "");
        setUseMainNumber(!address.contactPhone || address.contactPhone === user?.phone);
        setIsDefault(address.default);
        if (isValidCoordinates({ latitude: address.latitude ?? NaN, longitude: address.longitude ?? NaN })) {
          setSelectedLocation({ latitude: address.latitude!, longitude: address.longitude!, formattedAddress: address.formattedAddress || address.deliveryAddress || "" });
        }
      } else {
        Alert.alert("Error", "Address not found", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (caught: any) {
      Alert.alert("Error", caught.message || "Failed to load address", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;

    // Label is required (2-30 chars)
    if (!label.trim()) {
      setLabelError("Address label is required");
      isValid = false;
    } else if (label.trim().length < 2) {
      setLabelError("Label must be at least 2 characters");
      isValid = false;
    } else if (label.trim().length > 30) {
      setLabelError("Label must be 30 characters or less");
      isValid = false;
    }

    // Parish is required
    if (!parish.trim()) {
      setParishError("Parish is required");
      isValid = false;
    } else if (!isValidJamaicaParish(parish)) {
      setParishError("Please select a valid parish");
      isValid = false;
    }

    // Community is required (2-60 chars)
    if (!community.trim()) {
      setCommunityError("Community/Area is required");
      isValid = false;
    } else if (community.trim().length < 2) {
      setCommunityError("Community must be at least 2 characters");
      isValid = false;
    } else if (community.trim().length > 60) {
      setCommunityError("Community must be 60 characters or less");
      isValid = false;
    }

    // Street is optional (0-60 chars)
    if (street.trim().length > 60) {
      setStreetError("Street must be 60 characters or less");
      isValid = false;
    }

    // House details is optional (0-30 chars)
    if (houseDetails.trim().length > 30) {
      setHouseDetailsError("House details must be 30 characters or less");
      isValid = false;
    }

    // Landmark directions are optional (0-240 chars).
    if (landmarkDirections.trim().length > 240) {
      setLandmarkDirectionsError("Directions must be 240 characters or less");
      isValid = false;
    }

    // Contact phone is optional but if provided, must be valid
    if (contactPhone.trim() && !useMainNumber) {
      const phoneValidation = validatePhoneNumber(contactPhone);
      if (!phoneValidation.isValid) {
        setContactPhoneError(phoneValidation.error || "Invalid phone number");
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setLabelError(null);
    setParishError(null);
    setCommunityError(null);
    setStreetError(null);
    setHouseDetailsError(null);
    setLandmarkDirectionsError(null);
    setContactPhoneError(null);

    if (!validateForm()) {
      return;
    }

    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!selectedLocation || !isValidCoordinates(selectedLocation)) {
      Alert.alert("Delivery location required", "Search for your address, use your current location, or place the pin on the map before saving.");
      return;
    }

    setIsLoading(true);

    try {
      const finalContactPhone = useMainNumber && user?.phone 
        ? normalizePhoneNumber(user.phone) 
        : (contactPhone.trim() ? normalizePhoneNumber(contactPhone.trim()) : undefined);

      if (isEditing && addressId) {
        // Update existing address
        const updateParams: UpdateAddressParams = {
          addressId,
          label: label.trim(),
          parish: parish.trim(),
          community: community.trim(),
          street: street.trim() || undefined,
          houseDetails: houseDetails.trim() || undefined,
          landmarkDirections: landmarkDirections.trim(),
          contactPhone: finalContactPhone,
          isDefault,
          deliveryAddress: selectedLocation.formattedAddress,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          formattedAddress: selectedLocation.formattedAddress,
          locationUpdatedAt: new Date().toISOString(),
        };

        await updateAddress(updateParams);
        void trackEvent(AnalyticsEvent.LocationSelected, { deliveryArea: parish.trim() }, userId);
        Alert.alert("Success", "Address updated successfully", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        // Create new address
        const createParams: CreateAddressParams = {
          userId,
          label: label.trim(),
          parish: parish.trim(),
          community: community.trim(),
          street: street.trim() || undefined,
          houseDetails: houseDetails.trim() || undefined,
          landmarkDirections: landmarkDirections.trim(),
          contactPhone: finalContactPhone,
          isDefault,
          deliveryAddress: selectedLocation.formattedAddress,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          formattedAddress: selectedLocation.formattedAddress,
          locationUpdatedAt: new Date().toISOString(),
        };

        await createAddress(createParams);
        void trackEvent(AnalyticsEvent.LocationSelected, { deliveryArea: parish.trim() }, userId);
        Alert.alert("Success", "Address added successfully", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (caught: any) {
      Alert.alert("Error", caught.message || "Failed to save address");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingAddress) {
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
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Address" : "Add Address"}
          </Text>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Address" : "Add Address"}
          </Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Address Information Section */}
          <View style={styles.sectionGroup}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag" size={18} color="#10B981" />
              <Text style={styles.sectionHeaderText}>Address Information</Text>
            </View>

            {/* Address Label */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Address Label <Text style={styles.requiredText}>*</Text>
              </Text>
              <Text style={styles.helpText}>
                e.g. Home, Work, Mom House
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "label" && styles.inputContainerFocused,
                  labelError && styles.inputContainerError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={label}
                  onChangeText={(text) => {
                    setLabel(text);
                    setLabelError(null);
                  }}
                  onFocus={() => setFocusedField("label")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. Home, Work, Mom House"
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                  autoCapitalize="words"
                  maxLength={30}
                />
              </View>
              {labelError && <Text style={styles.errorText}>{labelError}</Text>}
            </View>

            {/* Default Address Toggle */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.defaultToggle}
                onPress={() => setIsDefault(!isDefault)}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <View style={styles.defaultToggleLeft}>
                  <Ionicons
                    name={isDefault ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={isDefault ? "#10B981" : "#9CA3AF"}
                  />
                  <View style={styles.defaultToggleText}>
                    <Text style={styles.defaultToggleTitle}>Set as Default Address</Text>
                    <Text style={styles.defaultToggleSubtitle}>
                      Use this address for all deliveries
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Finding Your Address Section */}
          <View style={styles.sectionGroup}>
            <View style={styles.sectionHeader}>
              <Ionicons name="navigate" size={18} color="#10B981" />
              <Text style={styles.sectionHeaderText}>Finding Your Address</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Map location <Text style={styles.requiredText}>*</Text></Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => router.push({ pathname: "/location-picker", params: { addressId, latitude: selectedLocation?.latitude, longitude: selectedLocation?.longitude } } as unknown as Href)}
                disabled={isLoading}
              >
                <Ionicons name={selectedLocation ? "checkmark-circle" : "map-outline"} size={22} color="#10B981" />
                <View style={styles.locationButtonContent}>
                  <Text style={styles.locationButtonTitle}>{selectedLocation ? "Location selected" : "Choose delivery location"}</Text>
                  <Text style={styles.helpText} numberOfLines={2}>{selectedLocation?.formattedAddress || "Search an address, use GPS, or drag the map pin."}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location Details Section */}
          <View style={styles.sectionGroup}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={18} color="#10B981" />
              <Text style={styles.sectionHeaderText}>Location Details</Text>
            </View>

            {/* House / Lot / Apt Details */}
            <View style={[styles.section, styles.optionalSection]}>
              <Text style={styles.sectionLabel}>
                House / Lot / Apt Details <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <Text style={styles.helpText}>
                e.g. Lot 24, House 5B, Apt 2
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "houseDetails" && styles.inputContainerFocused,
                  houseDetailsError && styles.inputContainerError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={houseDetails}
                  onChangeText={(text) => {
                    setHouseDetails(text);
                    setHouseDetailsError(null);
                  }}
                  onFocus={() => setFocusedField("houseDetails")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. Lot 24, House 5B, Apt 2"
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                  autoCapitalize="words"
                  maxLength={30}
                />
              </View>
              {houseDetailsError && <Text style={styles.errorText}>{houseDetailsError}</Text>}
            </View>

            {/* Street / Scheme / Road */}
            <View style={[styles.section, styles.optionalSection]}>
              <Text style={styles.sectionLabel}>
                Street / Scheme / Road <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <Text style={styles.helpText}>
                e.g. West Henderson Blvd, Independence City
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "street" && styles.inputContainerFocused,
                  streetError && styles.inputContainerError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={street}
                  onChangeText={(text) => {
                    setStreet(text);
                    setStreetError(null);
                  }}
                  onFocus={() => setFocusedField("street")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. West Henderson Blvd, Independence City"
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                  autoCapitalize="words"
                  maxLength={60}
                />
              </View>
              {streetError && <Text style={styles.errorText}>{streetError}</Text>}
            </View>

            {/* Community / Area */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Community / Area <Text style={styles.requiredText}>*</Text>
              </Text>
              <Text style={styles.helpText}>
                e.g. Portmore Pines, Greater Portmore, Half-Way Tree
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "community" && styles.inputContainerFocused,
                  communityError && styles.inputContainerError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={community}
                  onChangeText={(text) => {
                    setCommunity(text);
                    setCommunityError(null);
                  }}
                  onFocus={() => setFocusedField("community")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. Portmore Pines, Greater Portmore, Half-Way Tree"
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                  autoCapitalize="words"
                  maxLength={60}
                />
              </View>
              {communityError && <Text style={styles.errorText}>{communityError}</Text>}
            </View>

            {/* Parish */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Parish <Text style={styles.requiredText}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.inputContainer,
                  focusedField === "parish" && styles.inputContainerFocused,
                  parishError && styles.inputContainerError,
                  styles.pickerContainer,
                ]}
                onPress={() => setShowParishPicker(true)}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <Text style={[styles.input, !parish && styles.placeholderText]}>
                  {parish || "Select parish"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
              {parishError && <Text style={styles.errorText}>{parishError}</Text>}
            </View>

            {/* Contact Phone */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Contact Phone <Text style={styles.optionalText}>(Optional but Recommended)</Text>
              </Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => {
                  setUseMainNumber(!useMainNumber);
                  setContactPhoneError(null);
                }}
                activeOpacity={0.7}
                disabled={isLoading || !user?.phone}
              >
                <View style={styles.checkbox}>
                  {useMainNumber && (
                    <Ionicons name="checkmark" size={18} color="#10B981" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  Use my main number {user?.phone ? `(${user.phone})` : ""}
                </Text>
              </TouchableOpacity>
              {!useMainNumber && (
                <View
                  style={[
                    styles.inputContainer,
                    styles.phoneInputContainer,
                    focusedField === "contactPhone" && styles.inputContainerFocused,
                    contactPhoneError && styles.inputContainerError,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={contactPhone}
                    onChangeText={(text) => {
                      setContactPhone(text);
                      setContactPhoneError(null);
                    }}
                    onFocus={() => setFocusedField("contactPhone")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="876-XXX-XXXX"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    editable={!isLoading}
                  />
                </View>
              )}
              {contactPhoneError && <Text style={styles.errorText}>{contactPhoneError}</Text>}
            </View>

            {/* Landmark / Directions */}
            <View style={[styles.section, styles.optionalSection]}>
              <View style={styles.criticalFieldHeader}>
                <Ionicons name="alert-circle" size={18} color="#F59E0B" />
                <Text style={styles.sectionLabel}>
                  Landmark / Directions <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
              </View>
              <Text style={styles.helpText}>
                Optional extra context for the driver. Your map pin and address are used for delivery.
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  styles.criticalInputContainer,
                  focusedField === "landmarkDirections" && styles.inputContainerFocused,
                  landmarkDirectionsError && styles.inputContainerError,
                ]}
              >
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={landmarkDirections}
                  onChangeText={(text) => {
                    setLandmarkDirections(text);
                    setLandmarkDirectionsError(null);
                  }}
                  onFocus={() => setFocusedField("landmarkDirections")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. Grey gate, blue house beside the shop, across from the church. Call on arrival."
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                  multiline
                  numberOfLines={4}
                  maxLength={240}
                />
              </View>
              {landmarkDirectionsError && (
                <Text style={styles.errorText}>{landmarkDirectionsError}</Text>
              )}
              <Text style={styles.charCount}>
                {landmarkDirections.length}/240 characters
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditing ? "Update Address" : "Add Address"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Parish Picker Modal */}
        <Modal
          visible={showParishPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowParishPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Parish</Text>
                <TouchableOpacity
                  onPress={() => setShowParishPicker(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {JAMAICA_PARISHES.map((parishOption) => (
                  <TouchableOpacity
                    key={parishOption}
                    style={[
                      styles.parishOption,
                      parish === parishOption && styles.parishOptionSelected,
                    ]}
                    onPress={() => {
                      setParish(parishOption);
                      setParishError(null);
                      setShowParishPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.parishOptionText,
                        parish === parishOption && styles.parishOptionTextSelected,
                      ]}
                    >
                      {parishOption}
                    </Text>
                    {parish === parishOption && (
                      <Ionicons name="checkmark" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  keyboardView: {
    flex: 1,
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
  sectionGroup: {
    marginBottom: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  section: {
    marginBottom: 24,
  },
  optionalSection: {
    opacity: 0.85,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  criticalFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  criticalInputContainer: {
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
  },
  requiredText: {
    color: "#EF4444",
  },
  optionalText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#6B7280",
  },
  helpText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    lineHeight: 16,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#ECFDF5",
  },
  locationButtonContent: { flex: 1 },
  locationButtonTitle: { fontSize: 15, fontWeight: "600", color: "#047857", marginBottom: 3 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
  },
  inputContainerFocused: {
    borderColor: "#10B981",
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: "#EF4444",
  },
  pickerContainer: {
    justifyContent: "space-between",
  },
  phoneInputContainer: {
    marginTop: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    padding: 0,
  },
  placeholderText: {
    color: "#9CA3AF",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 4,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "right",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#10B981",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  defaultToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  defaultToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  defaultToggleText: {
    flex: 1,
  },
  defaultToggleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  defaultToggleSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  submitButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSpacing: {
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalScrollView: {
    maxHeight: 400,
  },
  parishOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  parishOptionSelected: {
    backgroundColor: "#F0FDF4",
  },
  parishOptionText: {
    fontSize: 16,
    color: "#374151",
  },
  parishOptionTextSelected: {
    color: "#10B981",
    fontWeight: "600",
  },
});
