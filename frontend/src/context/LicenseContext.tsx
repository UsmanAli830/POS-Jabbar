import React, { createContext, useContext, useState, useEffect } from 'react';
import Lockout from '../pages/Lockout';

interface LicenseContextType {
  isLocked: boolean;
  expiresAt?: string;
  checkLicenseStatus: () => Promise<void>;
  unlock: () => void;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | undefined>(undefined);

  const getApiHost = () => {
    if (typeof window !== 'undefined') {
      return `http://${window.location.hostname}:3000`;
    }
    return 'http://localhost:3000';
  };

  const checkLicenseStatus = async () => {
    try {
      const res = await fetch(`${getApiHost()}/api/license/status`);
      if (res.ok) {
        const data = await res.json();
        setExpiresAt(data.expiresAt);
        if (data.isExpired || data.isLocked) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      }
    } catch (e) {
      console.error('[License Check Error]', e);
    }
  };

  // Global fetch interceptor to automatically route multi-device host and catch 403 LICENSE_EXPIRED
  // NOTE: The initial license check is intentionally NOT called on mount.
  // Lockout is triggered in two controlled ways only:
  //   1. At login time — LoginGate detects LICENSE_EXPIRED and renders <Lockout>
  //   2. Post-login — this interceptor catches 403 from authenticated API calls
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      let [resource, config] = args;

      // 1. Multi-Device Host Resolution: Rewrite localhost:3000 to current host IP/domain
      if (typeof resource === 'string' && resource.startsWith('http://localhost:3000')) {
        const currentHostname = window.location.hostname || 'localhost';
        resource = resource.replace('http://localhost:3000', `http://${currentHostname}:3000`);
      } else if (resource instanceof Request && resource.url.startsWith('http://localhost:3000')) {
        const currentHostname = window.location.hostname || 'localhost';
        const newUrl = resource.url.replace('http://localhost:3000', `http://${currentHostname}:3000`);
        resource = new Request(newUrl, resource);
      }

      try {
        const response = await originalFetch(resource, config);

        // 2. Catch LICENSE_EXPIRED 403 Forbidden (only for authenticated API calls)
        if (response.status === 403) {
          const clone = response.clone();
          try {
            const data = await clone.json();
            if (data && data.error === 'LICENSE_EXPIRED') {
              setIsLocked(true);
              if (data.expiresAt) {
                setExpiresAt(data.expiresAt);
              }
            }
          } catch (jsonErr) {
            // Not json, ignore
          }
        }

        return response;
      } catch (fetchErr) {
        throw fetchErr;
      }
    };

    // Do NOT call checkLicenseStatus() here — it would check the global license
    // and block the login page for unauthenticated users.

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const unlock = () => {
    setIsLocked(false);
    checkLicenseStatus();
  };

  if (isLocked) {
    return <Lockout expiresAt={expiresAt} onUnlocked={unlock} />;
  }

  return (
    <LicenseContext.Provider value={{ isLocked, expiresAt, checkLicenseStatus, unlock }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};
