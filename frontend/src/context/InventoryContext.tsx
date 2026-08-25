import React, { createContext, useContext, useState, useEffect } from 'react';

type InventoryContextType = {
  products: any[];
  refreshInventory: () => Promise<void>;
};

const InventoryContext = createContext<InventoryContextType>({
  products: [],
  refreshInventory: async () => {}
});

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<any[]>([]);

  const refreshInventory = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/products?t=${Date.now()}`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch global inventory', error);
    }
  };

  useEffect(() => {
    refreshInventory();
  }, []);

  return (
    <InventoryContext.Provider value={{ products, refreshInventory }}>
      {children}
    </InventoryContext.Provider>
  );
};
