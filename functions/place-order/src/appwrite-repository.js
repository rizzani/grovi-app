import { Databases, Permission, Query, Role } from "node-appwrite";

function compact(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

export class AppwriteRepository {
  constructor(client, env = process.env) {
    this.db = new Databases(client);
    this.databaseId = env.GROVI_DATABASE_ID || "grovi-db";
    this.collections = {
      carts: env.GROVI_CARTS_COLLECTION_ID || "carts",
      addresses: env.GROVI_ADDRESSES_COLLECTION_ID || "addresses",
      products: env.GROVI_PRODUCTS_COLLECTION_ID || "products",
      stores: env.GROVI_STORE_LOCATIONS_COLLECTION_ID || "store_location",
      inventory: env.GROVI_INVENTORY_COLLECTION_ID || "store_location_product",
      orders: env.GROVI_ORDERS_COLLECTION_ID || "orders",
      storeOrders: env.GROVI_STORE_ORDERS_COLLECTION_ID || "store_orders",
      orderItems: env.GROVI_ORDER_ITEMS_COLLECTION_ID || "order_items",
      audit: env.GROVI_AUDIT_LOGS_COLLECTION_ID || "audit_logs",
    };
  }

  isConflict(error) { return error?.code === 409; }
  permissions(userId) { return [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))]; }

  async findOrderByIdempotencyKey(key) {
    const result = await this.db.listDocuments(this.databaseId, this.collections.orders, [Query.equal("idempotencyKey", key), Query.limit(1)]);
    return result.documents[0] || null;
  }

  async getAddress(id) {
    try { return await this.db.getDocument(this.databaseId, this.collections.addresses, id); }
    catch (error) { if (error?.code === 404) return null; throw error; }
  }

  async getCart(userId) {
    const result = await this.db.listDocuments(this.databaseId, this.collections.carts, [Query.equal("userId", userId), Query.limit(2)]);
    if (result.documents.length > 1) throw new Error("Multiple carts exist for user");
    return result.documents[0] || null;
  }

  async getInventory(productId, storeId) {
    const result = await this.db.listDocuments(this.databaseId, this.collections.inventory, [
      Query.equal("product_id", productId), Query.equal("store_location_id", storeId), Query.limit(2),
    ]);
    if (result.documents.length > 1) throw new Error("Duplicate inventory records");
    return result.documents[0] || null;
  }

  async getProduct(id) {
    try { return await this.db.getDocument(this.databaseId, this.collections.products, id); }
    catch (error) { if (error?.code === 404) return null; throw error; }
  }

  async getStore(id) {
    try { return await this.db.getDocument(this.databaseId, this.collections.stores, id); }
    catch (error) { if (error?.code === 404) return null; throw error; }
  }

  createOrder(id, data, userId) {
    return this.db.createDocument(this.databaseId, this.collections.orders, id, compact(data), this.permissions(userId));
  }

  updateOrder(id, data) {
    return this.db.updateDocument(this.databaseId, this.collections.orders, id, compact(data));
  }

  async createOrVerify(collection, id, data, userId, verify) {
    try {
      return await this.db.createDocument(this.databaseId, collection, id, compact(data), this.permissions(userId));
    } catch (error) {
      if (!this.isConflict(error)) throw error;
      const existing = await this.db.getDocument(this.databaseId, collection, id);
      verify(existing, compact(data), "Existing child document does not match the order.");
      return existing;
    }
  }

  createOrVerifyStoreOrder(id, data, userId, verify) {
    return this.createOrVerify(this.collections.storeOrders, id, data, userId, verify);
  }
  createOrVerifyOrderItem(id, data, userId, verify) {
    return this.createOrVerify(this.collections.orderItems, id, data, userId, verify);
  }
  createOrVerifyAudit(id, data, userId, verify) {
    return this.createOrVerify(this.collections.audit, id, data, userId, verify);
  }

  async getOrderChildCounts(orderId) {
    const [stores, items] = await Promise.all([
      this.db.listDocuments(this.databaseId, this.collections.storeOrders, [Query.equal("orderId", orderId), Query.limit(500)]),
      this.db.listDocuments(this.databaseId, this.collections.orderItems, [Query.equal("orderId", orderId), Query.limit(500)]),
    ]);
    return { storeOrders: stores.documents.length, orderItems: items.documents.length };
  }
}
