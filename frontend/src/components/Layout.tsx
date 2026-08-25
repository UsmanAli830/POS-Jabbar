import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import LoginGate from '../pages/LoginGate';
import SuperAdminLayout from './SuperAdminLayout';
import CompanyPortalLayout from './CompanyPortalLayout';

const LayoutContent: React.FC = () => {
  const { token, user, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#38bdf8',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        fontSize: '14px',
        fontWeight: 700
      }}>
        Initializing ERP Security Gateway...
      </div>
    );
  }

  // Gate 0: Not Logged In
  if (!token || !user) {
    return <LoginGate />;
  }

  // Gate 1: Super Admin (Software Supplier) -> Dedicated tab-free Supplier Master Layout
  if (isSuperAdmin) {
    return <SuperAdminLayout />;
  }

  // Gate 2: Client Store Users (Company Admin / Employee) -> Multi-tab Store ERP Layout
  return <CompanyPortalLayout />;
};

const Layout: React.FC = () => {
  return (
    <AuthProvider>
      <LayoutContent />
    </AuthProvider>
  );
};

export default Layout;
