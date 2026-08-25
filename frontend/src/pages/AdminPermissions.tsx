import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Users, Check, X, Save, Search, 
  UserCheck, AlertTriangle, RefreshCw, Key, Lock, CheckSquare, Square
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ModuleDef {
  key: string;
  name: string;
  category: string;
  description: string;
}

const MODULE_DEFINITIONS: ModuleDef[] = [
  // Sales
  { key: 'pos', name: 'Cash Register (POS)', category: 'Sales', description: 'Access to POS checkout register, daily cash sales, and barcode scanning' },
  { key: 'sales', name: 'Sales Invoicing & Orders', category: 'Sales', description: 'Comprehensive access to sales registers, order bookings, and invoices' },
  { key: 'bookings', name: 'Order Booking Sheet', category: 'Sales', description: 'Order taker booking sheet entry, salesman orders, and draft bills' },
  { key: 'sales-return', name: 'Sales Returns', category: 'Sales', description: 'Process customer returns, issue refunds, and adjust sales ledgers' },
  { key: 'promotions', name: 'Promotions & Discounts', category: 'Sales', description: 'Configure promo rules, tiered pricing, and seasonal campaign discounts' },

  // Inventory
  { key: 'products', name: 'Product Catalog', category: 'Inventory', description: 'Product setup, price configuration, barcode generation, and variants' },
  { key: 'inventory', name: 'Inventory Control', category: 'Inventory', description: 'Live warehouse stock levels, min-reorder alerts, and physical counts' },
  { key: 'purchases', name: 'Purchase Management', category: 'Inventory', description: 'Receive vendor stock, log purchase invoices, and vendor bill tracking' },
  { key: 'purchase-return', name: 'Purchase Returns', category: 'Inventory', description: 'Process stock returns to vendors and debit note generation' },
  { key: 'returns', name: 'Damages & Wastage', category: 'Inventory', description: 'Track damaged items, quarantine loss adjustments, and write-offs' },
  { key: 'barcode-studio', name: 'Barcode Studio', category: 'Inventory', description: 'Design, generate, and batch print barcode product labels' },
  { key: 'bulk', name: 'Bulk Price & Stock Update', category: 'Inventory', description: 'Mass update inventory prices, cost margins, and warehouse counts' },
  { key: 'formulas', name: 'Formulas & Production', category: 'Inventory', description: 'Bill of materials, recipe assembly, and manufacturing formulas' },

  // Reports
  { key: 'dashboard', name: 'Executive Dashboard', category: 'Reports', description: 'KPI summaries, daily revenue cards, and top-selling product widgets' },
  { key: 'sales-analysis', name: 'Sales & Profit Analysis', category: 'Reports', description: 'Deep-dive sales analytics, margin breakdowns, and profit KPIs' },
  { key: 'balance-sheet', name: 'Balance Sheet Audit', category: 'Reports', description: 'Financial balance sheet, net assets, liabilities, and audit reports' },
  { key: 'unified-statement', name: 'Unified Ledger & Profit Statement', category: 'Reports', description: 'Cross-entity consolidated accounts and profit reconciliations' },
  { key: 'profit-loss', name: 'Profit & Loss Statement', category: 'Reports', description: 'Detailed net income, gross margin, and business expenditure report' },
  { key: 'reports-master', name: 'Reports & Analytics Master', category: 'Reports', description: 'Full reporting center for sales, purchase, payroll, and stock digests' },
  { key: 'bill-ledger', name: 'Sales Ledger (Bill Register)', category: 'Reports', description: 'Chronological sales register and historical invoice audit trail' },
  { key: 'receipt-center', name: 'Receipt Center', category: 'Reports', description: 'Search, reprint, and audit historical customer cash receipts' },

  // Accounts
  { key: 'customer-dues', name: 'Customer Dues Management', category: 'Accounts', description: 'Manage accounts receivable and recovery balances from customers' },
  { key: 'vendor-dues', name: 'Vendor Dues Management', category: 'Accounts', description: 'Track accounts payable balances and outstanding vendor bills' },
  { key: 'general-ledger', name: 'Master General Ledger', category: 'Accounts', description: 'Double-entry journal posting, chart of accounts, and financial ledgers' },
  { key: 'cash-recovery', name: 'Cash Recovery (Customers)', category: 'Accounts', description: 'Collect customer recoveries, ledger installments, and credit settlements' },
  { key: 'vendor-payments', name: 'Vendor Payments', category: 'Accounts', description: 'Log outbound bank/cash vendor payments and settle supplier bills' },
  { key: 'pending-payments', name: 'Pending Payments', category: 'Accounts', description: 'Schedule, review, and authorize pending supplier disbursements' },
  { key: 'advance-salary', name: 'Advance Salary Logger', category: 'Accounts', description: 'Record employee salary loans and track payroll deduction recovery' },
  { key: 'attendance', name: 'Employee Attendance', category: 'Accounts', description: 'Daily clock-in/clock-out tracking, shifts, and biometric log audit' },
  { key: 'payroll', name: 'Payroll & Salary Disbursal', category: 'Accounts', description: 'Generate monthly payroll, calculate allowances, and print pay slips' },
  { key: 'assets-expenses', name: 'Assets & Expenses Hub', category: 'Accounts', description: 'Fixed assets register and operational expense tracking' },

  // Management
  { key: 'customers', name: 'Customer Master', category: 'Manage', description: 'Register customers, assign credit limits, and delivery locations' },
  { key: 'vendors', name: 'Vendor Master', category: 'Manage', description: 'Register suppliers, contact details, and payment credit terms' },
  { key: 'employees', name: 'Employee Master', category: 'Manage', description: 'Staff directory, designations, departments, and basic wage rates' },
  { key: 'employee-portal', name: 'Employee Self-Service Portal', category: 'Manage', description: 'Employee personal dashboard, salary slips, and attendance history' },
  { key: 'change-password', name: 'Change Credentials', category: 'Manage', description: 'Staff password management and security credential updates' },
  { key: 'settings', name: 'Store Settings', category: 'Manage', description: 'Invoice templates, tax percentages, currency symbol, and company branding' }
];

