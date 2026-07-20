import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useUser } from "./UserContext";

interface CheckoutContextType {
  selectedAddressId: string | null;
  setSelectedAddressId: (addressId: string | null) => void;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAddressId(null);
  }, [userId]);

  return (
    <CheckoutContext.Provider value={{ selectedAddressId, setSelectedAddressId }}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error("useCheckout must be used within a CheckoutProvider");
  }
  return context;
}
