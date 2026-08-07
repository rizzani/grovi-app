import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UserProvider } from "../contexts/UserContext";
import { SearchProvider } from "../contexts/SearchContext";
import { CartProvider } from "../contexts/CartContext";
import { CheckoutProvider } from "../contexts/CheckoutContext";
import { AnalyticsEvent, trackEvent } from "../lib/analytics";

export default function RootLayout() {
  useEffect(() => { void trackEvent(AnalyticsEvent.AppOpened); }, []);
  return (
    <SafeAreaProvider>
      <UserProvider>
        <SearchProvider>
          <CheckoutProvider>
            <CartProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: "#FFFFFF",
                  },
                }}
              />
            </CartProvider>
          </CheckoutProvider>
        </SearchProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
