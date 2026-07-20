export enum OrderStatus {
  Creating = "creating",
  Placed = "placed",
  Pending = "pending",
  Confirmed = "confirmed",
  Processing = "processing",
  Dispatched = "dispatched",
  Delivered = "delivered",
  Cancelled = "cancelled",
  Failed = "failed",
  PartiallyFulfilled = "partially_fulfilled",
}

export enum StoreOrderStatus {
  Pending = "pending",
  Accepted = "accepted",
  Processing = "processing",
  Dispatched = "dispatched",
  Delivered = "delivered",
  Cancelled = "cancelled",
}

export enum PaymentStatus {
  Pending = "pending",
  Authorized = "authorized",
  Paid = "paid",
  Failed = "failed",
  Refunded = "refunded",
  Cancelled = "cancelled",
}

export interface Order {
  $id: string;
  userId: string;
  orderNumber: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: OrderStatus;
  statusReason?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  currency: string;
  addressId: string;
  addressLabel: string;
  deliveryParish: string;
  deliveryCommunity: string;
  deliveryStreet?: string;
  deliveryHouseDetails?: string;
  deliveryLandmarkDirections: string;
  deliveryContactPhone: string;
  itemCount: number;
  storeCount: number;
  subtotalJmdCents: number;
  deliveryFeeJmdCents: number;
  discountJmdCents: number;
  totalJmdCents: number;
  schemaVersion: number;
  cartUpdatedAt?: string;
  placedAt: string;
  confirmedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}

export interface StoreOrder {
  $id: string;
  orderId: string;
  userId: string;
  storeLocationId: string;
  storeName: string;
  storeBrandId?: string;
  status: StoreOrderStatus;
  statusReason?: string;
  itemCount: number;
  subtotalJmdCents: number;
  deliveryFeeJmdCents: number;
  discountJmdCents: number;
  totalJmdCents: number;
  acceptedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}

export interface OrderItem {
  $id: string;
  orderId: string;
  storeOrderId: string;
  userId: string;
  productId: string;
  storeLocationId: string;
  sku: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  unitSize?: string;
  quantity: number;
  unitPriceJmdCents: number;
  lineTotalJmdCents: number;
}

export interface OrdersPage {
  orders: Order[];
  nextCursor: string | null;
  hasMore: boolean;
}
