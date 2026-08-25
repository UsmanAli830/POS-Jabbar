import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, Key, Lock, Unlock, Calendar, UserPlus, 
  Search, RefreshCw, AlertCircle, CheckCircle2, Phone, Mail, MapPin, 
  User, Clock, ChevronRight, Edit3, X, Sparkles, Filter, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';


interface CompanyRecord {
  id: number;
  name: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
  adminUser?: {
    id: number;
    name: string;
    username: string;
    phone?: string;
    joiningDate?: string;
  } | null;
  employeeCount: number;
  license?: {
    id?: number;
    issuedAt?: string;
    expiresAt?: string;
    isLocked: boolean;
    isExpired: boolean;
    effectiveLocked: boolean;
    daysRemaining: number;
  } | null;
}

const SuperAdminDashboard: React.FC = () => {
  const { token, logout } = useAuth();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED' | 'EXPIRED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [resettingAdmin, setResettingAdmin] = useState<{ id: number; name: string; username: string } | null>(null);

  // Form State for Add / Edit
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Reset Credentials Form
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [resetModalError, setResetModalError] = useState('');

  // Super Admin Password Change Form
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentMasterPassword, setCurrentMasterPassword] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [passwordModalError, setPasswordModalError] = useState('');

  const handleChangeMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordModalError('');
    if (!currentMasterPassword || !newMasterPassword) {
      setPasswordModalError('Both current and new password are required.');
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      setPasswordModalError('New password and confirmation password do not match.');
      return;
    }
    if (newMasterPassword.length < 6) {
      setPasswordModalError('New password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/super-admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: currentMasterPassword,
          newPassword: newMasterPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      showNotification('✓ Super Admin password updated successfully!');
      setShowPasswordModal(false);
      setCurrentMasterPassword('');
      setNewMasterPassword('');
      setConfirmMasterPassword('');
    } catch (err: any) {
      setPasswordModalError(err.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchCompanies = async () => {
    setIsLoading(true);
    setActionError('');
    try {
      const res = await fetch('/api/super-admin/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch companies');
      }
      const data = await res.json();
      setCompanies(data);
    } catch (err: any) {
      setActionError(err.message || 'Could not load company directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setActionError(msg);
      setActionSuccess('');
    } else {
      setActionSuccess(msg);
      setActionError('');
    }
    setTimeout(() => {
      setActionSuccess('');
      setActionError('');
    }, 4500);
  };

  const openAddModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    setCompanyName('');
    setAddress('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAdminName('');
    setAdminUsername('');
    setAdminPassword('');
    setStartDate(today);
    setExpiresAt(oneYearLater);
    setIsLocked(false);
    setEditingCompany(null);
    setModalError('');
    setShowAddModal(true);
  };

  const openEditModal = (comp: CompanyRecord) => {
    const start = comp.license?.issuedAt ? comp.license.issuedAt.split('T')[0] : new Date().toISOString().split('T')[0];
    const end = comp.license?.expiresAt ? comp.license.expiresAt.split('T')[0] : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setCompanyName(comp.name || '');
    setAddress(comp.address || '');
    setContactPerson(comp.contactPerson || '');
    setPhone(comp.phone || '');
    setEmail(comp.email || '');
    setStartDate(start);
    setExpiresAt(end);
    setIsLocked(comp.license?.isLocked || false);
    setEditingCompany(comp);
    setModalError('');
    setShowAddModal(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!companyName.trim()) {
      setModalError('Company Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCompany) {
        // Update Existing Company
        const res = await fetch(`/api/super-admin/companies/${editingCompany.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            companyName: companyName.trim(),
            address: address.trim(),
            contactPerson: contactPerson.trim(),
            phone: phone.trim(),
            email: email.trim(),
            startDate,
            expiresAt,
            isLocked
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update company');
        showNotification(`✓ Company "${companyName}" updated successfully!`);
      } else {
        // Create New Company
        if (!adminUsername.trim() || !adminPassword.trim()) {
          throw new Error('Admin username and password are required when creating a new company.');
        }
        const res = await fetch('/api/super-admin/companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            companyName: companyName.trim(),
            address: address.trim(),
            contactPerson: contactPerson.trim(),
            phone: phone.trim(),
            email: email.trim(),
            adminName: adminName.trim() || `${companyName.trim()} Admin`,
            adminUsername: adminUsername.trim(),
            adminPassword: adminPassword.trim(),
            startDate,
            expiresAt
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create company tenant');
        showNotification(`✓ Company Tenant "${companyName}" created with Admin @${adminUsername.trim()}!`);
      }

      setShowAddModal(false);
      fetchCompanies();
    } catch (err: any) {
      setModalError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLock = async (companyId: number, currentLocked: boolean) => {
    try {
      const res = await fetch(`/api/super-admin/toggle-lock/${companyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isLocked: !currentLocked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle lock');
      showNotification(`✓ Company access ${!currentLocked ? 'LOCKED' : 'UNLOCKED'} successfully!`);
      fetchCompanies();
    } catch (err: any) {
      showNotification(err.message || 'Failed to toggle lock', true);
    }
  };

  const handleResetAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetModalError('');
    if (!resettingAdmin) return;
    if (!newAdminUsername.trim() && !newAdminPassword.trim()) {
      setResetModalError('Enter a new username or password to update.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/admin-credentials/${resettingAdmin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newAdminUsername.trim() || undefined,
          password: newAdminPassword.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset credentials');
      showNotification(`✓ Credentials updated for Admin @${data.admin?.username || resettingAdmin.username}!`);
      setResettingAdmin(null);
      setNewAdminUsername('');
      setNewAdminPassword('');
      fetchCompanies();
    } catch (err: any) {
      setResetModalError(err.message || 'Failed to reset credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPresetDuration = (days: number) => {
    const start = startDate ? new Date(startDate) : new Date();
    const target = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setExpiresAt(target.toISOString().split('T')[0]);
  };

  // Metrics
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => !c.license?.effectiveLocked).length;
  const lockedOrExpired = companies.filter(c => c.license?.effectiveLocked).length;

  const filteredCompanies = companies.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.adminUser && c.adminUser.username.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') return !c.license?.effectiveLocked;
    if (statusFilter === 'LOCKED') return c.license?.isLocked;
    if (statusFilter === 'EXPIRED') return c.license?.isExpired;
    return true;
  });

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      width: '100%',
      overflowY: 'auto',
      background: '#0f172a',
      color: '#f8fafc',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      padding: '20px 24px 80px 24px',
      boxSizing: 'border-box'
    }}>
      
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '18px 24px',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Supplier Master Console
              </h1>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                TIER 1 MASTER
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Company Directory, Client Tenancy & Subscription Licensing Management
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              setPasswordModalError('');
              setCurrentMasterPassword('');
              setNewMasterPassword('');
              setConfirmMasterPassword('');
              setShowPasswordModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Key size={14} color="#f59e0b" />
            Change Master Password
          </button>

          <button
            onClick={fetchCompanies}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={openAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
            }}
          >
            <UserPlus size={16} />
            + New Company Tenant
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div style={{
          background: 'rgba(22, 163, 74, 0.15)',
          border: '1px solid rgba(22, 163, 74, 0.4)',
          color: '#86efac',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
            Total Client Companies
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8' }}>
            {totalCompanies}
          </div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
            Active Subscriptions
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#4ade80' }}>
            {activeCompanies}
          </div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
            Expired / Force Locked
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: lockedOrExpired > 0 ? '#f87171' : '#94a3b8' }}>
            {lockedOrExpired}
          </div>
        </div>
      </div>

      {/* Directory Controls Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search company, contact, or admin..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(['ALL', 'ACTIVE', 'LOCKED', 'EXPIRED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                background: statusFilter === tab ? '#0284c7' : 'rgba(30, 41, 59, 0.6)',
                color: statusFilter === tab ? '#ffffff' : '#94a3b8',
                border: '1px solid',
                borderColor: statusFilter === tab ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Company Directory Table */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid #334155', color: '#94a3b8', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px' }}>COMPANY NAME</th>
                <th style={{ padding: '12px 16px' }}>CONTACT PERSON</th>
                <th style={{ padding: '12px 16px' }}>PHONE & EMAIL</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px' }}>SUBSCRIPTION PERIOD</th>
                <th style={{ padding: '12px 16px' }}>ADMIN USERNAME</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    {isLoading ? 'Loading directory...' : 'No companies found matching your filter.'}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(comp => {
                  const lic = comp.license;
                  const isLocked = lic?.effectiveLocked || false;
                  const isExpired = lic?.isExpired || false;

                  return (
                    <tr 
                      key={comp.id}
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Company Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '13px' }}>{comp.name}</div>
                        {comp.address && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                            <MapPin size={11} /> {comp.address}
                          </div>
                        )}
                      </td>

                      {/* Contact Person */}
                      <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                        <div style={{ fontWeight: 600 }}>{comp.contactPerson || '—'}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Staff: {comp.employeeCount} accounts</div>
                      </td>

                      {/* Phone & Email */}
                      <td style={{ padding: '14px 16px' }}>
                        {comp.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontWeight: 600 }}>
                            <Phone size={11} /> {comp.phone}
                          </div>
                        ) : <span style={{ color: '#64748b' }}>—</span>}
                        {comp.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                            <Mail size={11} /> {comp.email}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {lic?.isLocked ? (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#f87171',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Lock size={10} /> FORCE LOCKED
                          </span>
                        ) : isExpired ? (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#fbbf24',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: 800
                          }}>
                            EXPIRED
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            color: '#4ade80',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={10} /> ACTIVE ({lic?.daysRemaining}d left)
                          </span>
                        )}
                      </td>

                      {/* Subscription Period */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '11px' }}>
                          {lic?.issuedAt ? new Date(lic.issuedAt).toLocaleDateString() : '—'} →{' '}
                          <strong style={{ color: isExpired ? '#f87171' : '#38bdf8' }}>
                            {lic?.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : '—'}
                          </strong>
                        </div>
                      </td>

                      {/* Admin Username */}
                      <td style={{ padding: '14px 16px' }}>
                        {comp.adminUser ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px 8px', borderRadius: '6px', border: '1px solid #334155' }}>
                            <User size={12} color="#38bdf8" />
                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>@{comp.adminUser.username}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>No Admin</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          
                          {/* Toggle Lock Switch */}
                          <button
                            onClick={() => handleToggleLock(comp.id, lic?.isLocked || false)}
                            title={lic?.isLocked ? 'Unlock Company Access' : 'Force Lock Company Access'}
                            style={{
                              background: lic?.isLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              border: `1px solid ${lic?.isLocked ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                              color: lic?.isLocked ? '#4ade80' : '#f87171',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            {lic?.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                            {lic?.isLocked ? 'Unlock' : 'Lock'}
                          </button>

                          {/* Reset Admin Password */}
                          {comp.adminUser && (
                            <button
                              onClick={() => {
                                setResettingAdmin(comp.adminUser!);
                                setNewAdminUsername(comp.adminUser!.username);
                                setNewAdminPassword('');
                              }}
                              title="Reset Company Admin Credentials"
                              style={{
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38bdf8',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              <Key size={13} /> Reset Pass
                            </button>
                          )}

                          {/* Edit Details */}
                          <button
                            onClick={() => openEditModal(comp)}
                            title="Edit Company Details & Duration"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              color: '#cbd5e1',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL 1: ADD / EDIT COMPANY & SUBSCRIPTION ================= */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={22} color="#38bdf8" />
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  {editingCompany ? `Edit Company: ${editingCompany.name}` : 'Provision New Company Tenant'}
                </h2>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                <AlertCircle size={16} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCompany} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* SECTION: COMPANY DETAILS */}
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Company Profile
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Company / Store Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Metro Mart Wholesale"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    placeholder="e.g. John Doe"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. info@metromart.com"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. Main Boulevard, Lahore"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* SECTION: SUBSCRIPTION DURATION */}
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>
                2. Subscription Duration
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    From Date (Start) *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    To Date (Expiration) *
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Quick Duration Buttons */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>Quick Presets:</span>
                {[
                  { label: '+30 Days', days: 30 },
                  { label: '+90 Days', days: 90 },
                  { label: '+1 Year', days: 365 },
                  { label: '+2 Years', days: 730 }
                ].map(p => (
                  <button
                    type="button"
                    key={p.days}
                    onClick={() => applyPresetDuration(p.days)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* SECTION: ADMIN CREDENTIALS (NEW ONLY) */}
              {!editingCompany && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>
                    3. Store Admin Credentials
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                        Admin Username *
                      </label>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                        placeholder="e.g. metro_admin"
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '12px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                        Initial Password *
                      </label>
                      <input
                        type="text"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        placeholder="e.g. StoreAdmin2026!"
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '12px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* SECTION: ACCESS CONTROL TOGGLE */}
              {editingCompany && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
                      Access Control Switch
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Instantly block or allow all users of this company
                    </div>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isLocked}
                      onChange={e => setIsLocked(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isLocked ? '#f87171' : '#4ade80' }}>
                      {isLocked ? 'LOCKED' : 'UNLOCKED'}
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  {isSubmitting ? 'Saving...' : editingCompany ? 'Update Company' : 'Provision Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: RESET ADMIN CREDENTIALS ================= */}
      {resettingAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={20} color="#38bdf8" />
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Reset Admin Credentials
                </h2>
              </div>
              <button 
                onClick={() => setResettingAdmin(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Reset username and master password for <strong>{resettingAdmin.name}</strong> (@{resettingAdmin.username}).
            </p>

            {resetModalError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                <AlertCircle size={16} />
                <span>{resetModalError}</span>
              </div>
            )}

            <form onSubmit={handleResetAdminCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Admin Username
                </label>
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={e => setNewAdminUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  New Password
                </label>
                <input
                  type="text"
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setResettingAdmin(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Updating...' : 'Save New Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Master Password Change Modal */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Key size={20} color="#f59e0b" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                    Change Master Password
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    Update your primary Developer/Super Admin password
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {passwordModalError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                {passwordModalError}
              </div>
            )}

            <form onSubmit={handleChangeMasterPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Current Master Password
                </label>
                <input
                  type="password"
                  value={currentMasterPassword}
                  onChange={e => setCurrentMasterPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  New Master Password
                </label>
                <input
                  type="password"
                  value={newMasterPassword}
                  onChange={e => setNewMasterPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Confirm New Master Password
                </label>
                <input
                  type="password"
                  value={confirmMasterPassword}
                  onChange={e => setConfirmMasterPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuperAdminDashboard;

