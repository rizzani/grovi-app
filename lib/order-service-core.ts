import { Models, Query } from "appwrite";
import { Order, OrderItem, OrdersPage, StoreOrder } from "./order-types";

export interface OrderDetails { order: Order; storeOrders: StoreOrder[]; items: OrderItem[] }
export class OrderNotFoundError extends Error { constructor() { super("Order not found."); this.name = "OrderNotFoundError"; } }

type Document = Models.Document & Record<string, unknown>;
export interface OrderDatabase {
  getDocument(databaseId: string, collectionId: string, documentId: string): Promise<Document>;
  listDocuments(databaseId: string, collectionId: string, queries?: string[]): Promise<{ documents: Document[]; total: number }>;
}

export function createOrderService(db: OrderDatabase, databaseId = "grovi-db") {
  async function getOrdersForUser(userId: string, options: { limit?: number; cursor?: string | null } = {}): Promise<OrdersPage> {
    if (!userId) return { orders: [], nextCursor: null, hasMore: false };
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const queries = [Query.equal("userId", userId), Query.orderDesc("placedAt"), Query.limit(limit + 1)];
    if (options.cursor) queries.push(Query.cursorAfter(options.cursor));
    const result = await db.listDocuments(databaseId, "orders", queries);
    const owned = (result.documents as unknown as Order[]).filter((item) => item.userId === userId);
    const hasMore = owned.length > limit;
    const orders = owned.slice(0, limit);
    return { orders, hasMore, nextCursor: hasMore ? orders.at(-1)?.$id ?? null : null };
  }

  async function getOrderById(orderId: string, userId: string): Promise<Order> {
    if (!orderId || !userId) throw new OrderNotFoundError();
    let document: Document;
    try { document = await db.getDocument(databaseId, "orders", orderId); }
    catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && [401, 403, 404].includes(Number(error.code))) throw new OrderNotFoundError();
      throw error;
    }
    const result = document as unknown as Order;
    if (result.userId !== userId) throw new OrderNotFoundError();
    return result;
  }

  async function getStoreOrdersForOrder(orderId: string, userId: string): Promise<StoreOrder[]> {
    const result = await db.listDocuments(databaseId, "store_orders", [Query.equal("orderId", orderId), Query.limit(100)]);
    const children = result.documents as unknown as StoreOrder[];
    if (children.some((child) => child.orderId !== orderId || child.userId !== userId)) throw new OrderNotFoundError();
    return children;
  }

  async function getOrderItemsForOrder(orderId: string, userId: string): Promise<OrderItem[]> {
    const result = await db.listDocuments(databaseId, "order_items", [Query.equal("orderId", orderId), Query.limit(500)]);
    const children = result.documents as unknown as OrderItem[];
    if (children.some((child) => child.orderId !== orderId || child.userId !== userId)) throw new OrderNotFoundError();
    return children;
  }

  async function getOrderDetails(orderId: string, userId: string): Promise<OrderDetails> {
    const parent = await getOrderById(orderId, userId);
    const [storeOrders, items] = await Promise.all([getStoreOrdersForOrder(orderId, userId), getOrderItemsForOrder(orderId, userId)]);
    return { order: parent, storeOrders, items };
  }
  return { getOrdersForUser, getOrderById, getStoreOrdersForOrder, getOrderItemsForOrder, getOrderDetails };
}
