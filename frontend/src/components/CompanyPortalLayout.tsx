import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, ShoppingCart, Boxes, UserCheck, Settings as SettingsIcon,
  CreditCard, RefreshCcw, RotateCcw, MonitorSmartphone, X, FileText, Truck, Users,
  CircleDollarSign, PackageOpen, Tag, Barcode, ChevronDown, ChevronRight,
  Menu, AlignLeft, ClipboardList, Briefcase, Calculator, Archive, Building2, TrendingUp,
  Lock, LogOut, Calendar, ShieldCheck, User as UserIcon, Store
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import ProductManagement from '../pages/ProductManagement';
import InventorySettings from '../pages/InventorySettings';
import POSRegister from '../pages/POSRegister';
import InventoryControl from '../pages/InventoryControl';
import CustomerManagement from '../pages/CustomerManagement';
import AssetManagement from '../pages/AssetManagement';
import GeneralLedger from '../pages/GeneralLedger';
import CustomerDues from '../pages/CustomerDues';
import VendorDues from '../pages/VendorDues';
import CashRecovery from '../pages/CashRecovery';
import VendorPayments from '../pages/VendorPayments';
import VendorManagement from '../pages/VendorManagement';
import EmployeeManagement from '../pages/EmployeeManagement';
import PayrollDashboard from '../pages/PayrollDashboard';
import AdvanceSalary from '../pages/AdvanceSalary';
import EmployeeAttendance from '../pages/EmployeeAttendance';
import SettingsControl from '../pages/SettingsControl';
import PendingPayments from '../pages/PendingPayments';
import ReturnsAndDamages from '../pages/ReturnsAndDamages';
import PurchaseManagement from '../pages/PurchaseManagement';
import PromotionsControl from '../pages/PromotionsControl';
import BulkUpdate from '../pages/BulkUpdate';
import BarcodeStudio from '../pages/BarcodeStudio';
import EmployeeDashboard from '../pages/EmployeeDashboard';
import FormulaRecord from '../pages/FormulaRecord';
import BookingSheet from '../pages/BookingSheet';
import ReportsMaster from '../pages/ReportsMaster';
import BillLedger from '../pages/BillLedger';
import SalesReturn from '../pages/SalesReturn';
import PurchaseReturn from '../pages/PurchaseReturn';
import ReceiptCenter from '../pages/ReceiptCenter';
import ProfitLossReport from '../pages/ProfitLossReport';
import UnifiedStatement from '../pages/UnifiedStatement';
import BalanceSheet from '../pages/BalanceSheet';
import AssetsAndExpenses from '../pages/AssetsAndExpenses';
import SalesAnalysis from '../pages/SalesAnalysis';
import AdminPermissions from '../pages/AdminPermissions';
import { AdminRoute } from './RoleRoute';
import PermissionGuard from './PermissionGuard';

export type ModuleConfig = {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
};

// Main Menu Categories for Store ERP (Admins and Staff)
const MAIN_MENUS = [
  { id: 'sales', title: 'Sales', icon: <ShoppingCart size={20} /> },
  { id: 'inventory', title: 'Inventory', icon: <Package size={20} /> },
  { id: 'reports', title: 'Reports', icon: <FileText size={20} /> },
  { id: 'accounts', title: 'Accounts', icon: <CircleDollarSign size={20} /> },
  { id: 'manage', title: 'Manage', icon: <Briefcase size={20} /> }
];

