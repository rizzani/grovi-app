import { CheckoutError } from "./errors.js";
import { parseCart, validateRequest } from "./contract.js";
import { documentId, orderNumber, requestFingerprint } from "./ids.js";
import { calculateDeliveryFeeJmdCents, DELIVERY_PRICING_VERSION, MAX_DELIVERY_DISTANCE_KM, distanceKmFromMeters, validateCoordinates } from "./delivery-pricing.js";
import { OsrmDistanceProvider } from "./distance-provider.js";

const DISCOUNT_JMD_CENTS = 0;

function optional(value) {
  return value === undefined || value === null || value === "" ? undefined : value;
}

function assertSame(actual, expected, message) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new CheckoutError("ORDER_CREATION_FAILED", message, 500, { field: key });
    }
  }
}

function responseFor(order, replay, cartReconciliation = "unknown") {
  if (order.status !== "placed") {
    throw new CheckoutError("ORDER_CREATION_FAILED", "Order creation has not completed.", 500, undefined, true);
  }
  return {
    ok: true,
    data: {
      orderId: order.$id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      itemCount: order.itemCount,
      storeCount: order.storeCount,
      subtotalJmdCents: order.subtotalJmdCents,
      deliveryFeeJmdCents: order.deliveryFeeJmdCents,
      discountJmdCents: order.discountJmdCents,
      totalJmdCents: order.totalJmdCents,
      deliveryDistanceMeters: order.deliveryDistanceMeters,
      deliveryDurationSeconds: order.deliveryDurationSeconds,
      deliveryPricingVersion: order.deliveryPricingVersion,
      consumedRevision: order.cartUpdatedAt,
      idempotentReplay: replay,
      cartReconciliation,
    },
  };
}

async function reconcileCart(repo, userId, revision) {
  try { return await repo.clearCartIfRevisionMatches(userId, revision); }
  catch (error) {
    console.error("[Checkout] Appwrite cart reconciliation failed", { userId, cartRevision: revision, error });
    return "failed";
  }
}

async function existingOutcome(repo, clientRequestId, fingerprint) {
  const existing = await repo.findOrderByIdempotencyKey(clientRequestId);
  if (!existing) return null;
  if (existing.requestFingerprint !== fingerprint) {
    throw new CheckoutError("IDEMPOTENCY_CONFLICT", "clientRequestId was already used for different request data.", 409);
  }
  if (existing.status === "placed") return responseFor(existing, true);
  if (existing.status !== "creating") {
    throw new CheckoutError("ORDER_CREATION_FAILED", "The existing order cannot be resumed.", 500, undefined, true);
  }
  return { existing };
}

async function priceCart(repo, rawItems, maxQuantity) {
  const priced = [];
  const seen = new Set();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new CheckoutError("ORDER_CREATION_FAILED", "Stored cart data is malformed.", 500);
    }
    const { productId, storeId, quantity, priceJmdCents } = raw;
    if (typeof productId !== "string" || !productId || typeof storeId !== "string" || !storeId ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
      throw new CheckoutError("ORDER_CREATION_FAILED", "Stored cart data is malformed.", 500);
    }
    const key = `${productId}\u001f${storeId}`;
    if (seen.has(key)) {
      throw new CheckoutError("ORDER_CREATION_FAILED", "Stored cart contains duplicate lines.", 500);
    }
    seen.add(key);

    const inventory = await repo.getInventory(productId, storeId);
    if (!inventory || inventory.in_stock !== true) {
      throw new CheckoutError("PRODUCT_UNAVAILABLE", "A cart item is unavailable.", 409, { productId, storeId });
    }
    if (!Number.isSafeInteger(inventory.price_jmd_cents) || inventory.price_jmd_cents < 0) {
      throw new CheckoutError("SERVICE_UNAVAILABLE", "Inventory pricing is unavailable.", 503, undefined, true);
    }
    if (!Number.isSafeInteger(priceJmdCents) || priceJmdCents !== inventory.price_jmd_cents) {
      throw new CheckoutError("PRICE_CHANGED", "A cart item price changed.", 409, {
        productId,
        storeId,
        previousPriceJmdCents: Number.isSafeInteger(priceJmdCents) ? priceJmdCents : null,
        currentPriceJmdCents: inventory.price_jmd_cents,
      });
    }
    const [product, store] = await Promise.all([repo.getProduct(productId), repo.getStore(storeId)]);
    if (!product) {
      throw new CheckoutError("PRODUCT_UNAVAILABLE", "A cart item is unavailable.", 409, { productId, storeId });
    }
    if (!store || store.is_active !== true) {
      throw new CheckoutError("STORE_UNAVAILABLE", "A store in the cart is unavailable.", 409, { storeId });
    }
    const lineTotalJmdCents = inventory.price_jmd_cents * quantity;
    if (!Number.isSafeInteger(lineTotalJmdCents)) {
      throw new CheckoutError("ORDER_CREATION_FAILED", "Cart total exceeds supported limits.", 500);
    }
    priced.push({
      productId,
      storeId,
      quantity,
      unitPriceJmdCents: inventory.price_jmd_cents,
      lineTotalJmdCents,
      sku: product.sku,
      title: product.title,
      brand: optional(product.brand),
      imageUrl: optional(product.primary_image_url),
      unitSize: optional(product.unit_size),
      storeName: store.display_name || store.name,
      storeBrandId: optional(store.brand_id),
    });
  }
  return priced;
}

