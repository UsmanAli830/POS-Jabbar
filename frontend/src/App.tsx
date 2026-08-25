import React from 'react';
import Layout from './components/Layout';
import './index.css';
import { SettingsProvider } from './context/SettingsContext';
import { InventoryProvider } from './context/InventoryContext';
import { LicenseProvider } from './context/LicenseContext';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

const App: React.FC = () => {
  return (
    <LicenseProvider>
      <SettingsProvider>
        <InventoryProvider>
          <Layout />
        </InventoryProvider>
      </SettingsProvider>
    </LicenseProvider>
  );
};

export default App;