// Mapping to client categories
const RIBBON_ACTIONS: Record<string, ModuleConfig[]> = {
  'sales': [
    { id: 'pos', title: 'Cash Register', icon: <MonitorSmartphone size={20} />, component: <POSRegister /> },
    { id: 'sales-return', title: 'Sales Return', icon: <RefreshCcw size={20} />, component: <SalesReturn /> },
    { id: 'bookings', title: 'Orders (Booking)', icon: <ClipboardList size={20} />, component: <BookingSheet /> },
    { id: 'promotions', title: 'Promotions', icon: <Tag size={20} />, component: <PromotionsControl /> }
  ],
  'inventory': [
    { id: 'products', title: 'Product Catalog', icon: <Package size={20} />, component: <ProductManagement /> },
    { id: 'inventory', title: 'Inventory Control', icon: <PackageOpen size={20} />, component: <InventoryControl /> },
    { id: 'inventory-settings', title: 'Inventory Settings', icon: <SettingsIcon size={20} />, component: <InventorySettings /> },
    { id: 'purchases', title: 'Purchase Management', icon: <Boxes size={20} />, component: <PurchaseManagement /> },
    { id: 'purchase-return', title: 'Purchase Return', icon: <RotateCcw size={20} />, component: <PurchaseReturn /> },
    { id: 'returns', title: 'Returns & Damages', icon: <RefreshCcw size={20} />, component: <ReturnsAndDamages /> },
    { id: 'barcode-studio', title: 'Barcode Studio', icon: <Barcode size={20} />, component: <BarcodeStudio /> },
    { id: 'bulk', title: 'Bulk Update', icon: <RefreshCcw size={20} />, component: <BulkUpdate /> },
    { id: 'formulas', title: 'Formulas', icon: <Calculator size={20} />, component: <FormulaRecord /> }
  ],
  'reports': [
    { id: 'dashboard', title: 'Dashboard', icon: <FileText size={20} />, component: <Dashboard /> },
    { id: 'sales-analysis', title: 'Sales & Profitability Analysis', icon: <TrendingUp size={20} />, component: <SalesAnalysis /> },
    { id: 'assets-expenses', title: 'Assets & Expenses Management', icon: <CircleDollarSign size={20} />, component: <AssetsAndExpenses /> },
    { id: 'balance-sheet', title: 'Balance Sheet', icon: <Building2 size={20} />, component: <BalanceSheet /> },
    { id: 'unified-statement', title: 'Unified Ledger & Profit Statement', icon: <FileText size={20} />, component: <UnifiedStatement /> },
    { id: 'profit-loss', title: 'Profit & Loss Statement', icon: <CircleDollarSign size={20} />, component: <ProfitLossReport /> },
    { id: 'reports-master', title: 'Reports & Analytics', icon: <FileText size={20} />, component: <ReportsMaster /> },
    { id: 'bill-ledger', title: 'Sales Ledger (Bill Register)', icon: <ClipboardList size={20} />, component: <BillLedger /> },
    { id: 'receipt-center', title: 'Receipt Center', icon: <FileText size={20} />, component: <ReceiptCenter /> }
  ],
  'accounts': [
    { id: 'customer-dues', title: 'Customer Dues Management', icon: <UserCheck size={20} />, component: <CustomerDues /> },
    { id: 'vendor-dues', title: 'Vendor Dues Management', icon: <Truck size={20} />, component: <VendorDues /> },
    { id: 'general-ledger', title: 'Master General Ledger', icon: <CircleDollarSign size={20} />, component: <GeneralLedger /> },
    { id: 'cash-recovery', title: 'Cash Recovery (Customers)', icon: <CreditCard size={20} />, component: <CashRecovery /> },
    { id: 'vendor-payments', title: 'Vendor Payments', icon: <CreditCard size={20} />, component: <VendorPayments /> },
    { id: 'pending-payments', title: 'Pending Payments', icon: <CreditCard size={20} />, component: <PendingPayments /> },
    { id: 'advance-salary', title: 'Advance Salary Logger', icon: <CreditCard size={20} />, component: <AdvanceSalary /> },
    { id: 'attendance', title: 'Employee Attendance', icon: <Calendar size={20} />, component: <EmployeeAttendance /> },
    { id: 'payroll', title: 'Payroll Dashboard', icon: <CircleDollarSign size={20} />, component: <PayrollDashboard /> }
  ],
  'manage': [
    { id: 'customers', title: 'Customers', icon: <UserCheck size={20} />, component: <CustomerManagement /> },
    { id: 'assets', title: 'Fixed Assets', icon: <Archive size={20} />, component: <AssetManagement /> },
    { id: 'vendors', title: 'Vendors', icon: <Truck size={20} />, component: <VendorManagement /> },
    { id: 'employees', title: 'Employee Master', icon: <Users size={20} />, component: <EmployeeManagement /> },
    { id: 'employee-portal', title: 'Employee Portal', icon: <UserCheck size={20} />, component: <EmployeeDashboard /> },
    { id: 'settings', title: 'Store Settings', icon: <SettingsIcon size={20} />, component: <SettingsControl /> }
  ]
};