interface EmployeeItem {
  id: number;
  name: string;
  username: string;
  phone?: string;
  isAdmin: boolean;
  postRec?: { id: number; title: string };
  permissions?: Array<{ id: number; pageRoute: string; isAllowed: boolean }>;
}

const AdminPermissions: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  const [selectedIsAdmin, setSelectedIsAdmin] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.username === 'admin';

  useEffect(() => {
    if (isAdmin && token) {
      fetchEmployees();
    }
  }, [isAdmin, token]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/permissions/employees', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data: EmployeeItem[] = await res.json();
        setEmployees(data);
        if (data.length > 0 && selectedEmployeeId === null) {
          selectEmployee(data[0]);
        }
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to load employee list.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Error connecting to permissions server.' });
    } finally {
      setLoading(false);
    }
  };

  const selectEmployee = (emp: EmployeeItem) => {
    setSelectedEmployeeId(emp.id);
    setSelectedIsAdmin(emp.isAdmin);
    setStatusMessage(null);

    const permsMap: Record<string, boolean> = {};
    // Initialize default false for all standard modules
    MODULE_DEFINITIONS.forEach(m => {
      permsMap[m.key] = false;
    });

    if (emp.permissions && Array.isArray(emp.permissions)) {
      emp.permissions.forEach(p => {
        permsMap[p.pageRoute] = p.isAllowed;
      });
    }

    // If already marked as admin, enable all by default
    if (emp.isAdmin) {
      MODULE_DEFINITIONS.forEach(m => {
        permsMap[m.key] = true;
      });
    }

    setSelectedPermissions(permsMap);
  };

  const handleTogglePermission = (key: string) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectAll = (allowed: boolean) => {
    const updated: Record<string, boolean> = {};
    MODULE_DEFINITIONS.forEach(m => {
      updated[m.key] = allowed;
    });
    setSelectedPermissions(updated);
  };

  const handleSavePermissions = async () => {
    if (!selectedEmployeeId || !token) return;

    setSaving(true);
    setStatusMessage(null);

    const permissionsPayload = Object.entries(selectedPermissions).map(([pageRoute, isAllowed]) => ({
      pageRoute,
      isAllowed
    }));

    try {
      const res = await fetch(`/api/permissions/employee/${selectedEmployeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isAdmin: selectedIsAdmin,
          permissions: permissionsPayload
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Permissions successfully updated and saved to database!' });
        // Refresh local state list
        setEmployees(prev => prev.map(e => {
          if (e.id === selectedEmployeeId) {
            return {
              ...e,
              isAdmin: selectedIsAdmin,
              permissions: permissionsPayload.map((p, idx) => ({ id: idx, ...p }))
            };
          }
          return e;
        }));
        await refreshUser();
      } else {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save permissions.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Error communicating with server.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '12px', 
          padding: '32px', 
          maxWidth: '500px', 
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <ShieldAlert size={54} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', marginBottom: '8px' }}>Access Denied</h2>
          <p style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
            The Permissions Panel is restricted exclusively to system Administrators. Please contact your manager if you require access.
          </p>
        </div>
      </div>
    );
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (e.username && e.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.postRec?.title && e.postRec.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      
      {/* Top Header */}
      <div style={{ 
        background: '#ffffff', 
        padding: '16px 24px', 
        borderBottom: '1px solid #e2e8f0', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
            width: '38px', 
            height: '38px', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Admin Permission Control Panel
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Configure role-based access rights and security boundaries for employee accounts
            </p>
          </div>
        </div>

        <button 
          onClick={fetchEmployees} 
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#475569',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh List
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px', gap: '16px' }}>
        
        {/* Left Column: Employee List */}
        <div style={{ 
          width: '320px', 
          background: '#ffffff', 
          borderRadius: '10px', 
          border: '1px solid #e2e8f0', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {/* Search Box */}
          <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input 
                type="text" 
                placeholder="Search employees..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* List Header */}
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Employees ({filteredEmployees.length})
          </div>

          {/* Scrollable List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {filteredEmployees.map(emp => {
              const isSelected = emp.id === selectedEmployeeId;
              const isEmpAdmin = emp.isAdmin || emp.username === 'admin';
              return (
                <div 
                  key={emp.id}
                  onClick={() => selectEmployee(emp)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '50%', 
                        background: isSelected ? '#3b82f6' : '#e2e8f0', 
                        color: isSelected ? '#ffffff' : '#475569',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        {emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#1e3a8a' : '#1e293b' }}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          @{emp.username || 'no-login'} • {emp.postRec?.title || 'Staff'}
                        </div>
                      </div>
                    </div>

                    {isEmpAdmin ? (
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        color: '#7c3aed', 
                        background: '#ede9fe', 
                        padding: '2px 6px', 
                        borderRadius: '4px' 
                      }}>
                        ADMIN
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: 600, 
                        color: '#0284c7', 
                        background: '#e0f2fe', 
                        padding: '2px 6px', 
                        borderRadius: '4px' 
                      }}>
                        STAFF
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No employees matching search.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Permission Matrix for Selected Employee */}
        <div style={{ 
          flex: 1, 
          background: '#ffffff', 
          borderRadius: '10px', 
          border: '1px solid #e2e8f0', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          {selectedEmployee ? (
            <>
              {/* Header Info of Selected User */}
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid #e2e8f0', 
                background: '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {selectedEmployee.name}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      (Username: <strong>{selectedEmployee.username || 'None'}</strong>)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    Designation: <strong>{selectedEmployee.postRec?.title || 'General Staff'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Administrator Toggle */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: selectedEmployee.username === 'admin' ? 'not-allowed' : 'pointer',
                    background: selectedIsAdmin ? '#ede9fe' : '#f1f5f9',
                    border: selectedIsAdmin ? '1px solid #c4b5fd' : '1px solid #cbd5e1',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: selectedIsAdmin ? '#6d28d9' : '#475569'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIsAdmin} 
                      disabled={selectedEmployee.username === 'admin'}
                      onChange={e => {
                        setSelectedIsAdmin(e.target.checked);
                        if (e.target.checked) {
                          handleSelectAll(true);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <Key size={14} />
                    Super Administrator Role
                  </label>
                </div>
              </div>

              {/* Status Message Banner */}
              {statusMessage && (
                <div style={{ 
                  padding: '10px 20px', 
                  fontSize: '12px', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: statusMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  color: statusMessage.type === 'success' ? '#065f46' : '#991b1b',
                  borderBottom: `1px solid ${statusMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`
                }}>
                  {statusMessage.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                  {statusMessage.text}
                </div>
              )}

              {/* Action Toolbar */}
              <div style={{ 
                padding: '10px 20px', 
                borderBottom: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#ffffff'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleSelectAll(true)}
                    disabled={selectedIsAdmin}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#2563eb',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => handleSelectAll(false)}
                    disabled={selectedIsAdmin}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Allowed Modules:{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {selectedIsAdmin 
                      ? MODULE_DEFINITIONS.length 
                      : Object.values(selectedPermissions).filter(Boolean).length} / {MODULE_DEFINITIONS.length}
                  </strong>
                </div>
              </div>

              {/* Permission Checkboxes Grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {selectedIsAdmin && (
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    background: '#f5f3ff', 
                    borderRadius: '8px', 
                    border: '1px solid #ddd6fe',
                    color: '#5b21b6',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Lock size={16} />
                    This user is assigned the <strong>Administrator</strong> role and has full, unrestricted access to all software modules.
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {MODULE_DEFINITIONS.map(module => {
                    const isChecked = selectedIsAdmin || Boolean(selectedPermissions[module.key]);
                    return (
                      <div 
                        key={module.key}
                        onClick={() => {
                          if (!selectedIsAdmin) {
                            handleTogglePermission(module.key);
                          }
                        }}
                        style={{
                          padding: '14px',
                          borderRadius: '8px',
                          border: isChecked ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
                          background: isChecked ? '#f0f7ff' : '#ffffff',
                          cursor: selectedIsAdmin ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ marginTop: '2px', color: isChecked ? '#2563eb' : '#94a3b8' }}>
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: isChecked ? '#1e3a8a' : '#1e293b' }}>
                              {module.name}
                            </span>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: 600, 
                              color: '#64748b', 
                              background: '#f1f5f9', 
                              padding: '2px 6px', 
                              borderRadius: '4px' 
                            }}>
                              {module.category}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                            {module.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Footer Save Button */}
              <div style={{ 
                padding: '16px 20px', 
                borderTop: '1px solid #e2e8f0', 
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button 
                  onClick={handleSavePermissions}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                  }}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
              Select an employee from the left column to view and modify permissions.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminPermissions;
