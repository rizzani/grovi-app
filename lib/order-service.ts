import { databaseId, databases } from "./appwrite-client";
import { createOrderService } from "./order-service-core";

export { createOrderService, OrderNotFoundError } from "./order-service-core";
export type { OrderDetails } from "./order-service-core";

const service = createOrderService(databases, databaseId);
export const getOrdersForUser = service.getOrdersForUser;
export const getOrderById = service.getOrderById;
export const getStoreOrdersForOrder = service.getStoreOrdersForOrder;
export const getOrderItemsForOrder = service.getOrderItemsForOrder;
export const getOrderDetails = service.getOrderDetails;
