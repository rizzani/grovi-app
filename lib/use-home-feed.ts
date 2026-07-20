import { useCallback, useEffect, useState } from "react";
import { getAddresses } from "./profile-service";
import { getHomeFeed, type HomeFeed } from "./home-feed-service";

export function useHomeFeed(userId: string | null) {
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [deliveryLabel, setDeliveryLabel] = useState("Select a delivery location");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const addresses = userId ? await getAddresses(userId).catch((addressError) => {
        console.warn("[HomeFeed] Delivery address unavailable:", addressError);
        return [];
      }) : [];
      const address = addresses.find((item) => item.default) ?? addresses[0];
      if (address) setDeliveryLabel([address.community, address.parish].filter(Boolean).join(", "));
      const result = await getHomeFeed({ deliveryParish: address?.parish });
      setFeed(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the home feed");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { feed, deliveryLabel, isLoading, error, refresh };
}
