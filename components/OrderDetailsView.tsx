import { ScrollView, StyleSheet, Text, View } from "react-native";
import { OrderDetails } from "../lib/order-service";
import { StoreOrderStatus } from "../lib/order-types";
import { formatOrderDate, formatOrderLabel, formatOrderMoney } from "../lib/order-formatters";

export default function OrderDetailsView({ details, confirmation = false, footer }: { details: OrderDetails; confirmation?: boolean; footer?: React.ReactNode }) {
  const { order, storeOrders, items } = details;
  const statuses = new Set(storeOrders.map((store) => store.status));
  const isPartial = statuses.size > 1 || (statuses.has(StoreOrderStatus.Cancelled) && statuses.size > 1);
  const problem = order.status === "cancelled" || order.status === "failed" || order.paymentStatus === "failed";
  const address = [order.deliveryHouseDetails, order.deliveryStreet, order.deliveryCommunity, order.deliveryParish].filter(Boolean).join(", ");
  const timestamps = [
    ["Placed", order.placedAt], ["Confirmed", order.confirmedAt], ["Delivered", order.deliveredAt], ["Cancelled", order.cancelledAt],
  ] as const;

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    {confirmation && <Text style={styles.check}>✓</Text>}
    <Text style={styles.title}>{confirmation ? "Order placed" : "Order details"}</Text>
    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
    {(problem || isPartial) && <View style={[styles.notice, problem && styles.noticeProblem]}><Text style={styles.noticeText}>{problem ? order.statusReason || `This order is ${formatOrderLabel(order.status).toLowerCase()}.` : "This order is partially fulfilled. Store statuses are shown below."}</Text></View>}

    <Section title="Order"><Row label="Status" value={formatOrderLabel(order.status)} /><Row label="Items" value={`${order.itemCount}`} /><Row label="Stores" value={`${order.storeCount}`} /></Section>
    <Section title="Delivery address"><Text style={styles.strong}>{order.addressLabel}</Text><Text style={styles.muted}>{address}</Text>{order.deliveryLandmarkDirections ? <Text style={styles.muted}>{order.deliveryLandmarkDirections}</Text> : null}<Text style={styles.muted}>{order.deliveryContactPhone}</Text></Section>
    <Section title="Payment"><Row label="Method" value={formatOrderLabel(order.paymentMethod)} /><Row label="Status" value={formatOrderLabel(order.paymentStatus)} /><Row label="Currency" value={order.currency} /></Section>
    <Section title="Totals"><Row label="Subtotal" value={formatOrderMoney(order.subtotalJmdCents, order.currency)} /><Row label="Delivery" value={formatOrderMoney(order.deliveryFeeJmdCents, order.currency)} />{order.discountJmdCents > 0 && <Row label="Discount" value={`-${formatOrderMoney(order.discountJmdCents, order.currency)}`} />}<View style={styles.divider} /><Row label="Total" value={formatOrderMoney(order.totalJmdCents, order.currency)} strong /></Section>

    <Text style={styles.heading}>Stores and items</Text>
    {storeOrders.map((store) => <View style={styles.card} key={store.$id}>
      <View style={styles.storeHeader}><View style={styles.flex}><Text style={styles.strong}>{store.storeName}</Text><Text style={styles.muted}>{store.itemCount} item{store.itemCount === 1 ? "" : "s"}</Text></View><Text style={styles.status}>{formatOrderLabel(store.status)}</Text></View>
      {store.statusReason ? <Text style={styles.problemText}>{store.statusReason}</Text> : null}
      {items.filter((item) => item.storeOrderId === store.$id).map((item) => <View style={styles.item} key={item.$id}><View style={styles.flex}><Text style={styles.itemTitle}>{item.title}</Text>{item.unitSize ? <Text style={styles.muted}>{item.unitSize}</Text> : null}<Text style={styles.muted}>Qty {item.quantity} × {formatOrderMoney(item.unitPriceJmdCents, order.currency)}</Text></View><Text style={styles.strong}>{formatOrderMoney(item.lineTotalJmdCents, order.currency)}</Text></View>)}
      <Row label="Store total" value={formatOrderMoney(store.totalJmdCents, order.currency)} strong />
      {store.acceptedAt && <Row label="Accepted" value={formatOrderDate(store.acceptedAt, true)} />}{store.dispatchedAt && <Row label="Dispatched" value={formatOrderDate(store.dispatchedAt, true)} />}{store.deliveredAt && <Row label="Delivered" value={formatOrderDate(store.deliveredAt, true)} />}{store.cancelledAt && <Row label="Cancelled" value={formatOrderDate(store.cancelledAt, true)} />}
    </View>)}
    <Section title="Timeline">{timestamps.filter(([, value]) => value).map(([label, value]) => <Row key={label} label={label} value={formatOrderDate(value, true)} />)}</Section>
    {footer}
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <><Text style={styles.heading}>{title}</Text><View style={styles.card}>{children}</View></>; }
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.row}><Text style={styles.muted}>{label}</Text><Text style={[styles.value, strong && styles.total]}>{value}</Text></View>; }

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 44 }, check: { alignSelf: "center", fontSize: 46, color: "#10B981", fontWeight: "800" }, title: { textAlign: "center", fontSize: 26, fontWeight: "700", color: "#111827" }, orderNumber: { textAlign: "center", color: "#6B7280", marginTop: 6, marginBottom: 18 }, notice: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B", borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 12 }, noticeProblem: { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }, noticeText: { color: "#374151", lineHeight: 20 }, heading: { fontSize: 17, fontWeight: "700", marginTop: 8, marginBottom: 10, color: "#111827" }, card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, marginBottom: 16, gap: 10 }, row: { flexDirection: "row", justifyContent: "space-between", gap: 16 }, value: { color: "#111827", fontWeight: "500", textAlign: "right", flexShrink: 1 }, total: { fontWeight: "800", fontSize: 16 }, strong: { fontWeight: "700", color: "#111827" }, muted: { color: "#6B7280", lineHeight: 20 }, divider: { height: 1, backgroundColor: "#E5E7EB" }, storeHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, flex: { flex: 1 }, status: { color: "#047857", backgroundColor: "#ECFDF5", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontSize: 12, fontWeight: "700" }, item: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10, gap: 12 }, itemTitle: { color: "#111827", fontWeight: "600" }, problemText: { color: "#B91C1C" } });
