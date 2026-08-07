import { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useUser } from "../contexts/UserContext";
import {
  getNotificationPreferences,
  createOrUpdateNotificationPreferences,
  NotificationPreferences,
} from "../lib/notification-preferences-service";
import {
  requestPushPermissions,
  getPushPermissionStatus,
  registerAndStorePushToken,
  clearPushToken,
} from "../lib/push-notification-service";
import Constants from "expo-constants";
import { Platform } from "react-native";

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  showWarning?: boolean;
  warningText?: string;
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  showWarning = false,
  warningText,
}: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleRowLeft}>
        <View style={styles.toggleIconContainer}>
          <Ionicons name={icon} size={22} color="#10B981" />
        </View>
        <View style={styles.toggleRowText}>
          <Text style={styles.toggleRowTitle}>{title}</Text>
          {description && (
            <Text style={styles.toggleRowDescription}>{description}</Text>
          )}
          {showWarning && warningText && (
            <View style={styles.warningContainer}>
              <Ionicons name="alert-circle" size={14} color="#F59E0B" />
              <Text style={styles.warningText}>{warningText}</Text>
            </View>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#D1D5DB", true: "#10B981" }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D1D5DB"
      />
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { userId, isLoading: userLoading } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Local state for toggles
  const [orderUpdatesEnabled, setOrderUpdatesEnabled] = useState(true);
  const [promotionsEnabled, setPromotionsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  
  // Push permission state
  const [pushPermissionStatus, setPushPermissionStatus] = useState<{
    granted: boolean;
    canAskAgain: boolean;
  } | null>(null);

  // Load preferences when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [userId])
  );

  const loadPreferences = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userPreferences = await getNotificationPreferences(userId);
      
      if (userPreferences) {
        setPreferences(userPreferences);
        setOrderUpdatesEnabled(userPreferences.orderUpdatesEnabled);
        setPromotionsEnabled(userPreferences.promotionsEnabled);
        setPushEnabled(userPreferences.pushEnabled);
        setEmailEnabled(userPreferences.emailEnabled);
        setSmsEnabled(userPreferences.smsEnabled);
      } else {
        // No preferences yet - use defaults
        setOrderUpdatesEnabled(true);
        setPromotionsEnabled(true);
        setPushEnabled(false);
        setEmailEnabled(true);
        setSmsEnabled(false);
      }
      
      // Check push permission status
      const permissionStatus = await getPushPermissionStatus();
      setPushPermissionStatus(permissionStatus);
    } catch (err: any) {
      console.error("Failed to load notification preferences:", err);
      setError(err.message || "Failed to load notification preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderUpdatesToggle = (value: boolean) => {
    setOrderUpdatesEnabled(value);
    setHasChanges(true);
  };

  const handlePromotionsToggle = (value: boolean) => {
    setPromotionsEnabled(value);
    setHasChanges(true);
  };

  const handlePushToggle = async (value: boolean) => {
    if (!userId) return;

    // Check if we're in Expo Go (which has limitations)
    const isExpoGo = Constants.appOwnership === 'expo';
    
    if (value) {
      // Check for Expo Go limitations
      if (isExpoGo && Platform.OS === 'android') {
        Alert.alert(
          "Development Build Required",
          "Android push notifications are not supported in Expo Go. Please use a development build to test push notifications.\n\nSee: https://docs.expo.dev/develop/development-builds/introduction/",
          [{ text: "OK" }]
        );
        setPushEnabled(false);
        return;
      }

      // User wants to enable push - request permissions
      const permissionStatus = await requestPushPermissions();
      setPushPermissionStatus(permissionStatus);

      if (permissionStatus.granted) {
        // Permissions granted - register and store token
        setPushEnabled(true);
        setHasChanges(true);
        
        try {
          const token = await registerAndStorePushToken(userId);
          if (!token) {
            // Token registration failed (might be Expo Go or project ID issue)
            if (isExpoGo) {
              Alert.alert(
                "Development Build Required",
                "Push notifications require a development build. Expo Go has limited support.",
                [{ text: "OK" }]
              );
            } else {
              Alert.alert(
                "Configuration Required",
                "Push notifications are not configured. Please ensure your Expo project ID is set in app.json or .env file.",
                [{ text: "OK" }]
              );
            }
            setPushEnabled(false);
            return;
          }
        } catch (err: any) {
          console.error("Failed to register push token:", err);
          
          // Check for specific error messages
          if (err.message?.includes("Expo Go") || err.message?.includes("development build")) {
            Alert.alert(
              "Development Build Required",
              "Push notifications require a development build. Expo Go has limited support.",
              [{ text: "OK" }]
            );
          } else if (err.message?.includes("projectId") || err.message?.includes("project ID")) {
            Alert.alert(
              "Configuration Required",
              "Push notifications are not configured. Please ensure your Expo project ID is set in app.json or .env file.",
              [{ text: "OK" }]
            );
          } else {
            Alert.alert(
              "Error",
              "Failed to register for push notifications. Please try again."
            );
          }
          setPushEnabled(false);
          return;
        }
      } else {
        // Permissions denied
        Alert.alert(
          "Permission Denied",
          "Push notifications require permission. Please enable them in your device settings.",
          [{ text: "OK" }]
        );
        setPushEnabled(false);
        return;
      }
    } else {
      // User wants to disable push - clear token
      setPushEnabled(false);
      setHasChanges(true);
      
      try {
        await clearPushToken(userId);
      } catch (err: any) {
        console.error("Failed to clear push token:", err);
      }
    }
  };

  const handleEmailToggle = (value: boolean) => {
    setEmailEnabled(value);
    setHasChanges(true);
  };

  const handleSmsToggle = (value: boolean) => {
    setSmsEnabled(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createOrUpdateNotificationPreferences({
        userId,
        orderUpdatesEnabled,
        promotionsEnabled,
        pushEnabled,
        emailEnabled,
        smsEnabled,
      });

      // Reload preferences to get the actual updatedAt from server
      const updatedPrefs = await getNotificationPreferences(userId);
      if (updatedPrefs) {
        setPreferences(updatedPrefs);
      }
      setHasChanges(false);

      // Show success confirmation
      Alert.alert("Success", "Your notification preferences have been saved!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      console.error("Failed to save notification preferences:", err);
      setError(err.message || "Failed to save notification preferences");
      Alert.alert("Error", "Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (userLoading || isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>
            Please sign in to manage notification preferences
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.replace("/sign-in")}
          >
            <Text style={styles.errorButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pushPermissionDenied = pushPermissionStatus !== null && !pushPermissionStatus.granted && !pushPermissionStatus.canAskAgain;
  const isExpoGo = Constants.appOwnership === 'expo';
  const showExpoGoWarning = isExpoGo && Platform.OS === 'android';

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Error Message */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Expo Go Warning */}
        {showExpoGoWarning && (
          <View style={styles.warningBanner}>
            <Ionicons name="information-circle" size={20} color="#F59E0B" />
            <View style={styles.warningBannerContent}>
              <Text style={styles.warningBannerTitle}>
                Development Build Required
              </Text>
              <Text style={styles.warningBannerText}>
                Android push notifications are not supported in Expo Go. Please use a development build to test push notifications.
              </Text>
            </View>
          </View>
        )}

        {/* Notification Types Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Notification Types</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Choose what types of notifications you want to receive
          </Text>
          
          <View style={styles.toggleGroup}>
            <ToggleRow
              icon="bag-outline"
              title="Order Updates"
              description="Get notified about your order status, delivery updates, and more"
              value={orderUpdatesEnabled}
              onValueChange={handleOrderUpdatesToggle}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon="pricetag-outline"
              title="Promotions"
              description="Receive special offers, discounts, and promotional notifications"
              value={promotionsEnabled}
              onValueChange={handlePromotionsToggle}
            />
          </View>
        </View>

        {/* Notification Channels Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Notification Channels</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Choose how you want to receive notifications
          </Text>
          
          <View style={styles.toggleGroup}>
            <ToggleRow
              icon="phone-portrait-outline"
              title="Push Notifications"
              description="Receive notifications on your device"
              value={pushEnabled}
              onValueChange={handlePushToggle}
              showWarning={pushPermissionDenied}
              warningText="Permission denied. Enable in device settings."
            />
            <View style={styles.divider} />
            <ToggleRow
              icon="mail-outline"
              title="Email"
              description="Receive notifications via email"
              value={emailEnabled}
              onValueChange={handleEmailToggle}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon="chatbubble-outline"
              title="SMS"
              description="Receive notifications via text message"
              value={smsEnabled}
              onValueChange={handleSmsToggle}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (isSaving || !hasChanges) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving || !hasChanges}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                {hasChanges ? "Save Preferences" : "No Changes"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
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
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  errorButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#DC2626",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  warningBannerContent: {
    flex: 1,
  },
  warningBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  warningBannerText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  toggleGroup: {
    gap: 0,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  toggleRowLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  toggleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  toggleRowText: {
    flex: 1,
  },
  toggleRowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  toggleRowDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#F59E0B",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginLeft: 52,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSpacing: {
    height: 20,
  },
});
