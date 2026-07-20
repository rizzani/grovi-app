export class ConflictError extends Error {
  constructor() { super("Document already exists"); this.code = 409; }
}

export class MemoryRepository {
  constructor(seed = {}) {
    this.addresses = new Map((seed.addresses || []).map((value) => [value.$id, value]));
    this.carts = new Map((seed.carts || []).map((value) => [value.userId, value]));
    this.inventory = new Map((seed.inventory || []).map((value) => [`${value.product_id}:${value.store_location_id}`, value]));
    this.products = new Map((seed.products || []).map((value) => [value.$id, value]));
    this.stores = new Map((seed.stores || []).map((value) => [value.$id, value]));
    this.orders = new Map();
    this.storeOrders = new Map();
    this.orderItems = new Map();
    this.audits = new Map();
    this.failNextOrderItemCreate = false;
  }

  isConflict(error) { return error?.code === 409; }
  async findOrderByIdempotencyKey(key) { return [...this.orders.values()].find((order) => order.idempotencyKey === key) || null; }
  async getAddress(id) { return this.addresses.get(id) || null; }
  async getCart(userId) { return this.carts.get(userId) || null; }
  async getInventory(productId, storeId) { return this.inventory.get(`${productId}:${storeId}`) || null; }
  async getProduct(id) { return this.products.get(id) || null; }
  async getStore(id) { return this.stores.get(id) || null; }

  async createOrder(id, data) {
    if (this.orders.has(id) || await this.findOrderByIdempotencyKey(data.idempotencyKey)) throw new ConflictError();
    const document = { $id: id, ...data };
    this.orders.set(id, document);
    return document;
  }

  async updateOrder(id, data) {
    const document = { ...this.orders.get(id), ...data };
    this.orders.set(id, document);
    return document;
  }

  async createOrVerify(map, id, data, verify) {
    if (map.has(id)) {
      const existing = map.get(id);
      verify(existing, data, "Existing child document does not match the order.");
      return existing;
    }
    const document = { $id: id, ...data };
    map.set(id, document);
    return document;
  }

  createOrVerifyStoreOrder(id, data, _userId, verify) { return this.createOrVerify(this.storeOrders, id, data, verify); }
  createOrVerifyOrderItem(id, data, _userId, verify) {
    if (this.failNextOrderItemCreate) {
      this.failNextOrderItemCreate = false;
      throw new Error("Injected order item failure");
    }
    return this.createOrVerify(this.orderItems, id, data, verify);
  }
  createOrVerifyAudit(id, data, _userId, verify) { return this.createOrVerify(this.audits, id, data, verify); }

  async getOrderChildCounts(orderId) {
    return {
      storeOrders: [...this.storeOrders.values()].filter((value) => value.orderId === orderId).length,
      orderItems: [...this.orderItems.values()].filter((value) => value.orderId === orderId).length,
    };
  }
}

export function fixture({ multiStore = false } = {}) {
  const revision = "2026-07-20T12:00:00.000Z";
  const items = [
    { productId: "product-1", storeId: "store-1", quantity: 2, priceJmdCents: 25000 },
    ...(multiStore ? [{ productId: "product-2", storeId: "store-2", quantity: 1, priceJmdCents: 40000 }] : []),
  ];
  const repo = new MemoryRepository({
    addresses: [{
      $id: "address-1", userId: "user-1", label: "Home", parish: "Kingston",
      community: "Half Way Tree", street: "Hope Road", houseDetails: "12",
      landmarkDirections: "Beside the park", contactPhone: "+18765550123",
    }],
    carts: [{ userId: "user-1", updatedAt: revision, items: JSON.stringify(items) }],
    inventory: [
      { product_id: "product-1", store_location_id: "store-1", price_jmd_cents: 25000, in_stock: true },
      { product_id: "product-2", store_location_id: "store-2", price_jmd_cents: 40000, in_stock: true },
    ],
    products: [
      { $id: "product-1", sku: "SKU-1", title: "Rice", brand: "Grovi", primary_image_url: "https://example.test/rice.jpg", unit_size: "1 kg" },
      { $id: "product-2", sku: "SKU-2", title: "Peas", brand: "Grovi", primary_image_url: "https://example.test/peas.jpg", unit_size: "500 g" },
    ],
    stores: [
      { $id: "store-1", display_name: "Kingston Store", name: "Kingston", brand_id: "brand-1", is_active: true },
      { $id: "store-2", display_name: "Portmore Store", name: "Portmore", brand_id: "brand-2", is_active: true },
    ],
  });
  return {
    repo,
    revision,
    input: {
      schemaVersion: 1,
      addressId: "address-1",
      paymentMethod: "cash_on_delivery",
      cartRevision: revision,
      clientRequestId: "request-1",
    },
  };
}
