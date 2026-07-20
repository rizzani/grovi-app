import { Query } from "appwrite";
import { databaseId, databases } from "./appwrite-client";
import { Order, OrderItem, StoreOrder } from "./order-types";

export interface OrderDetails { order: Order; storeOrders: StoreOrder[]; items: OrderItem[] }

export async function getOrderDetails(orderId: string, userId: string): Promise<OrderDetails> {
  const [order, stores, items] = await Promise.all([
    databases.getDocument(databaseId, "orders", orderId),
    databases.listDocuments(databaseId, "store_orders", [Query.equal("orderId", orderId), Query.equal("userId", userId), Query.limit(100)]),
    databases.listDocuments(databaseId, "order_items", [Query.equal("orderId", orderId), Query.equal("userId", userId), Query.limit(500)]),
  ]);
  if (order.userId !== userId) throw new Error("Order not found.");
  return { order: order as unknown as Order, storeOrders: stores.documents as unknown as StoreOrder[], items: items.documents as unknown as OrderItem[] };
}
