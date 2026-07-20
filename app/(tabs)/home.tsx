import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import SearchBar, { type SearchSuggestion } from "../../components/SearchBar";
import HomeProductSection, { SectionSkeleton } from "../../components/HomeProductSection";
import { useUser } from "../../contexts/UserContext";
import { useCart } from "../../contexts/CartContext";
import { useSearch } from "../../contexts/SearchContext";
import { getSearchSuggestions } from "../../lib/search-service";
import { useHomeFeed } from "../../lib/use-home-feed";

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const { cart } = useCart();
  const { performSearch, recentSearches } = useSearch();
  const { feed, deliveryLabel, isLoading, error, refresh } = useHomeFeed(userId);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!query.trim()) return setSuggestions([]);
      void getSearchSuggestions(query).then(setSuggestions).catch((suggestionError) =>
        console.warn("[Home] Suggestions unavailable:", suggestionError));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const seeAll = () => router.push("/(tabs)/search");
  return <SafeAreaView style={styles.container} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading && Boolean(feed)} onRefresh={refresh} tintColor="#10B981" />}>
      <View style={styles.searchRow}><View style={styles.search}><SearchBar placeholder="Search products"
        onSearch={performSearch} onSuggestionSelect={(item) => performSearch(item.text)} suggestions={suggestions}
        showSuggestions onChangeText={setQuery} recentSearches={recentSearches} onRecentSearchPress={performSearch} /></View>
        <Pressable style={styles.cart} onPress={() => router.push("/cart")}><Ionicons name="cart-outline" size={25} color="#111827" />
          {cart.totalItems > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(cart.totalItems, 99)}</Text></View>}</Pressable></View>
      <Pressable style={styles.location} onPress={() => router.push("/addresses")}>
        <Ionicons name="location" size={18} color="#10B981" /><View><Text style={styles.deliver}>Deliver to</Text><Text style={styles.address}>{deliveryLabel}</Text></View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" /></Pressable>
      <View style={styles.banner}><View style={styles.bannerCopy}><Text style={styles.bannerEyebrow}>FRESH FOR LESS</Text>
        <Text style={styles.bannerTitle}>Everyday groceries,{"\n"}<Text style={styles.green}>delivered simply.</Text></Text>
        <Text style={styles.bannerText}>Discover seasonal offers from Grovi partners.</Text></View>
        <Ionicons name="basket" size={68} color="#A7F3D0" /></View>

      {isLoading && !feed ? <>{["Shop by category", "Featured products", "Essentials"].map((title) => <SectionSkeleton key={title} title={title} />)}</> : null}
      {error && !feed ? <View style={styles.error}><Text style={styles.errorTitle}>Home feed is unavailable</Text><Text style={styles.errorText}>Pull to refresh or try again.</Text><Pressable onPress={refresh}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
      {feed ? <>
        {feed.categories.length >= 4 && <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Shop by category</Text><Pressable onPress={() => router.push("/(tabs)/categories")}><Text style={styles.seeAll}>See all</Text></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{feed.categories.map((category) =>
            <Pressable key={category.$id} style={styles.category} onPress={() => router.push("/(tabs)/categories")}><View style={styles.categoryIcon}><Ionicons name="grid-outline" size={25} color="#059669" /></View><Text style={styles.categoryName} numberOfLines={2}>{category.name}</Text></Pressable>)}</ScrollView></View>}
        <HomeProductSection title="Featured products" items={feed.featured} onSeeAll={seeAll} />
        <HomeProductSection title="Essentials" items={feed.essentials} onSeeAll={seeAll} />
        <HomeProductSection title="Deals" items={feed.deals} onSeeAll={seeAll} />
        <HomeProductSection title="New on Grovi" items={feed.newProducts} onSeeAll={seeAll} />
        <HomeProductSection title={feed.popularSectionTitle} items={feed.popular} onSeeAll={seeAll} />
        {feed.stores && <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Stores near you</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{feed.stores.map((store) =>
            <View key={store.$id} style={styles.store}><View style={styles.storeIcon}><Ionicons name="storefront" size={25} color="#059669" /></View><Text style={styles.categoryName}>{store.display_name || store.name}</Text></View>)}</ScrollView></View>}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" }, content: { padding: 16, paddingBottom: 36 }, searchRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, search: { flex: 1 },
  cart: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#F3F4F6" }, badge: { position: "absolute", right: 2, top: 1, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }, badgeText: { color: "white", fontSize: 10, fontWeight: "700" },
  location: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13 }, deliver: { fontSize: 11, color: "#6B7280" }, address: { fontSize: 14, color: "#111827", fontWeight: "600", maxWidth: 260 },
  banner: { minHeight: 154, backgroundColor: "#ECFDF5", borderRadius: 20, padding: 20, marginBottom: 28, flexDirection: "row", alignItems: "center", overflow: "hidden" }, bannerCopy: { flex: 1 }, bannerEyebrow: { color: "#059669", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, bannerTitle: { fontSize: 21, lineHeight: 28, fontWeight: "800", color: "#111827", marginTop: 7 }, green: { color: "#059669" }, bannerText: { fontSize: 12, lineHeight: 17, color: "#4B5563", marginTop: 7 },
  section: { marginBottom: 28 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }, sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111827" }, seeAll: { color: "#059669", fontWeight: "700" }, categoryRow: { gap: 14, paddingRight: 4 }, category: { width: 82, alignItems: "center" }, categoryIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }, categoryName: { fontSize: 12, lineHeight: 16, color: "#374151", fontWeight: "600", textAlign: "center", marginTop: 7 },
  store: { width: 96, alignItems: "center" }, storeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }, error: { padding: 24, alignItems: "center" }, errorTitle: { fontSize: 17, fontWeight: "700" }, errorText: { color: "#6B7280", marginTop: 6 }, retry: { color: "#059669", fontWeight: "700", marginTop: 12 },
});
