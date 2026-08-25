import React, { createContext, useContext, useState, useEffect } from 'react';

type StoreSettings = {
  id: number;
  storeName: string;
  storeAddress: string;
  receiptFooter: string;
  primaryColor: string;
  logoUrl: string | null;
  allowNegativeStock: boolean;
};

type SettingsContextType = {
  settings: StoreSettings | null;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.primaryColor) {
          document.documentElement.style.setProperty('--accent-primary', data.primaryColor);
          // Auto-generate hover color by adjusting opacity or lightness. For simplicity, just use the same or a slight variation.
          // Using standard hex for primary, we can use it directly.
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
