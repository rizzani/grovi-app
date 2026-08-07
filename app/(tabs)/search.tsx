import { useState, useEffect, useMemo, useRef } from "react";
import { Text, View, StyleSheet, ScrollView, FlatList, ActivityIndicator, TouchableOpacity, Animated, Alert } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import SearchBar from "../../components/SearchBar";
import ProductFilters from "../../components/ProductFilters";
import SortPicker from "../../components/SortPicker";
import { useSearch } from "../../contexts/SearchContext";
import { useUser } from "../../contexts/UserContext";
import { useCart } from "../../contexts/CartContext";
import { AnalyticsEvent, trackEvent } from "../../lib/analytics";
import { getSearchSuggestions, searchProductsPaginated, ProductFilters as ProductFiltersType, SearchResult } from "../../lib/search-service";
import { SortMode } from "../../lib/search/ranking";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { 
    performSearch, 
    recentSearches, 
    clearRecentSearches,
    filters,
    setFilters,
    sortMode,
    setSortMode,
    clearFiltersAndSort 
  } = useSearch();
  const { userId } = useUser();
  const [searchQuery, setSearchQuery] = useState(params.q || "");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 50; // Results per page

  // Update query when params change
  useEffect(() => {
    if (params.q) {
      setSearchQuery(params.q);
      handleSearch(params.q, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  // Load search suggestions as user types
  useEffect(() => {
    const loadSuggestions = async () => {
      if (searchQuery.trim().length > 0) {
        const suggestions = await getSearchSuggestions(searchQuery);
        setSearchSuggestions(suggestions);
      } else {
        setSearchSuggestions([]);
      }
    };

    const timeoutId = setTimeout(loadSuggestions, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = async (query: string, currentFilters?: ProductFiltersType, currentSortMode?: SortMode) => {
    if (!query.trim()) {
      setAllSearchResults([]);
      setCurrentPage(1);
      setTotalResults(0);
      setHasMore(false);
      // Note: Filters and sort mode are NOT reset when search query is cleared
      // They persist during the session and are only reset when explicitly cleared
      return;
    }

    setIsSearching(true);
    try {
      const filtersToUse = currentFilters !== undefined ? currentFilters : filters;
      const sortModeToUse = currentSortMode !== undefined ? currentSortMode : sortMode;
      
      // Use paginated search with page 1
      const paginatedResults = await searchProductsPaginated(
        query,
        { page: 1, pageSize },
        undefined,
        sortModeToUse,
        userId || null,
        filtersToUse
      );
      
      setAllSearchResults(paginatedResults.results);
      setCurrentPage(1);
      setTotalResults(paginatedResults.totalResults);
      setHasMore(paginatedResults.hasMore);
      void trackEvent(AnalyticsEvent.ProductSearched, {
        searchTerm: query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200),
        resultCount: paginatedResults.totalResults,
      }, userId);
    } catch (error) {
      console.error("Search error:", error);
      setAllSearchResults([]);
      setCurrentPage(1);
      setTotalResults(0);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFiltersChange = (newFilters: ProductFiltersType) => {
    setFilters(newFilters);
    // Re-run search with new filters if we have a query
    if (searchQuery.trim()) {
      handleSearch(searchQuery, newFilters, sortMode);
    }
  };

  const handleSortChange = (newSortMode: SortMode) => {
    setSortMode(newSortMode);
    // Re-run search with new sort mode if we have a query
    if (searchQuery.trim()) {
      handleSearch(searchQuery, filters, newSortMode);
    }
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

  const handleSuggestionSelect = (suggestion: any) => {
    performSearch(suggestion.text);
  };

  const loadMoreResults = async () => {
    // Prevent loading if already loading, no more results, or no search query
    if (isLoadingMore || !hasMore || !searchQuery.trim()) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      
      const paginatedResults = await searchProductsPaginated(
        searchQuery,
        { page: nextPage, pageSize },
        undefined,
        sortMode,
        userId || null,
        filters
      );
      
      // Append new results to existing results
      setAllSearchResults([...allSearchResults, ...paginatedResults.results]);
      setCurrentPage(nextPage);
      setHasMore(paginatedResults.hasMore);
    } catch (error) {
      console.error("Error loading more results:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Search Bar - Fixed at top */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBarRow}>
          <View style={styles.searchBarContainer}>
            <SearchBar
              placeholder="Search Product"
              onSearch={handleSearch}
              onSuggestionSelect={handleSuggestionSelect}
              suggestions={searchSuggestions}
              showSuggestions={true}
              onChangeText={setSearchQuery}
              autoFocus={false}
              recentSearches={recentSearches}
              onRecentSearchPress={(query) => performSearch(query)}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, hasActiveFilters() && styles.filterButtonActive]}
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="filter"
              size={20}
              color={hasActiveFilters() ? "#FFFFFF" : "#111827"}
            />
            {hasActiveFilters() && (
              <View style={styles.filterBadge}>
                <View style={styles.filterBadgeDot} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Modal */}
      <ProductFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        userId={userId}
        visible={showFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* Content - FlatList for results, ScrollView for empty states */}
      {searchQuery && allSearchResults.length > 0 && !isSearching ? (
        <FlatList
          data={allSearchResults}
          renderItem={({ item }) => <ProductCard result={item} />}
          keyExtractor={(item, index) => `${item.sku}-${index}`}
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View>
              {/* Sort and Filter Bar */}
              <View style={styles.sortFilterBar}>
                <SortPicker currentSort={sortMode} onSortChange={handleSortChange} />
                {hasActiveFilters() && (
                  <TouchableOpacity
                    style={styles.activeFiltersIndicator}
                    onPress={() => setShowFilters(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="funnel" size={14} color="#10B981" />
                    <Text style={styles.activeFiltersText}>
                      {(filters.brands?.length || 0) +
                        (filters.categoryIds?.length || 0) +
                        (filters.deliveryParish ? 1 : 0) +
                        (filters.inStock === false ? 1 : 0) +
                        (filters.minPrice || filters.maxPrice ? 1 : 0)}{" "}
                      active
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* Results Header */}
              <Text style={styles.resultsHeader}>
                {totalResults > 0 ? `${totalResults} result${totalResults !== 1 ? "s" : ""} found` : `${allSearchResults.length} result${allSearchResults.length !== 1 ? "s" : ""} found`}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingMoreText}>Loading more results...</Text>
              </View>
            ) : !hasMore && allSearchResults.length > 0 ? (
              <View style={styles.endOfResultsContainer}>
                <View style={styles.endOfResultsDivider} />
                <Text style={styles.endOfResultsText}>
                  {totalResults > 0 
                    ? `All ${totalResults} results loaded`
                    : "No more results"}
                </Text>
                <View style={styles.endOfResultsDivider} />
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Loading State */}
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchQuery && allSearchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons 
                  name={hasActiveFilters() ? "funnel-outline" : "search-outline"} 
                  size={64} 
                  color="#D1D5DB" 
                />
              </View>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                {hasActiveFilters() 
                  ? "No products match your current filters. Try adjusting your filters or search query."
                  : "We couldn't find any products matching your search."}
              </Text>
              {hasActiveFilters() && (
                <View style={styles.emptyActions}>
                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={() => {
                      setFilters({});
                      handleSearch(searchQuery, {}, sortMode);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adjustFiltersButton}
                    onPress={() => setShowFilters(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="options" size={18} color="#10B981" />
                    <Text style={styles.adjustFiltersButtonText}>Adjust Filters</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : !searchQuery.trim() && allSearchResults.length === 0 && recentSearches.length > 0 ? (
            <View style={styles.recentSearchesContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity
                  onPress={clearRecentSearches}
                  activeOpacity={0.7}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((query, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentSearchItem}
                  onPress={() => performSearch(query)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={18} color="#6B7280" style={styles.recentSearchIcon} />
                  <Text style={styles.recentSearchText}>{query}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#9CA3AF" style={styles.recentSearchArrow} />
                </TouchableOpacity>
              ))}
            </View>
          ) : !searchQuery.trim() && allSearchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Search</Text>
              <Text style={styles.emptySubtitle}>
                Find products and stores
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchBarContainer: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  filterButtonActive: {
    backgroundColor: "#10B981",
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyActions: {
    width: "100%",
    gap: 12,
  },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearFiltersButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  adjustFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  adjustFiltersButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
  },
  recentSearchesContainer: {
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 14,
    color: "#10B981",
    fontWeight: "500",
  },
  recentSearchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 8,
  },
  recentSearchIcon: {
    marginRight: 12,
  },
  recentSearchText: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  recentSearchArrow: {
    marginLeft: 8,
  },
  resultsContainer: {
    paddingTop: 8,
  },
  resultsHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 16,
  },
  productsGrid: {
    gap: 12,
  },
  resultItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultImageContainer: {
    marginRight: 12,
  },
  resultImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  resultContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  resultBrand: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  resultCategory: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  resultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  resultPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  outOfStockLabel: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "500",
  },
  sortFilterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  activeFiltersIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  activeFiltersText: {
    fontSize: 13,
    color: "#10B981",
    fontWeight: "600",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productCardOutOfStock: {
    opacity: 0.6,
  },
  productCardContent: {
    flexDirection: "row",
  },
  productImageContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  productInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  productHeader: {
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 13,
    color: "#6B7280",
  },
  productDetails: {
    marginBottom: 4,
  },
  storeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  productStore: {
    fontSize: 12,
    color: "#9CA3AF",
    flex: 1,
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  productFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  categoryBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 120,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  addToCartButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#10B981",
    borderRadius: 6,
    minWidth: 60,
    justifyContent: "center",
  },
  addToCartButtonDisabled: {
    opacity: 0.6,
  },
  addToCartButtonInCart: {
    backgroundColor: "#059669",
  },
  addToCartButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loadingMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 12,
  },
  loadingMoreText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  endOfResultsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 12,
  },
  endOfResultsDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
    maxWidth: 60,
  },
  endOfResultsText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});

// Product Card Component
interface ProductCardProps {
  result: SearchResult;
}

/**
 * Transform Appwrite image URL with optimized parameters for list display
 * Appwrite Storage API: https://appwrite.io/docs/products/storage/images
 * NOTE: Transformations only work with /preview endpoint, not /view
 */
function getTransformedImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;

  // Check if it's an Appwrite storage URL
  // Appwrite URLs typically look like: /v1/storage/buckets/[bucketId]/files/[fileId]/view
  const isAppwriteStorageUrl = imageUrl.includes("/storage/buckets/") && imageUrl.includes("/files/");
  
  if (!isAppwriteStorageUrl) {
    // Not an Appwrite URL, return as-is (might be external URL or placeholder)
    return imageUrl;
  }

  // TEMPORARY FIX: Using /view endpoint without transformations to avoid 402 billing errors
  // Image transformations (/preview endpoint) are hitting Appwrite billing limits
  // TODO: Upgrade Appwrite plan to enable image transformations again
  
  // Ensure we're using /view endpoint
  let viewUrl = imageUrl;
  
  if (viewUrl.includes("/preview")) {
    // Replace /preview with /view to avoid transformation limits
    viewUrl = viewUrl.replace("/preview", "/view");
  } else if (!viewUrl.includes("/view")) {
    // Add /view endpoint if not present
    const queryIndex = viewUrl.indexOf("?");
    const hashIndex = viewUrl.indexOf("#");
    const insertIndex = queryIndex !== -1 ? queryIndex : (hashIndex !== -1 ? hashIndex : viewUrl.length);
    viewUrl = viewUrl.substring(0, insertIndex) + "/view" + viewUrl.substring(insertIndex);
  }

  // Get project ID for Appwrite URLs (required)
  const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID || 
    process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "";

  // Only add project parameter (no transformations to avoid 402 errors)
  if (projectId) {
    const separator = viewUrl.includes("?") ? "&" : "?";
    return `${viewUrl}${separator}project=${projectId}`;
  }

  return viewUrl;
}

function ProductCard({ result }: ProductCardProps) {
  const router = useRouter();
  const { addToCart, isProductInCart, getItemQuantity } = useCart();
  const [imageLoading, setImageLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Pulse animation for loading state
  useEffect(() => {
    if (imageLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [imageLoading, pulseAnim]);
  
  const handlePress = () => {
    router.push(`/product/${result.product.$id}`);
  };

  const handleAddToCart = async (e: any) => {
    e.stopPropagation();
    
    if (!result.inStock) {
      return;
    }

    try {
      setAddingToCart(true);
      await addToCart(
        result.product.$id,
        result.storeLocation.$id,
        result.sku,
        result.product.title,
        result.priceJmdCents,
        result.storeLocation.display_name || result.storeLocation.name,
        result.brand,
        result.product.primary_image_url,
        1,
        result.storeLocation.logo_url
      );
      
      Alert.alert(
        "Added to Cart",
        `${result.product.title} has been added to your cart.`,
        [{ text: "OK" }]
      );
    } catch (err) {
      console.error("Error adding to cart:", err);
      Alert.alert(
        "Error",
        "Failed to add item to cart. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setAddingToCart(false);
    }
  };

  const priceFormatted = `$${(result.priceJmdCents / 100).toFixed(2)}`;
  const originalUrl = result.product.primary_image_url;
  const imageUri = getTransformedImageUrl(originalUrl);
  const inCart = isProductInCart(result.product.$id, result.storeLocation.$id);
  const cartQuantity = getItemQuantity(result.product.$id, result.storeLocation.$id);

  return (
    <View style={[styles.productCard, !result.inStock && styles.productCardOutOfStock]}>
      <TouchableOpacity
        style={styles.productCardContent}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={!result.inStock}
      >
      {/* Product Image - Left Side */}
      <View style={styles.productImageContainer}>
        {imageUri ? (
          <>
            {imageLoading && (
              <Animated.View 
                style={[
                  styles.imagePlaceholderLoading,
                  { opacity: pulseAnim }
                ]}
              >
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              </Animated.View>
            )}
            <Image
              source={{ uri: imageUri }}
              style={styles.productImage}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
              onError={(error) => {
                setImageLoading(false);
                if (__DEV__) {
                  console.error("Image failed to load:", imageUri, error);
                }
              }}
            />
          </>
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
          </View>
        )}
      </View>

      {/* Product Info - Right Side */}
      <View style={styles.productInfo}>
        {/* Header Section */}
        <View style={styles.productHeader}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {result.product.title}
          </Text>
          {result.brand && (
            <Text style={styles.productBrand} numberOfLines={1}>
              {result.brand}
            </Text>
          )}
        </View>

        {/* Details Section */}
        <View style={styles.productDetails}>
          {/* Store Info */}
          <View style={styles.storeInfo}>
            <Ionicons name="storefront" size={12} color="#9CA3AF" />
            <Text style={styles.productStore} numberOfLines={1}>
              {result.storeLocation.display_name || result.storeLocation.name}
            </Text>
          </View>
        </View>

        {/* Footer Section - Price, Category, and Add to Cart */}
        <View style={styles.productFooter}>
          <View style={styles.productFooterLeft}>
            <Text style={styles.productPrice}>{priceFormatted}</Text>
            {result.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText} numberOfLines={1}>
                  {result.category.name}
                </Text>
              </View>
            )}
          </View>
          {result.inStock && (
            <TouchableOpacity
              style={[
                styles.addToCartButton,
                addingToCart && styles.addToCartButtonDisabled,
                inCart && styles.addToCartButtonInCart,
              ]}
              onPress={handleAddToCart}
              activeOpacity={0.7}
              disabled={addingToCart}
            >
              {addingToCart ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons 
                    name={inCart ? "checkmark-circle" : "cart"} 
                    size={14} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.addToCartButtonText}>
                    {inCart ? `${cartQuantity}` : "Add"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
      </TouchableOpacity>
    </View>
  );
}