async function priceDelivery(repo, stores, address, distanceProvider) {
  const pricedStores = [];
  for (const store of stores) {
    if (!validateCoordinates(store)) {
      throw new CheckoutError("STORE_LOCATION_COORDINATES_MISSING", "Delivery is temporarily unavailable for one of the selected stores.", 500);
    }
    let route;
    try {
      route = await distanceProvider.getDrivingDistance({
        origin: { latitude: Number(store.latitude), longitude: Number(store.longitude) },
        destination: { latitude: Number(address.latitude), longitude: Number(address.longitude) },
      });
    } catch (error) {
      console.error("[Checkout] Driving distance unavailable", { storeId: store.storeId, error: error?.message });
      throw new CheckoutError("DELIVERY_DISTANCE_UNAVAILABLE", "Delivery pricing is temporarily unavailable. Please retry.", 503, undefined, true);
    }
    const distanceKm = distanceKmFromMeters(route.distanceMeters);
    if (distanceKm > MAX_DELIVERY_DISTANCE_KM) {
      throw new CheckoutError("DELIVERY_OUT_OF_RANGE", "This delivery address is outside Grovi's delivery area.", 422, { maxDistanceKm: MAX_DELIVERY_DISTANCE_KM });
    }
    pricedStores.push({ ...store, deliveryDistanceMeters: Math.round(route.distanceMeters), deliveryDurationSeconds: Number.isFinite(route.durationSeconds) ? Math.round(route.durationSeconds) : undefined, deliveryFeeJmdCents: calculateDeliveryFeeJmdCents(distanceKm) });
  }
  return pricedStores;
}

function summarize(items, pricedStores) {
  const fees = new Map(pricedStores.map((store) => [store.storeId, store]));
  const stores = new Map();
  for (const item of items) {
    const current = stores.get(item.storeId) || {
      storeId: item.storeId,
      storeName: item.storeName,
      storeBrandId: item.storeBrandId,
      items: [],
      itemCount: 0,
      subtotalJmdCents: 0,
      deliveryFeeJmdCents: fees.get(item.storeId).deliveryFeeJmdCents,
      deliveryDistanceMeters: fees.get(item.storeId).deliveryDistanceMeters,
      deliveryDurationSeconds: fees.get(item.storeId).deliveryDurationSeconds,
    };
    current.items.push(item);
    current.itemCount += item.quantity;
    current.subtotalJmdCents += item.lineTotalJmdCents;
    stores.set(item.storeId, current);
  }
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalJmdCents = items.reduce((total, item) => total + item.lineTotalJmdCents, 0);
  return {
    stores: [...stores.values()],
    itemCount,
    storeCount: stores.size,
    subtotalJmdCents,
    deliveryFeeJmdCents: [...stores.values()].reduce((total, store) => total + store.deliveryFeeJmdCents, 0),
    deliveryDistanceMeters: [...stores.values()].reduce((total, store) => total + store.deliveryDistanceMeters, 0),
    deliveryDurationSeconds: [...stores.values()].reduce((total, store) => total + (store.deliveryDurationSeconds || 0), 0) || undefined,
    discountJmdCents: DISCOUNT_JMD_CENTS,
    totalJmdCents: subtotalJmdCents + [...stores.values()].reduce((total, store) => total + store.deliveryFeeJmdCents, 0) - DISCOUNT_JMD_CENTS,
  };
}

