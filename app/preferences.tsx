import { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useUser } from "../contexts/UserContext";
import {
  getPreferences,
  createOrUpdatePreferences,
} from "../lib/preferences-service";

// Available dietary preferences
const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "No Pork",
  "No Red Meat",
  "No Shellfish",
  "No Dairy",
  "Gluten-Free",
  "Nut-Free",
  "Low Sodium",
  "Organic Only",
];

// Available category preferences
const CATEGORY_OPTIONS = [
  "Snacks",
  "Beverages",
  "Household",
  "Baby",
  "Health",
  "Fruits & Vegetables",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Frozen Foods",
];

interface PreferenceTagProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

function PreferenceTag({ label, selected, onToggle }: PreferenceTagProps) {
  return (
    <TouchableOpacity
      style={[styles.tag, selected && styles.tagSelected]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark" size={16} color="#FFFFFF" style={styles.tagIcon} />
      )}
    </TouchableOpacity>
  );
}

export default function PreferencesScreen() {
  const router = useRouter();
  const { userId, isLoading: userLoading } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userPreferences = await getPreferences(userId);
      
      if (userPreferences) {
        setSelectedDietary(userPreferences.dietaryPreferences || []);
        setSelectedCategories(userPreferences.categoryPreferences || []);
      } else {
        // No preferences yet - start with empty arrays
        setSelectedDietary([]);
        setSelectedCategories([]);
      }
    } catch (err: any) {
      console.error("Failed to load preferences:", err);
      setError(err.message || "Failed to load preferences");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load preferences when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  const toggleDietary = (option: string) => {
    setSelectedDietary((prev) => {
      const newSelection = prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option];
      setHasChanges(true);
      return newSelection;
    });
  };

  const toggleCategory = (option: string) => {
    setSelectedCategories((prev) => {
      const newSelection = prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option];
      setHasChanges(true);
      return newSelection;
    });
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createOrUpdatePreferences({
        userId,
        dietaryPreferences: selectedDietary,
        categoryPreferences: selectedCategories,
      });

      // Reload preferences to preserve the existing post-save refresh.
      await getPreferences(userId);
      setHasChanges(false);

      // Show success confirmation
      Alert.alert("Success", "Your preferences have been saved!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      console.error("Failed to save preferences:", err);
      setError(err.message || "Failed to save preferences");
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
          <Text style={styles.headerTitle}>Preferences</Text>
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
          <Text style={styles.headerTitle}>Preferences</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Please sign in to manage preferences</Text>
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
        <Text style={styles.headerTitle}>Preferences</Text>
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

        {/* Dietary Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="leaf-outline" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Dietary Preferences</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Select your dietary restrictions and preferences
          </Text>
          <View style={styles.tagsContainer}>
            {DIETARY_OPTIONS.map((option) => (
              <PreferenceTag
                key={option}
                label={option}
                selected={selectedDietary.includes(option)}
                onToggle={() => toggleDietary(option)}
              />
            ))}
          </View>
        </View>

        {/* Category Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="grid-outline" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Shopping Categories</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Select your preferred shopping categories for personalized recommendations
          </Text>
          <View style={styles.tagsContainer}>
            {CATEGORY_OPTIONS.map((option) => (
              <PreferenceTag
                key={option}
                label={option}
                selected={selectedCategories.includes(option)}
                onToggle={() => toggleCategory(option)}
              />
            ))}
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
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  tagSelected: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  tagText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  tagTextSelected: {
    color: "#FFFFFF",
  },
  tagIcon: {
    marginLeft: -4,
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
