import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getOrderDetails, OrderDetails, OrderNotFoundError } from "./order-service";

export function useOrderDetails(orderId?: string, userId?: string | null) {
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orderId || !userId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { setDetails(await getOrderDetails(orderId, userId)); }
    catch (cause) {
      setDetails(null);
      setError(cause instanceof OrderNotFoundError ? "Order not found." : "We couldn't load this order. Please try again.");
    } finally { setLoading(false); }
  }, [orderId, userId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  return { details, loading, error, reload };
}
