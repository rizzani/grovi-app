import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCart } from "../contexts/CartContext";
import type { SearchResult } from "../lib/search-service";
import { getSalePrice } from "../lib/product-ranking";

export function SectionSkeleton({ title }: { title: string }) {
  return <View style={styles.section} accessibilityLabel={`Loading ${title}`}>
    <View style={[styles.skeleton, { width: 150, height: 24, marginBottom: 14 }]} />
    <View style={styles.row}>{[0, 1, 2].map((key) =>
      <View key={key} style={styles.card}><View style={[styles.image, styles.skeleton]} />
        <View style={[styles.skeleton, { height: 14, marginTop: 9 }]} />
        <View style={[styles.skeleton, { height: 12, width: 70, marginTop: 7 }]} /></View>)}</View>
  </View>;
}

function ProductCard({ item }: { item: SearchResult }) {
  const router = useRouter();
  const { addToCart, isProductInCart } = useCart();
  const [adding, setAdding] = useState(false);
  const salePrice = getSalePrice(item);
  const price = salePrice && salePrice < item.priceJmdCents ? salePrice : item.priceJmdCents;
  const inCart = isProductInCart(item.product.$id, item.storeLocation.$id);

  const add = async () => {
    try {
      setAdding(true);
      await addToCart(item.product.$id, item.storeLocation.$id, item.sku,
        item.product.title, price, item.storeLocation.display_name || item.storeLocation.name,
        item.brand, item.product.primary_image_url, 1, item.storeLocation.logo_url);
    } catch (error) {
      console.error("[HomeFeed] Failed to add product to cart:", error);
      Alert.alert("Couldn’t add item", "Please try again.");
    } finally { setAdding(false); }
  };

  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    onPress={() => router.push(`/product/${item.product.$id}`)} accessibilityRole="button">
    {item.product.primary_image_url ? <Image source={{ uri: item.product.primary_image_url }}
      style={styles.image} contentFit="contain" cachePolicy="memory-disk" /> :
      <View style={[styles.image, styles.imageEmpty]}><Ionicons name="cube-outline" size={34} color="#9CA3AF" /></View>}
    <Text style={styles.name} numberOfLines={2}>{item.product.title}</Text>
    <View style={styles.priceRow}><View>
      <Text style={styles.price}>${(price / 100).toFixed(2)}</Text>
      {price !== item.priceJmdCents && <Text style={styles.oldPrice}>${(item.priceJmdCents / 100).toFixed(2)}</Text>}
    </View><Pressable onPress={(event) => { event.stopPropagation(); void add(); }} disabled={adding || inCart}
      style={[styles.addButton, (adding || inCart) && styles.addedButton]} accessibilityLabel={`Add ${item.product.title} to cart`}>
      <Ionicons name={inCart ? "checkmark" : "add"} size={19} color="#FFFFFF" />
    </Pressable></View>
  </Pressable>;
}

export default function HomeProductSection({ title, items, onSeeAll }: {
  title: string; items: SearchResult[]; onSeeAll?: () => void;
}) {
  if (!items.length) return null;
  return <View style={styles.section}><View style={styles.header}><Text style={styles.title}>{title}</Text>
    {onSeeAll && <Pressable onPress={onSeeAll}><Text style={styles.seeAll}>See all</Text></Pressable>}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => <ProductCard key={`${item.product.$id}:${item.storeLocation.$id}`} item={item} />)}
    </ScrollView></View>;
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" }, seeAll: { color: "#059669", fontSize: 14, fontWeight: "700" },
  row: { gap: 14, paddingRight: 4 }, card: { width: 148 }, pressed: { opacity: 0.72 },
  image: { width: 148, height: 132, borderRadius: 14, backgroundColor: "#F3F4F6" }, imageEmpty: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, lineHeight: 19, color: "#111827", fontWeight: "600", marginTop: 9, minHeight: 38 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 }, price: { color: "#059669", fontWeight: "700" },
  oldPrice: { color: "#9CA3AF", fontSize: 11, textDecorationLine: "line-through" }, addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  addedButton: { backgroundColor: "#6B7280" }, skeleton: { backgroundColor: "#E5E7EB", borderRadius: 8 },
});