export const CompanyPortalLayout: React.FC = () => {
  const { user, logout, hasPermission, isCompanyAdmin, isEmployee } = useAuth();
  const [openTabs, setOpenTabs] = useState<ModuleConfig[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>('sales');

  const isAdminUser = Boolean(
    user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.isAdmin === true || isCompanyAdmin)
  );

  // Set default tab on initial load
  useEffect(() => {
    if (user && openTabs.length === 0) {
      if (isAdminUser) {
        setOpenTabs([RIBBON_ACTIONS['reports'][0]]);
        setActiveTabId('dashboard');
        setExpandedMenuId('reports');
      } else {
        const allModules = Object.values(RIBBON_ACTIONS).flat();
        const posMod = RIBBON_ACTIONS['sales'].find(m => m.id === 'pos');
        
        if (posMod && hasPermission('pos')) {
          setOpenTabs([posMod]);
          setActiveTabId('pos');
          setExpandedMenuId('sales');
        } else {
          const firstAllowed = allModules.find(m => hasPermission(m.id));
          if (firstAllowed) {
            setOpenTabs([firstAllowed]);
            setActiveTabId(firstAllowed.id);
            const parentKey = Object.keys(RIBBON_ACTIONS).find(key => RIBBON_ACTIONS[key].find(m => m.id === firstAllowed.id));
            if (parentKey) setExpandedMenuId(parentKey);
          } else {
            setOpenTabs([]);
            setActiveTabId('');
          }
        }
      }
    }
  }, [user, isAdminUser, isCompanyAdmin, isEmployee]);

  const openModule = (mod: ModuleConfig) => {
    setOpenTabs(prev => {
      if (prev.find(t => t.id === mod.id)) {
        return prev;
      }

      let updatedTabs = [...prev];
      if (updatedTabs.length >= 6) {
        // Find the oldest open tab that is NOT the permanent "Dashboard"
        const dashboardIndex = updatedTabs.findIndex(t => t.id === 'dashboard' || t.title === 'Dashboard');
        
        // If the permanent Dashboard is the first tab, close the second tab (index 1).
        // Otherwise, close the first tab (index 0).
        const indexToRemove = dashboardIndex === 0 ? 1 : 0;
        
        // Remove the oldest tab to make room for the new one
        updatedTabs.splice(indexToRemove, 1);
      }

      return [...updatedTabs, mod];
    });
    setActiveTabId(mod.id);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== id);
    setOpenTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : '');
    }
  };

  const toggleMenu = (menuId: string) => {
    if (isSidebarCollapsed) setIsSidebarCollapsed(false);
    setExpandedMenuId(expandedMenuId === menuId ? null : menuId);
  };

  const activeComponent = openTabs.find(t => t.id === activeTabId)?.component;

  // --- Global Search Logic ---
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    const handleOpenModuleEvent = (e: any) => {
      const moduleId = e.detail;
      const mod = Object.values(RIBBON_ACTIONS).flat().find(m => m.id === moduleId);
      if (mod) {
        setOpenTabs(prev => {
          if (prev.find(t => t.id === mod.id)) return prev;

          let updatedTabs = [...prev];
          if (updatedTabs.length >= 6) {
            const dashboardIndex = updatedTabs.findIndex(t => t.id === 'dashboard' || t.title === 'Dashboard');
            const indexToRemove = dashboardIndex === 0 ? 1 : 0;
            updatedTabs.splice(indexToRemove, 1);
          }
          return [...updatedTabs, mod];
        });
        setActiveTabId(mod.id);
        const parentKey = Object.keys(RIBBON_ACTIONS).find(key => RIBBON_ACTIONS[key].find(m => m.id === mod.id));
        if (parentKey) setExpandedMenuId(parentKey);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('openModule', handleOpenModuleEvent);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('openModule', handleOpenModuleEvent);
    };
  }, []);

  const allModulesFlat = Object.values(RIBBON_ACTIONS).flat();
  const searchResults = globalSearchQuery.trim()
    ? allModulesFlat.filter(m => 
        (isAdminUser || hasPermission(m.id)) &&
        (m.title.toLowerCase().includes(globalSearchQuery.toLowerCase()) || 
        m.id.toLowerCase().includes(globalSearchQuery.toLowerCase()))
      )
    : [];

  const visibleMenus = MAIN_MENUS.filter(menu => {
    if (isAdminUser) return true;
    const actions = RIBBON_ACTIONS[menu.id] || [];
    return actions.some(action => hasPermission(action.id));
  });

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ width: isSidebarCollapsed ? '60px' : '230px', transition: 'width 0.2s ease' }}>
        
        {/* Company Header */}
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                {user?.companyName || 'Store ERP'}
              </span>
              <span style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                {isAdminUser ? 'Company Administrator' : 'Staff Terminal'}
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            title="Toggle Sidebar"
          >
            {isSidebarCollapsed ? <Menu size={16} /> : <AlignLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Navigation Accordion */}
        <div className="sidebar-menu" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {visibleMenus.map(menu => (
            <div key={menu.id} className="sidebar-section">
              <div 
                className={`sidebar-item ${expandedMenuId === menu.id ? 'active' : ''}`}
                onClick={() => toggleMenu(menu.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: expandedMenuId === menu.id ? '#ffffff' : '#94a3b8',
                  background: expandedMenuId === menu.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  borderLeft: expandedMenuId === menu.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', marginRight: isSidebarCollapsed ? '0' : '10px' }}>
                  {menu.icon}
                </span>
                {!isSidebarCollapsed && (
                  <>
                    <span style={{ flex: 1, fontWeight: expandedMenuId === menu.id ? 700 : 500 }}>{menu.title}</span>
                    {expandedMenuId === menu.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </>
                )}
              </div>

              {/* Accordion Content */}
              {!isSidebarCollapsed && expandedMenuId === menu.id && (
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 0' }}>
                  {(RIBBON_ACTIONS[menu.id] || [])
                    .filter(action => isAdminUser || hasPermission(action.id))
                    .map(action => {
                    const isActive = activeTabId === action.id;
                    const isPermitted = isAdminUser ? true : hasPermission(action.id);
                    return (
                      <div 
                        key={action.id} 
                        onClick={() => openModule(action)}
                        style={{
                          padding: '6px 12px 6px 24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          color: isActive ? 'var(--sidebar-active-text)' : isPermitted ? '#94a3b8' : '#64748b',
                          background: isActive ? 'var(--sidebar-active)' : 'transparent',
                          opacity: isPermitted ? 1 : 0.75,
                          transition: 'all 0.15s ease',
                          fontSize: '11px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{ display: 'inline-flex', transform: 'scale(0.75)', opacity: isActive ? 1 : 0.7 }}>{action.icon}</span>
                          <span style={{ fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{action.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="workspace-container">
        
        {/* Top Header */}
        <div className="top-header">
          <div className="header-search" style={{ position: 'relative' }}>
            <span style={{ color: '#94a3b8' }}>🔍</span>
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Global search... (Ctrl+K)" 
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />
            {/* Search Dropdown */}
            {isSearchFocused && globalSearchQuery.trim() && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                marginTop: '4px',
                zIndex: 50,
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {searchResults.length > 0 ? (
                  searchResults.map(mod => (
                    <div 
                      key={mod.id}
                      style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b', fontWeight: 500 }}
                      onClick={() => {
                        openModule(mod);
                        setGlobalSearchQuery('');
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: '#64748b' }}>{mod.icon}</span>
                      {mod.title}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>No modules found.</div>
                )}
              </div>
            )}
          </div>
          
          <div className="header-user-info" style={{ fontSize: '11px', gap: '10px' }}>
            <div className="badge" style={{ padding: '2px 6px', fontSize: '10px' }}>
              {user?.companyName || 'Corporate Store'}
            </div>
            <div>Shift: Active</div>
            <div style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1e293b', fontSize: '10px' }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{user?.name}</span>
              <button 
                onClick={logout}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#ef4444', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '2px', 
                  marginLeft: '8px' 
                }}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        {openTabs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '4px 12px 0 12px' }}>
            <div style={{ display: 'flex', gap: '3px', overflowX: 'auto', flex: 1 }}>
              {openTabs.map(tab => (
                <div 
                  key={tab.id} 
                  style={{
                    padding: '4px 8px',
                    background: activeTabId === tab.id ? '#ffffff' : 'transparent',
                    border: '1px solid #e2e8f0',
                    borderBottom: activeTabId === tab.id ? '1px solid #ffffff' : '1px solid #e2e8f0',
                    marginBottom: '-1px',
                    borderTopLeftRadius: '3px',
                    borderTopRightRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: activeTabId === tab.id ? 700 : 500,
                    color: activeTabId === tab.id ? '#0f172a' : '#64748b',
                    borderTop: activeTabId === tab.id ? '2px solid var(--accent-primary)' : '1px solid transparent',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.title}
                  <button 
                    onClick={(e) => closeTab(e, tab.id)}
                    style={{ background: 'transparent', border: 'none', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setOpenTabs([]);
                setActiveTabId('');
              }}
              style={{
                marginLeft: '12px',
                marginBottom: '4px',
                padding: '2px 8px',
                fontSize: '10px',
                fontWeight: 700,
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '20px'
              }}
            >
              Close All
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="main-content">
          {activeComponent ? (
            <PermissionGuard 
              moduleId={activeTabId} 
              moduleTitle={openTabs.find(t => t.id === activeTabId)?.title}
            >
              {activeComponent}
            </PermissionGuard>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px', textAlign: 'center' }}>
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '40px 32px',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#0284c7'
                }}>
                  <Store size={30} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                  {isAdminUser ? 'Select a Module to Begin' : 'Staff Terminal Active'}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                  {isAdminUser 
                    ? 'Use the sidebar on the left or press Ctrl+K to open any store management module.'
                    : (user?.permissions && user.permissions.length > 0)
                      ? 'Select an authorized operational module from the sidebar on the left.'
                      : 'No operational modules have been assigned to your staff account yet. Please ask your Company Administrator to grant permissions in the Employee Master matrix.'}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CompanyPortalLayout;
