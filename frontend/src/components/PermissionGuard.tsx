import React from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PermissionGuardProps {
  moduleId: string;
  moduleTitle?: string;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ moduleId, moduleTitle, children }) => {
  const { user, hasPermission, isSuperAdmin, isCompanyAdmin } = useAuth();

  // 1. ABSOLUTE ADMIN BYPASS: Company Admin and Super Admin are NEVER evaluated or blocked
  if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.isAdmin === true || isCompanyAdmin || isSuperAdmin)) {
    return <>{children}</>;
  }

  // 2. Unconditionally allow universal profile & password settings for all users
  if (moduleId === 'change-password' || moduleId === 'profile' || moduleId === 'employee-settings') {
    return <>{children}</>;
  }

  const allowed = hasPermission(moduleId);

  if (!allowed) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px',
        background: '#f8fafc'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #fecaca',
          borderRadius: '12px',
          padding: '36px 32px',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.1)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#dc2626'
          }}>
            <ShieldAlert size={34} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0' }}>
            Access Denied
          </h2>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            padding: '4px 12px',
            borderRadius: '16px',
            color: '#b91c1c',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '16px'
          }}>
            <Lock size={12} />
            Module: {moduleTitle || moduleId}
          </div>

          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            User <strong>{user?.name || user?.username}</strong> does not have authorized permissions to view or perform operations in this section. Please contact your system Administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionGuard;
