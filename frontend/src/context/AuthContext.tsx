import React, { createContext, useContext, useState, useEffect } from 'react';

export type User = {
  id: number;
  name: string;
  username: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' | string;
  isAdmin?: boolean;
  companyId?: number | null;
  companyName?: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyContact?: string | null;
  companyEmail?: string | null;
  permissions?: string[];
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  login: (username: string, password: string, loginGate?: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' | 'CLIENT') => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (moduleKey: string) => boolean;
  refreshUser: () => Promise<void>;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  isEmployee: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('pos_token'));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('pos_user') ? JSON.parse(localStorage.getItem('pos_user')!) : null
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const userPayload = data.user || data.employee;
        setUser(userPayload);
        localStorage.setItem('pos_user', JSON.stringify(userPayload));
      } else {
        logout();
      }
    } catch (err) {
      console.error('Failed to verify token', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser(token);
  }, [token]);

  const login = async (username: string, password: string, loginGate?: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' | 'CLIENT') => {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, loginGate, gate: loginGate })
      });
    } catch (networkErr: any) {
      throw new Error('Unable to connect to POS server. Please ensure the backend is running.');
    }

    let data: any = {};
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      throw new Error('Server returned an unexpected response. Please try again.');
    }

    if (!res.ok) {
      throw new Error(data.error || `Login failed (Status: ${res.status})`);
    }

    const userPayload = data.user || data.employee;
    
    // Reset all storage to prevent state/tab bleed between portals
    localStorage.clear();
    sessionStorage.clear();

    setToken(data.token);
    setUser(userPayload);
    localStorage.setItem('pos_token', data.token);
    localStorage.setItem('pos_user', JSON.stringify(userPayload));
  };


  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser(token);
    }
  };

  const isSuperAdmin = Boolean(
    user && (user.role === 'SUPER_ADMIN' || user.username === 'superadmin' || user.username === 'admin')
  );

  const isCompanyAdmin = Boolean(
    user && (user.role === 'ADMIN' || user.isAdmin === true)
  );

  const isEmployee = Boolean(
    user && !isSuperAdmin && !isCompanyAdmin
  );

  const CATEGORY_MAP: Record<string, string[]> = {
    sales: ['pos', 'sales-return', 'bookings', 'promotions', 'sales', 'cash-register'],
    inventory: ['products', 'inventory', 'inventory-settings', 'purchases', 'purchase-return', 'returns', 'barcode-studio', 'bulk', 'formulas'],
    reports: ['dashboard', 'sales-analysis', 'assets-expenses', 'balance-sheet', 'unified-statement', 'profit-loss', 'reports-master', 'bill-ledger', 'receipt-center', 'reports'],
    accounts: ['customer-dues', 'vendor-dues', 'general-ledger', 'cash-recovery', 'vendor-payments', 'pending-payments', 'advance-salary', 'attendance', 'payroll', 'accounts'],
    manage: ['customers', 'assets', 'vendors', 'employees', 'employee-portal', 'change-password', 'settings', 'manage', 'employee-settings']
  };

  const hasPermission = (moduleKey: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin || isCompanyAdmin || user.role === 'ADMIN' || user.isAdmin) {
      return true;
    }
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }

    const key = moduleKey.toLowerCase().trim();
    return user.permissions.some(rawP => {
      const p = rawP.toLowerCase().trim();
      if (p === key || p === `/${key}` || key === `/${p}`) return true;
      // Check if granted category covers this module
      if (CATEGORY_MAP[p] && CATEGORY_MAP[p].includes(key)) return true;
      return false;
    });
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      login, 
      logout, 
      isLoading, 
      hasPermission, 
      refreshUser,
      isSuperAdmin,
      isCompanyAdmin,
      isEmployee
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