export async function placeOrder({ userId, input, repo, now = () => new Date().toISOString(), maxQuantity = 99, distanceProvider = repo.distanceProvider || new OsrmDistanceProvider() }) {
  if (!userId) throw new CheckoutError("UNAUTHENTICATED", "Authentication is required.", 401);
  const request = validateRequest(input);
  const fingerprint = requestFingerprint(userId, request);
  const prior = await existingOutcome(repo, request.clientRequestId, fingerprint);
  if (prior && !prior.existing) {
    const cartReconciliation = await reconcileCart(repo, userId, prior.data.consumedRevision);
    return { ...prior, data: { ...prior.data, cartReconciliation } };
  }

  const address = await repo.getAddress(request.addressId);
  if (!address) throw new CheckoutError("ADDRESS_NOT_FOUND", "The selected address was not found.", 404);
  if (address.userId !== userId) throw new CheckoutError("ADDRESS_NOT_OWNED", "The selected address does not belong to this user.", 403);
  if (!Number.isFinite(Number(address.latitude)) || !Number.isFinite(Number(address.longitude))
    || Number(address.latitude) < -90 || Number(address.latitude) > 90
    || Number(address.longitude) < -180 || Number(address.longitude) > 180) {
    throw new CheckoutError("INVALID_DELIVERY_LOCATION", "Choose a valid delivery location before checkout.", 422);
  }

  const cart = await repo.getCart(userId);
  if (!cart) throw new CheckoutError("EMPTY_CART", "The cart is empty.", 409);
  const cartRevision = cart.updatedAt;
  if (cartRevision !== request.cartRevision) {
    throw new CheckoutError("CART_REVISION_CONFLICT", "The cart changed before checkout.", 409, {
      requestedRevision: request.cartRevision,
      currentRevision: cartRevision,
    });
  }
  const priorCartOrder = await repo.findPlacedOrderByCartRevision(userId, cartRevision);
  if (priorCartOrder) {
    const cartReconciliation = await reconcileCart(repo, userId, cartRevision);
    console.warn("[Checkout] Reusing order for an already-consumed cart revision", {
      orderId: priorCartOrder.$id,
      cartRevision,
      requestId: request.clientRequestId,
    });
    return responseFor(priorCartOrder, true, cartReconciliation);
  }
  const rawItems = parseCart(cart);
  const items = await priceCart(repo, rawItems, maxQuantity);
  const deliveryStores = [...new Map(items.map((item) => [item.storeId, item])).values()].map((item) => repo.getStore(item.storeId));
  const storesForDelivery = await Promise.all(deliveryStores);
  const pricedDeliveryStores = storesForDelivery.map((store) => ({ storeId: store.$id, latitude: store.latitude, longitude: store.longitude }));
  const totals = summarize(items, await priceDelivery(repo, pricedDeliveryStores, address, distanceProvider));
  const orderId = prior?.existing?.$id || documentId("ord", userId, request.clientRequestId);
  const timestamp = prior?.existing?.placedAt || now();
  const parentData = {
    userId,
    orderNumber: orderNumber(orderId),
    idempotencyKey: request.clientRequestId,
    requestFingerprint: fingerprint,
    status: "creating",
    paymentMethod: "cash_on_delivery",
    paymentStatus: "pending",
    currency: "JMD",
    addressId: address.$id,
    addressLabel: address.label,
    deliveryParish: address.parish,
    deliveryCommunity: address.community,
    deliveryStreet: optional(address.street),
    deliveryHouseDetails: optional(address.houseDetails),
    deliveryLandmarkDirections: address.landmarkDirections || "",
    deliveryContactPhone: optional(address.contactPhone),
    deliveryDistanceMeters: totals.deliveryDistanceMeters,
    deliveryDurationSeconds: totals.deliveryDurationSeconds,
    deliveryPricingVersion: DELIVERY_PRICING_VERSION,
    itemCount: totals.itemCount,
    storeCount: totals.storeCount,
    subtotalJmdCents: totals.subtotalJmdCents,
    deliveryFeeJmdCents: totals.deliveryFeeJmdCents,
    discountJmdCents: totals.discountJmdCents,
    totalJmdCents: totals.totalJmdCents,
    schemaVersion: 1,
    cartUpdatedAt: cartRevision,
    placedAt: timestamp,
  };

  let parent = prior?.existing;
  if (parent) {
    assertSame(parent, { ...parentData, status: "creating" }, "Existing order does not match the resumed request.");
  } else {
    try {
      parent = await repo.createOrder(orderId, parentData, userId);
    } catch (error) {
      if (!repo.isConflict(error)) throw error;
      const raced = await existingOutcome(repo, request.clientRequestId, fingerprint);
      if (raced && !raced.existing) return raced;
      parent = raced?.existing;
      if (!parent) throw error;
      assertSame(parent, parentData, "Existing order does not match the resumed request.");
    }
  }

  for (const store of totals.stores) {
    const storeOrderId = documentId("sto", orderId, store.storeId);
    const storeOrderData = {
      orderId,
      userId,
      storeLocationId: store.storeId,
      storeName: store.storeName,
      storeBrandId: store.storeBrandId,
      status: "pending",
      itemCount: store.itemCount,
      subtotalJmdCents: store.subtotalJmdCents,
      deliveryFeeJmdCents: store.deliveryFeeJmdCents,
      discountJmdCents: 0,
      totalJmdCents: store.subtotalJmdCents + store.deliveryFeeJmdCents,
      deliveryDistanceMeters: store.deliveryDistanceMeters,
      deliveryDurationSeconds: store.deliveryDurationSeconds,
    };
    await repo.createOrVerifyStoreOrder(storeOrderId, storeOrderData, userId, assertSame);
    for (const item of store.items) {
      const itemId = documentId("itm", orderId, item.productId, item.storeId);
      const itemData = {
        orderId,
        storeOrderId,
        userId,
        productId: item.productId,
        storeLocationId: item.storeId,
        sku: item.sku,
        title: item.title,
        brand: item.brand,
        imageUrl: item.imageUrl,
        unitSize: item.unitSize,
        quantity: item.quantity,
        unitPriceJmdCents: item.unitPriceJmdCents,
        lineTotalJmdCents: item.lineTotalJmdCents,
      };
      await repo.createOrVerifyOrderItem(itemId, itemData, userId, assertSame);
    }
  }

  const counts = await repo.getOrderChildCounts(orderId);
  if (counts.storeOrders !== totals.storeCount || counts.orderItems !== items.length) {
    throw new CheckoutError("ORDER_CREATION_FAILED", "Order children could not be verified.", 500, counts, true);
  }
  await repo.createOrVerifyAudit(documentId("aud", orderId), {
    userId,
    eventType: "order.placed",
    metadata: JSON.stringify({ orderId, orderNumber: parentData.orderNumber, cartRevision }),
    timestamp,
  }, userId, assertSame);
  parent = await repo.updateOrder(orderId, { status: "placed" });
  const cartReconciliation = await reconcileCart(repo, userId, cartRevision);
  return responseFor(parent, Boolean(prior?.existing), cartReconciliation);
}

