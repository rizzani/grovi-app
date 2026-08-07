import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ProductFilters as ProductFiltersType, getAllCategories, getAllBrands, Category } from "../lib/search-service";
import { getAddresses, Address } from "../lib/profile-service";

interface ProductFiltersProps {
  filters: ProductFiltersType;
  onFiltersChange: (filters: ProductFiltersType) => void;
  userId?: string | null;
  visible: boolean;
  onClose: () => void;
}

export default function ProductFilters({
  filters,
  onFiltersChange,
  userId,
  visible,
  onClose,
}: ProductFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchCategoryQuery, setSearchCategoryQuery] = useState("");
  const [searchBrandQuery, setSearchBrandQuery] = useState("");

  const loadFilterOptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [categoriesData, brandsData] = await Promise.all([
        getAllCategories(),
        getAllBrands(),
      ]);
      setCategories(categoriesData);
      setBrands(brandsData);

      // Load user addresses if userId is provided
      if (userId) {
        try {
          const userAddresses = await getAddresses(userId);
          setAddresses(userAddresses);
        } catch (error) {
          console.error("Error loading addresses:", error);
        }
      }
    } catch (error) {
      console.error("Error loading filter options:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load filter options when modal opens
  useEffect(() => {
    if (visible) {
      loadFilterOptions();
    }
  }, [visible, loadFilterOptions]);

  const toggleBrand = (brand: string) => {
    const currentBrands = filters.brands || [];
    const newBrands = currentBrands.includes(brand)
      ? currentBrands.filter((b) => b !== brand)
      : [...currentBrands, brand];
    onFiltersChange({ ...filters, brands: newBrands.length > 0 ? newBrands : undefined });
  };

  const toggleCategory = (categoryId: string) => {
    const currentCategoryIds = filters.categoryIds || [];
    const newCategoryIds = currentCategoryIds.includes(categoryId)
      ? currentCategoryIds.filter((id) => id !== categoryId)
      : [...currentCategoryIds, categoryId];
    onFiltersChange({ ...filters, categoryIds: newCategoryIds.length > 0 ? newCategoryIds : undefined });
  };

  const setPriceRange = (min?: number, max?: number) => {
    onFiltersChange({
      ...filters,
      minPrice: min,
      maxPrice: max,
    });
  };

  const toggleAvailability = () => {
    onFiltersChange({
      ...filters,
      inStock: filters.inStock === false ? undefined : false,
    });
  };

  const setDeliveryAddress = (address: Address | null) => {
    onFiltersChange({
      ...filters,
      deliveryParish: address?.parish,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
    // Note: Sort mode is managed separately and can be cleared from SearchContext
  };

  const removeBrandFilter = (brand: string) => {
    const newBrands = (filters.brands || []).filter((b) => b !== brand);
    onFiltersChange({ ...filters, brands: newBrands.length > 0 ? newBrands : undefined });
  };

  const removeCategoryFilter = (categoryId: string) => {
    const newCategoryIds = (filters.categoryIds || []).filter((id) => id !== categoryId);
    onFiltersChange({ ...filters, categoryIds: newCategoryIds.length > 0 ? newCategoryIds : undefined });
  };

  const hasActiveFilters = () => {
    return !!(
      (filters.brands && filters.brands.length > 0) ||
      (filters.categoryIds && filters.categoryIds.length > 0) ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.inStock === false ||
      filters.deliveryParish
    );
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchCategoryQuery.toLowerCase())
  );

  const filteredBrands = brands.filter((brand) =>
    brand.toLowerCase().includes(searchBrandQuery.toLowerCase())
  );

  const defaultAddress = addresses.find((addr) => addr.default) || addresses[0];
  const activeBrandsCount = filters.brands?.length || 0;
  const activeCategoriesCount = filters.categoryIds?.length || 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Filters</Text>
            {hasActiveFilters() && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  {activeBrandsCount + activeCategoriesCount + (filters.deliveryParish ? 1 : 0) + (filters.inStock === false ? 1 : 0) + (filters.minPrice || filters.maxPrice ? 1 : 0)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {hasActiveFilters() && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearAllButton}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading filters...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Active Filters Summary */}
            {hasActiveFilters() && (
              <View style={styles.activeFiltersContainer}>
                <Text style={styles.activeFiltersTitle}>Active Filters</Text>
                <View style={styles.activeFiltersChips}>
                  {filters.brands?.map((brand) => (
                    <TouchableOpacity
                      key={brand}
                      style={styles.filterChip}
                      onPress={() => removeBrandFilter(brand)}
                    >
                      <Text style={styles.filterChipText}>{brand}</Text>
                      <Ionicons name="close-circle" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  ))}
                  {filters.categoryIds?.map((categoryId) => {
                    const category = categories.find((c) => c.$id === categoryId);
                    return category ? (
                      <TouchableOpacity
                        key={categoryId}
                        style={styles.filterChip}
                        onPress={() => removeCategoryFilter(categoryId)}
                      >
                        <Text style={styles.filterChipText}>{category.name}</Text>
                        <Ionicons name="close-circle" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    ) : null;
                  })}
                  {filters.deliveryParish && (
                    <View style={styles.filterChip}>
                      <Text style={styles.filterChipText}>Delivery: {filters.deliveryParish}</Text>
                      <TouchableOpacity
                        onPress={() => setDeliveryAddress(null)}
                        style={{ marginLeft: 4 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {(filters.minPrice || filters.maxPrice) && (
                    <View style={styles.filterChip}>
                      <Text style={styles.filterChipText}>
                        ${filters.minPrice ? (filters.minPrice / 100).toFixed(0) : "0"} - ${filters.maxPrice ? (filters.maxPrice / 100).toFixed(0) : "∞"}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPriceRange(undefined, undefined)}
                        style={{ marginLeft: 4 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {filters.inStock === false && (
                    <View style={styles.filterChip}>
                      <Text style={styles.filterChipText}>Include Out of Stock</Text>
                      <TouchableOpacity
                        onPress={toggleAvailability}
                        style={{ marginLeft: 4 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Delivery Address Filter */}
            {addresses.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="location" size={20} color="#10B981" />
                  <Text style={styles.sectionTitle}>Delivery Location</Text>
                </View>
                <Text style={styles.sectionDescription}>
                  Show products available for delivery to this address
                </Text>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    filters.deliveryParish === defaultAddress?.parish && styles.optionCardSelected,
                  ]}
                  onPress={() => {
                    if (filters.deliveryParish === defaultAddress?.parish) {
                      setDeliveryAddress(null);
                    } else {
                      setDeliveryAddress(defaultAddress || null);
                    }
                  }}
                >
                  <View style={styles.optionCardContent}>
                    <View style={styles.optionCardLeft}>
                      <Ionicons
                        name={filters.deliveryParish === defaultAddress?.parish ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color={filters.deliveryParish === defaultAddress?.parish ? "#10B981" : "#D1D5DB"}
                      />
                      <View style={styles.addressContent}>
                        <Text style={styles.addressLabel}>{defaultAddress?.label || "Default Address"}</Text>
                        <Text style={styles.addressDetails}>
                          {defaultAddress?.parish}, {defaultAddress?.community}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Price Range Filter */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pricetag" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Price Range</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Set your budget range in JMD
              </Text>
              <View style={styles.priceContainer}>
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.priceInputLabel}>Min</Text>
                  <View style={styles.priceInputBox}>
                    <Text style={styles.currencySymbol}>JMD $</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={filters.minPrice !== undefined ? (filters.minPrice / 100).toString() : ""}
                      onChangeText={(text) => {
                        const value = parseFloat(text);
                        setPriceRange(isNaN(value) ? undefined : Math.round(value * 100), filters.maxPrice);
                      }}
                    />
                  </View>
                </View>
                <Text style={styles.priceTo}>to</Text>
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.priceInputLabel}>Max</Text>
                  <View style={styles.priceInputBox}>
                    <Text style={styles.currencySymbol}>JMD $</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="No limit"
                      keyboardType="numeric"
                      value={filters.maxPrice !== undefined ? (filters.maxPrice / 100).toString() : ""}
                      onChangeText={(text) => {
                        const value = parseFloat(text);
                        setPriceRange(filters.minPrice, isNaN(value) ? undefined : Math.round(value * 100));
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Availability Filter */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkbox" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Availability</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  filters.inStock === false && styles.optionCardSelected,
                ]}
                onPress={toggleAvailability}
              >
                <View style={styles.optionCardContent}>
                  <Ionicons
                    name={filters.inStock === false ? "checkbox" : "square-outline"}
                    size={24}
                    color={filters.inStock === false ? "#10B981" : "#D1D5DB"}
                  />
                  <Text style={[
                    styles.checkboxLabel,
                    filters.inStock === false && styles.checkboxLabelSelected
                  ]}>
                    Include out of stock items
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Category Filter */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="grid" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Categories</Text>
                {activeCategoriesCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{activeCategoriesCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search categories..."
                  placeholderTextColor="#9CA3AF"
                  value={searchCategoryQuery}
                  onChangeText={setSearchCategoryQuery}
                />
                {searchCategoryQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchCategoryQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.optionsList}>
                {filteredCategories.slice(0, 10).map((category) => {
                  const isSelected = filters.categoryIds?.includes(category.$id) || false;
                  return (
                    <TouchableOpacity
                      key={category.$id}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => toggleCategory(category.$id)}
                    >
                      <View style={styles.optionCardContent}>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={22}
                          color={isSelected ? "#10B981" : "#D1D5DB"}
                        />
                        <Text style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected
                        ]}>
                          {category.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Brand Filter */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pricetags" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Brands</Text>
                {activeBrandsCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{activeBrandsCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search brands..."
                  placeholderTextColor="#9CA3AF"
                  value={searchBrandQuery}
                  onChangeText={setSearchBrandQuery}
                />
                {searchBrandQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchBrandQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.optionsList}>
                {filteredBrands.slice(0, 10).map((brand) => {
                  const isSelected = filters.brands?.includes(brand) || false;
                  return (
                    <TouchableOpacity
                      key={brand}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => toggleBrand(brand)}
                    >
                      <View style={styles.optionCardContent}>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={22}
                          color={isSelected ? "#10B981" : "#D1D5DB"}
                        />
                        <Text style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected
                        ]}>
                          {brand}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  activeBadge: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  clearAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  activeFiltersContainer: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
  },
  activeFiltersChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    color: "#10B981",
    fontWeight: "500",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  countBadge: {
    backgroundColor: "#10B981",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    padding: 0,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
  },
  optionCardSelected: {
    backgroundColor: "#F0FDF4",
    borderColor: "#10B981",
  },
  optionCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    color: "#111827",
    flex: 1,
  },
  optionLabelSelected: {
    fontWeight: "600",
    color: "#10B981",
  },
  checkboxLabel: {
    fontSize: 15,
    color: "#111827",
    flex: 1,
  },
  checkboxLabelSelected: {
    fontWeight: "600",
    color: "#10B981",
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  addressDetails: {
    fontSize: 13,
    color: "#6B7280",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "500",
  },
  priceInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 15,
    color: "#6B7280",
    marginRight: 4,
    fontWeight: "500",
  },
  priceInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    padding: 0,
  },
  priceTo: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 8,
    fontWeight: "500",
  },
  bottomSpacer: {
    height: 40,
  },
});
