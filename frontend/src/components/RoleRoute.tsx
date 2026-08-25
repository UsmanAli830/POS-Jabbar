import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const UnauthorizedAccess: React.FC<{ message?: string; allowedRole?: string }> = ({ 
  message = "You do not have permission to access this portal.",
  allowedRole = "Super Administrator"
}) => {
  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: '#ffffff',
        border: '1px solid #fecaca',
        borderRadius: '14px',
        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.1)',
        padding: '36px 28px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: '#dc2626'
        }}>
          <ShieldAlert size={36} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0' }}>
          Access Denied (Role Restricted)
        </h2>

        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5, margin: '0 0 20px 0' }}>
          {message}
        </p>

        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '24px'
        }}>
          Required Authorization: <strong style={{ color: '#0f172a' }}>{allowedRole}</strong>
        </div>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('openModule', { detail: { id: 'dashboard' } }));
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#0f172a',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          Return to ERP Dashboard
        </button>
      </div>
    </div>
  );
};

/**
 * Guard for Software Supplier (Tier 1 Super Admin)
 */
export const SuperAdminRoute: React.FC<RouteGuardProps> = ({ children, fallback }) => {
  const { user, isSuperAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Verifying authorization...</div>;
  }

  if (!isSuperAdmin || user?.role !== 'SUPER_ADMIN') {
    return fallback ? <>{fallback}</> : (
      <UnauthorizedAccess 
        message="This console is exclusively reserved for the software supplier Super Administrator. Company Admins and Staff are strictly restricted."
        allowedRole="SUPER_ADMIN"
      />
    );
  }

  return <>{children}</>;
};

/**
 * Guard for Store / Company Admin (Tier 2 Admin)
 */
export const AdminRoute: React.FC<RouteGuardProps> = ({ children, fallback }) => {
  const { user, isSuperAdmin, isCompanyAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Verifying authorization...</div>;
  }

  const hasAdminAccess = isSuperAdmin || isCompanyAdmin || user?.role === 'ADMIN' || user?.isAdmin;

  if (!hasAdminAccess) {
    return fallback ? <>{fallback}</> : (
      <UnauthorizedAccess 
        message="This operation requires Store Administrator privileges."
        allowedRole="ADMIN / SUPER_ADMIN"
      />
    );
  }

  return <>{children}</>;
};

export default {
  SuperAdminRoute,
  AdminRoute,
  UnauthorizedAccess
};
