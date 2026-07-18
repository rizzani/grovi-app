import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import SearchBar from "../../components/SearchBar";
import { useSearch } from "../../contexts/SearchContext";
import {
  Category,
  getAllCategories,
  getCategoryImageUrls,
  getSearchSuggestions,
  searchProductsPaginated,
  SearchResult,
} from "../../lib/search-service";

export default function CategoriesScreen() {
  const router = useRouter();
  const { performSearch, recentSearches } = useSearch();
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryImageUrls, setCategoryImageUrls] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<SearchResult[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const categoryDocuments = await getAllCategories();
      const imageUrls = await getCategoryImageUrls(
        categoryDocuments.map((category) => category.$id)
      );
      setCategories(categoryDocuments);
      setCategoryImageUrls(imageUrls);
    } catch (loadError: unknown) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load categories";
      console.error("[Categories] Failed to load categories:", loadError);
      setCategories([]);
      setCategoryImageUrls({});
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

  const handleSearch = (query: string) => {
    performSearch(query);
  };

  const handleSuggestionSelect = (suggestion: any) => {
    performSearch(suggestion.text);
  };

  const loadCategoryProducts = useCallback(async (category: Category) => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const response = await searchProductsPaginated(
        category.name,
        { page: 1, pageSize: 10000 },
        undefined,
        "relevance",
        null,
        { categoryIds: [category.$id], inStock: false }
      );
      setProducts(response.results);
    } catch (loadError: unknown) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load products";
      console.error("[Categories] Failed to load category products:", loadError);
      setProducts([]);
      setProductsError(message);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const handleCategoryPress = (category: Category) => {
    setSelectedCategory(category);
    setProducts([]);
    loadCategoryProducts(category);
  };

  const handleBackToCategories = useCallback(() => {
    setSelectedCategory(null);
    setProducts([]);
    setProductsError(null);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackToCategories();
        return true;
      }
    );

    return () => subscription.remove();
  }, [handleBackToCategories, selectedCategory]);

  const renderCategory = ({ item }: { item: Category }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Browse ${item.name}`}
      onPress={() => handleCategoryPress(item)}
      style={({ pressed }) => [
        styles.categoryCard,
        pressed && styles.cardPressed,
      ]}
    >
      {categoryImageUrls[item.$id] ? (
        <Image
          source={{ uri: categoryImageUrls[item.$id] }}
          style={styles.categoryImage}
          contentFit="contain"
          transition={200}
          cachePolicy="memory-disk"
          accessibilityLabel={`${item.name} category`}
        />
      ) : (
        <View style={styles.categoryImagePlaceholder} />
      )}
      <Text style={styles.categoryName}>{item.name}</Text>
    </Pressable>
  );

  const renderProduct = ({ item }: { item: SearchResult }) => {
    const imageUrl = item.product.primary_image_url;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${item.product.title}`}
        onPress={() =>
          router.push({
            pathname: "/product/[id]",
            params: { id: item.product.$id },
          })
        }
        style={({ pressed }) => [
          styles.productCard,
          pressed && styles.cardPressed,
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            accessibilityLabel={item.product.title}
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="image-outline" size={30} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {item.product.title}
          </Text>
          {item.brand ? (
            <Text style={styles.productMeta} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}
          <Text style={styles.productPrice}>
            ${(item.priceJmdCents / 100).toFixed(2)} JMD
          </Text>
          {!item.inStock ? (
            <Text style={styles.outOfStockText}>Out of stock</Text>
          ) : null}
          <Text style={styles.productMeta} numberOfLines={1}>
            {item.storeLocation.display_name || item.storeLocation.name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </Pressable>
    );
  };

  const renderCategoryState = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.stateText}>Loading categories...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.errorTitle}>Couldn&apos;t load categories</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={loadCategories}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyTitle}>No categories available</Text>
        <Text style={styles.stateText}>Please check back again soon.</Text>
      </View>
    );
  };

  if (selectedCategory) {
    const renderProductState = () => {
      if (productsLoading) {
        return (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.stateText}>Loading products...</Text>
          </View>
        );
      }

      if (productsError) {
        return (
          <View style={styles.stateContainer}>
            <Text style={styles.errorTitle}>Couldn&apos;t load products</Text>
            <Text style={styles.stateText}>{productsError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => loadCategoryProducts(selectedCategory)}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyTitle}>No products available</Text>
          <Text style={styles.stateText}>
            There are currently no products in {selectedCategory.name}.
          </Text>
        </View>
      );
    };

    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <FlatList
          key="category-products-list"
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => `${item.product.$id}-${item.storeLocation.$id}`}
          contentContainerStyle={styles.productsContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.productsHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to categories"
                onPress={handleBackToCategories}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={22} color="#111827" />
                <Text style={styles.backButtonText}>Categories</Text>
              </Pressable>
              <Text style={styles.title}>{selectedCategory.name}</Text>
              <Text style={styles.subtitle}>
                {productsLoading
                  ? "Loading products"
                  : `${products.length} product${products.length === 1 ? "" : "s"}`}
              </Text>
            </View>
          }
          ListEmptyComponent={renderProductState}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <FlatList
        key="categories-grid"
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.$id}
        numColumns={2}
        contentContainerStyle={styles.scrollContent}
        columnWrapperStyle={categories.length > 0 ? styles.categoryRow : undefined}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.searchWrapper}>
              <SearchBar
                placeholder="Search Product"
                onSearch={handleSearch}
                onSuggestionSelect={handleSuggestionSelect}
                suggestions={searchSuggestions}
                showSuggestions={true}
                onChangeText={setSearchQuery}
                recentSearches={recentSearches}
                onRecentSearchPress={(query) => performSearch(query)}
              />
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>Categories</Text>
              <Text style={styles.subtitle}>Browse all categories</Text>
            </View>
          </>
        }
        ListEmptyComponent={renderCategoryState}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  searchWrapper: {
    marginBottom: 24,
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  categoryRow: {
    gap: 12,
    marginBottom: 12,
  },
  categoryCard: {
    flex: 1,
    minHeight: 112,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  cardPressed: {
    opacity: 0.7,
  },
  categoryImage: {
    width: 56,
    height: 56,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  categoryImagePlaceholder: {
    width: 56,
    height: 56,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  stateContainer: {
    flex: 1,
    minHeight: 240,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#6B7280",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#DC2626",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#10B981",
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  productsContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  productsHeader: {
    paddingBottom: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  productCard: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  productImage: {
    width: 88,
    height: 88,
    marginRight: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  productImagePlaceholder: {
    width: 88,
    height: 88,
    marginRight: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  productInfo: {
    flex: 1,
    paddingRight: 8,
  },
  productTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    color: "#111827",
  },
  productPrice: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  productMeta: {
    marginTop: 3,
    fontSize: 13,
    color: "#6B7280",
  },
  outOfStockText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
});