export async function quoteOrder({ userId, addressId, cartRevision, repo, distanceProvider = repo.distanceProvider || new OsrmDistanceProvider(), maxQuantity = 99 }) {
  if (!userId) throw new CheckoutError("UNAUTHENTICATED", "Authentication is required.", 401);
  const address = await repo.getAddress(addressId);
  if (!address) throw new CheckoutError("ADDRESS_NOT_FOUND", "The selected address was not found.", 404);
  if (address.userId !== userId) throw new CheckoutError("ADDRESS_NOT_OWNED", "The selected address does not belong to this user.", 403);
  if (!Number.isFinite(Number(address.latitude)) || !Number.isFinite(Number(address.longitude))
    || Number(address.latitude) < -90 || Number(address.latitude) > 90
    || Number(address.longitude) < -180 || Number(address.longitude) > 180) {
    throw new CheckoutError("INVALID_DELIVERY_LOCATION", "Choose a valid delivery location before checkout.", 422);
  }
  const cart = await repo.getCart(userId);
  if (!cart) throw new CheckoutError("EMPTY_CART", "The cart is empty.", 409);
  if (cart.updatedAt !== cartRevision) {
    throw new CheckoutError("CART_REVISION_CONFLICT", "The cart changed before delivery pricing was calculated.", 409, {
      requestedRevision: cartRevision,
      currentRevision: cart.updatedAt,
    });
  }
  const items = await priceCart(repo, parseCart(cart), maxQuantity);
  const storesForDelivery = await Promise.all([...new Set(items.map((item) => item.storeId))].map((storeId) => repo.getStore(storeId)));
  const pricedDeliveryStores = storesForDelivery.map((store) => ({ storeId: store.$id, latitude: store.latitude, longitude: store.longitude }));
  const totals = summarize(items, await priceDelivery(repo, pricedDeliveryStores, address, distanceProvider));
  return {
    ok: true,
    data: {
      addressId,
      cartRevision,
      subtotalJmdCents: totals.subtotalJmdCents,
      deliveryFeeJmdCents: totals.deliveryFeeJmdCents,
      discountJmdCents: totals.discountJmdCents,
      totalJmdCents: totals.totalJmdCents,
      deliveryDistanceMeters: totals.deliveryDistanceMeters,
      deliveryDurationSeconds: totals.deliveryDurationSeconds,
      deliveryPricingVersion: DELIVERY_PRICING_VERSION,
    },
  };
}
