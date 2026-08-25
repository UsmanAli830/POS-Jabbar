import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, UserCheck, Trash2, Edit3, Eye, X, Check, Users, Settings, 
  Printer, ShieldCheck, Lock, Unlock, Key, CheckSquare, Square, RefreshCw, 
  AlertCircle, ShoppingCart, Package, BarChart3, Landmark, Briefcase, Search, CheckCircle2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

interface ERPModuleItem {
  key: string;
  name: string;
  category: 'Sales' | 'Inventory' | 'Reports' | 'Accounts' | 'Manage';
  description: string;
}

const ERP_MODULES: ERPModuleItem[] = [
  // 1. Sales Department
  { key: 'pos', name: 'Cash Register (POS)', category: 'Sales', description: 'POS checkout register, daily cash sales, and barcode scanning' },
  { key: 'sales', name: 'Sales Invoicing & Orders', category: 'Sales', description: 'Sales registers, order invoices, and draft customer bills' },
  { key: 'bookings', name: 'Order Booking Sheet', category: 'Sales', description: 'Order taker booking sheet and field sales orders' },
  { key: 'sales-return', name: 'Sales Returns', category: 'Sales', description: 'Process customer returns and ledger credit adjustments' },
  { key: 'promotions', name: 'Promotions & Discounts', category: 'Sales', description: 'Configure campaign promo discounts and promotional schemes' },

  // 2. Inventory Department
  { key: 'products', name: 'Product Catalog', category: 'Inventory', description: 'Product setup, variants, price matrices, and barcodes' },
  { key: 'inventory', name: 'Inventory Control', category: 'Inventory', description: 'Live warehouse stock levels, min-reorders, and physical counts' },
  { key: 'purchases', name: 'Purchase Management', category: 'Inventory', description: 'Receive vendor stock, log purchase bills, and vendor invoices' },
  { key: 'purchase-return', name: 'Purchase Returns', category: 'Inventory', description: 'Process supplier debit notes and return stock to vendors' },
  { key: 'returns', name: 'Damages & Wastage', category: 'Inventory', description: 'Track damaged items, quarantine loss, and write-offs' },
  { key: 'barcode-studio', name: 'Barcode Studio', category: 'Inventory', description: 'Design, generate, and batch print barcode product labels' },
  { key: 'bulk', name: 'Bulk Price & Stock Update', category: 'Inventory', description: 'Mass update inventory prices and warehouse counts' },
  { key: 'formulas', name: 'Formulas & Production', category: 'Inventory', description: 'Bill of materials, recipe assembly, and manufacturing formulas' },

  // 3. Reports & Analytics Department
  { key: 'dashboard', name: 'Executive Dashboard', category: 'Reports', description: 'KPI summaries, daily revenue cards, and top-selling widgets' },
  { key: 'sales-analysis', name: 'Sales & Profit Analysis', category: 'Reports', description: 'Detailed sales analytics, profit KPIs, and margin breakdowns' },
  { key: 'balance-sheet', name: 'Balance Sheet Audit', category: 'Reports', description: 'Financial balance sheet, net assets, and liabilities audit' },
  { key: 'unified-statement', name: 'Unified Ledger Statement', category: 'Reports', description: 'Cross-entity consolidated accounts and profit reconciliations' },
  { key: 'profit-loss', name: 'Profit & Loss Statement', category: 'Reports', description: 'Detailed net income, gross margin, and expenditure report' },
  { key: 'reports-master', name: 'Reports Center', category: 'Reports', description: 'Full reporting center for sales, purchase, payroll, and stock digests' },
  { key: 'bill-ledger', name: 'Sales Ledger (Bill Register)', category: 'Reports', description: 'Chronological sales register and historical invoice audit' },
  { key: 'receipt-center', name: 'Receipt Center', category: 'Reports', description: 'Search, reprint, and audit customer cash receipts' },

  // 4. Accounts & Finance Department
  { key: 'customer-dues', name: 'Customer Dues Management', category: 'Accounts', description: 'Manage accounts receivable and customer recovery balances' },
  { key: 'vendor-dues', name: 'Vendor Dues Management', category: 'Accounts', description: 'Track accounts payable balances and outstanding vendor bills' },
  { key: 'general-ledger', name: 'Master General Ledger', category: 'Accounts', description: 'Double-entry journal posting, chart of accounts, and ledgers' },
  { key: 'cash-recovery', name: 'Cash Recovery (Customers)', category: 'Accounts', description: 'Collect customer recoveries, installments, and credit settlements' },
  { key: 'vendor-payments', name: 'Vendor Payments', category: 'Accounts', description: 'Log outbound supplier payments and settle vendor invoices' },
  { key: 'pending-payments', name: 'Pending Payments', category: 'Accounts', description: 'Review and authorize pending supplier disbursements' },
  { key: 'advance-salary', name: 'Advance Salary Logger', category: 'Accounts', description: 'Record employee salary loans and recovery deductions' },
  { key: 'attendance', name: 'Employee Attendance', category: 'Accounts', description: 'Daily clock-in/out tracking, shifts, and biometric log audit' },
  { key: 'payroll', name: 'Payroll Dashboard', category: 'Accounts', description: 'Generate monthly payroll, calculate allowances, and print pay slips' },
  { key: 'assets-expenses', name: 'Assets & Expenses Hub', category: 'Accounts', description: 'Fixed assets register and operational expense tracking' },

  // 5. Management & Operations Department
  { key: 'customers', name: 'Customer Master', category: 'Manage', description: 'Register customers, assign credit limits, and delivery details' },
  { key: 'assets', name: 'Fixed Assets', category: 'Manage', description: 'Track company property, equipment, and depreciation' },
  { key: 'vendors', name: 'Vendor Master', category: 'Manage', description: 'Register suppliers, contact details, and credit terms' },
  { key: 'employees', name: 'Employee Master', category: 'Manage', description: 'Staff directory, designations, and basic wage rates' },
  { key: 'employee-portal', name: 'Employee Self-Service Portal', category: 'Manage', description: 'Staff personal dashboard, salary slips, and attendance history' },
  { key: 'settings', name: 'Store Settings', category: 'Manage', description: 'Invoice templates, tax percentages, currency, and branding' }
];

const DEPARTMENT_CONFIGS = [
  { id: 'Sales', name: 'Sales Department', icon: <ShoppingCart size={16} color="#0284c7" />, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { id: 'Inventory', name: 'Inventory & Stock', icon: <Package size={16} color="#16a34a" />, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { id: 'Reports', name: 'Reports & Analytics', icon: <BarChart3 size={16} color="#8b5cf6" />, color: '#8b5cf6', bg: '#faf5ff', border: '#e9d5ff' },
  { id: 'Accounts', name: 'Accounts & Finance', icon: <Landmark size={16} color="#d97706" />, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'Manage', name: 'Management & Control', icon: <Briefcase size={16} color="#475569" />, color: '#475569', bg: '#f8fafc', border: '#e2e8f0' }
];

type EmployeeRec = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  postRecId: number | null;
  postRec: { id: number; title: string } | null;
  empCNIC: string | null;
  address: string | null;
  joiningDate: string | null;
  baseSalary: number;
  flatBonus: number;
  commissionRate: number;
  username?: string | null;
  role?: string;
  isAdmin?: boolean;
  permissions?: Array<{ id: number; pageRoute: string; isAllowed: boolean }>;
  salaries?: any[];
  sales?: any[];
  spotSales?: any[];
  advanceSalaries?: any[];
};

type FormMode = 'DISABLED' | 'CREATE' | 'VIEW' | 'EDIT';

const EmployeeManagement: React.FC = () => {
  const { settings } = useSettings();
  const { token, user, refreshUser } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRec[]>([]);
  const [posts, setPosts] = useState<{ id: number; title: string }[]>([]);

  // Form State
  const [mode, setMode] = useState<FormMode>('DISABLED');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [empCNIC, setEmpCNIC] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [baseSalary, setBaseSalary] = useState<number | ''>('');
  const [flatBonus, setFlatBonus] = useState<number | ''>('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');
  const [postRecId, setPostRecId] = useState<number | ''>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Permissions Map: routeKey -> boolean
  const [permissionsMap, setPermissionsMap] = useState<Record<string, boolean>>({});
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [permissionSearch, setPermissionSearch] = useState('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('ALL');

  // Drilldown Tab in Right Panel: 'PERMISSIONS' | 'COMPENSATION'
  const [activeDrilldownTab, setActiveDrilldownTab] = useState<'PERMISSIONS' | 'COMPENSATION'>('PERMISSIONS');

  // Category CRUD Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryTitle, setEditingCategoryTitle] = useState('');

  // Grid Filter State
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Grid Selection
  const [selectedRows, setSelectedRows] = useState<EmployeeRec[]>([]);

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({
    isOpen: false,
    type: 'salary',
    data: {}
  });

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }), [token]);

  useEffect(() => {
    fetchEmployees();
    fetchPosts();
  }, [token]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/hr/employees', {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/hr/posts', {
        headers: authHeaders
      });
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const initializeDefaultPerms = (emp?: EmployeeRec | null) => {
    const map: Record<string, boolean> = {};
    ERP_MODULES.forEach(m => {
      map[m.key] = false;
    });

    if (!emp) {
      map['pos'] = true;
    } else if (emp.permissions && Array.isArray(emp.permissions)) {
      emp.permissions.forEach(p => {
        map[p.pageRoute] = Boolean(p.isAllowed);
      });
    }

    if (emp?.isAdmin) {
      ERP_MODULES.forEach(m => {
        map[m.key] = true;
      });
    }

    setPermissionsMap(map);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setEmpCNIC('');
    setAddress('');
    setJoiningDate('');
    setBaseSalary('');
    setFlatBonus('');
    setCommissionRate('');
    setPostRecId('');
    setUsername('');
    setPassword('');
    setSelectedEmployeeId(null);
    initializeDefaultPerms(null);
  };

  const handleRowSelected = (e: any) => {
    const selectedNodes = e.api.getSelectedNodes();
    const selectedData = selectedNodes.map((node: any) => node.data);
    setSelectedRows(selectedData);

    if (selectedData.length === 1) {
      const emp: EmployeeRec = selectedData[0];
      setMode('VIEW');
      setSelectedEmployeeId(emp.id);
      setName(emp.name || '');
      setPhone(emp.phone || '');
      setEmail(emp.email || '');
      setEmpCNIC(emp.empCNIC || '');
      setAddress(emp.address || '');
      
      let safeDate = '';
      if (emp.joiningDate) {
        const d = new Date(emp.joiningDate);
        if (!isNaN(d.getTime())) {
          safeDate = d.toISOString().split('T')[0];
        }
      }
      setJoiningDate(safeDate);
      setBaseSalary(emp.baseSalary || '');
      setFlatBonus(emp.flatBonus || '');
      setCommissionRate(emp.commissionRate || '');
      setPostRecId(emp.postRecId || '');
      setUsername(emp.username || '');
      setPassword('');

      // Populate Permissions Map
      initializeDefaultPerms(emp);
    } else if (selectedData.length === 0) {
      if (mode !== 'CREATE' && mode !== 'DISABLED') {
        setMode('DISABLED');
        resetForm();
      }
    }
  };

  const handleCreateNew = () => {
    setMode('CREATE');
    resetForm();
  };

  const handleToggleModule = (key: string) => {
    if (mode === 'VIEW' && selectedEmployeeId) {
      setMode('EDIT');
    }
    setPermissionsMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleDepartment = (deptCategory: string, allow: boolean) => {
    if (mode === 'VIEW' && selectedEmployeeId) {
      setMode('EDIT');
    }
    const deptModules = ERP_MODULES.filter(m => m.category === deptCategory);
    setPermissionsMap(prev => {
      const updated = { ...prev };
      deptModules.forEach(m => {
        updated[m.key] = allow;
      });
      return updated;
    });
  };

  const handleSelectAllPerms = (allowed: boolean) => {
    if (mode === 'VIEW' && selectedEmployeeId) {
      setMode('EDIT');
    }
    const updated: Record<string, boolean> = {};
    ERP_MODULES.forEach(m => {
      updated[m.key] = allowed;
    });
    setPermissionsMap(updated);
  };

  const toggleCollapseDepartment = (deptId: string) => {
    setCollapsedDepts(prev => ({
      ...prev,
      [deptId]: !prev[deptId]
    }));
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'VIEW' || mode === 'DISABLED') return;
    if (!postRecId) {
      alert('Please select an Employee Category.');
      return;
    }

    try {
      const url = mode === 'CREATE' ? '/api/hr/employees' : `/api/hr/employees/${selectedEmployeeId}`;
      const method = mode === 'CREATE' ? 'POST' : 'PUT';

      const permissionsPayload = Object.entries(permissionsMap).map(([pageRoute, isAllowed]) => ({
        pageRoute,
        isAllowed
      }));

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify({
          name,
          phone,
          email,
          empCNIC,
          address,
          joiningDate,
          baseSalary: baseSalary === '' ? 0 : Number(baseSalary),
          flatBonus: flatBonus === '' ? 0 : Number(flatBonus),
          commissionRate: commissionRate === '' ? 0 : Number(commissionRate),
          postRecId: Number(postRecId),
          username: username.trim() || undefined,
          password: password || undefined,
          companyId: user?.companyId,
          permissions: permissionsPayload
        })
      });

      if (res.ok) {
        alert(`✓ Employee record and permissions ${mode === 'CREATE' ? 'created' : 'updated'} successfully!`);
        await fetchEmployees();
        await refreshUser();
        if (mode === 'CREATE') {
          resetForm();
        } else {
          setMode('VIEW');
        }
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to save employee'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving employee.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} employees?`)) return;

    try {
      const res = await fetch('/api/hr/employees/bulk', {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ ids: selectedRows.map(e => e.id) })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Bulk operation complete: ${data.deletedCount} deleted.`);
        fetchEmployees();
        setSelectedRows([]);
      } else {
        alert('Failed to perform bulk operation.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Category CRUD Handlers
  const handleCreateCategory = async () => {
    if (!newCategoryTitle.trim()) return;
    try {
      const res = await fetch('/api/hr/posts', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: newCategoryTitle })
      });
      if (res.ok) {
        setNewCategoryTitle('');
        fetchPosts();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create category');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickCreateCategory = async (title: string) => {
    try {
      const res = await fetch('/api/hr/posts', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const newCat = await res.json();
        await fetchPosts();
        setPostRecId(newCat.id);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create category');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCategory = async (id: number) => {
    if (!editingCategoryTitle.trim()) return;
    try {
      const res = await fetch(`/api/hr/posts/${id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: editingCategoryTitle })
      });
      if (res.ok) {
        setEditingCategoryId(null);
        fetchPosts();
        fetchEmployees(); 
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update category');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await fetch(`/api/hr/posts/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        fetchPosts();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete category');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter Employees dynamically
  const filteredEmployees = useMemo(() => {
    return selectedCategoryFilter === 'ALL'
      ? employees
      : employees.filter(emp => emp.postRecId === Number(selectedCategoryFilter));
  }, [employees, selectedCategoryFilter]);

  const columnDefs: any[] = [
    { headerName: 'ID', field: 'id', width: 60, checkboxSelection: true, headerCheckboxSelection: true },
    { 
      headerName: 'Employee & Role', 
      valueGetter: (params: any) => {
        const role = params.data.postRec?.title ? ` — ${params.data.postRec.title}` : ' — Unassigned';
        return `${params.data.name}${role}`;
      },
      flex: 1.2,
      filter: true
    },
    { 
      headerName: 'Access & Permissions', 
      valueGetter: (params: any) => {
        if (!params.data.username) return 'No Login Account';
        const allowedCount = (params.data.permissions || []).filter((p: any) => p.isAllowed).length;
        return `@${params.data.username} (${allowedCount}/${ERP_MODULES.length} allowed)`;
      },
      width: 180,
      cellRenderer: (params: any) => {
        if (!params.data.username) {
          return <span style={{ color: '#94a3b8', fontSize: '11px' }}>No Login Account</span>;
        }
        const allowedCount = (params.data.permissions || []).filter((p: any) => p.isAllowed).length;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '11px' }}>@{params.data.username}</span>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: 700, 
              color: allowedCount > 0 ? '#15803d' : '#b45309', 
              background: allowedCount > 0 ? '#dcfce7' : '#fef3c7', 
              padding: '1px 6px', 
              borderRadius: '4px' 
            }}>
              {allowedCount}/{ERP_MODULES.length} pages
            </span>
          </div>
        );
      }
    },
    { headerName: 'Phone', field: 'phone', width: 110 },
    { headerName: 'CNIC', field: 'empCNIC', width: 120 },
    { 
      headerName: 'Base Salary', 
      field: 'baseSalary', 
      width: 110,
      valueFormatter: (params: any) => `Rs. ${Number(params.value || 0).toLocaleString()}`
    }
  ];

  const selectedEmp = selectedRows.length === 1 ? selectedRows[0] : null;

  const salesmanSales = useMemo(() => {
    if (!selectedEmp) return [];
    const std = (selectedEmp.sales || []).map((s: any) => ({
      id: s.id,
      invoiceNumber: s.invoiceNo || s.invoiceNumber || `INV-${s.id}`,
      date: s.date,
      totalAmount: s.totalAmount,
      commission: (s.totalAmount * (selectedEmp.commissionRate || 0)) / 100,
      type: 'Standard Sale'
    }));
    const spot = (selectedEmp.spotSales || []).map((s: any) => ({
      id: s.id,
      invoiceNumber: `SPOT-${s.id}`,
      date: s.date,
      totalAmount: s.totalAmount,
      commission: (s.totalAmount * (selectedEmp.commissionRate || 0)) / 100,
      type: 'Van Sale'
    }));
    return [...std, ...spot].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedEmp]);

  // Filter ERP modules by search & category
  const filteredModules = useMemo(() => {
    return ERP_MODULES.filter(m => {
      const matchesSearch = 
        m.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
        m.description.toLowerCase().includes(permissionSearch.toLowerCase()) ||
        m.key.toLowerCase().includes(permissionSearch.toLowerCase()) ||
        m.category.toLowerCase().includes(permissionSearch.toLowerCase());
      
      const matchesCategory = 
        selectedDepartmentFilter === 'ALL' || m.category === selectedDepartmentFilter;

      return matchesSearch && matchesCategory;
    });
  }, [permissionSearch, selectedDepartmentFilter]);

  const activeCount = Object.values(permissionsMap).filter(Boolean).length;

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)', overflow: 'hidden', gap: '8px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="var(--accent-primary)" />
            Employee Profiles & Staff Access Control
          </h1>
          <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '11px' }}>
            Company Admin Portal: Configure staff login credentials, toggle access permissions for all {ERP_MODULES.length} ERP pages, and audit salaries.
          </p>
        </div>
        <button 
          onClick={() => setShowCategoryModal(true)}
          className="btn"
          style={{ 
            padding: '5px 12px', 
            fontSize: '11px', 
            fontWeight: 700, 
            background: 'var(--bg-secondary)', 
            border: '1px solid #cbd5e1', 
            borderRadius: '6px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Settings size={14} /> Manage Categories
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* Left Pane: Employee Master File & Login Credentials */}
        <div className="glass-panel" style={{ flex: '0 0 320px', padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={14} /> Profile Master File
            </div>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '4px' }}>
              <button 
                type="button"
                onClick={handleCreateNew}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: mode === 'CREATE' ? 'var(--accent-primary)' : 'transparent', color: mode === 'CREATE' ? 'white' : 'inherit', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                Create
              </button>
              <button 
                type="button"
                disabled={!selectedEmployeeId}
                onClick={() => setMode('VIEW')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: mode === 'VIEW' ? 'var(--accent-primary)' : 'transparent', color: mode === 'VIEW' ? 'white' : 'inherit', border: 'none', cursor: selectedEmployeeId ? 'pointer' : 'not-allowed', opacity: selectedEmployeeId ? 1 : 0.5 }}
              >
                <Eye size={12} />
              </button>
              <button 
                type="button"
                disabled={!selectedEmployeeId}
                onClick={() => setMode('EDIT')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: mode === 'EDIT' ? 'var(--accent-primary)' : 'transparent', color: mode === 'EDIT' ? 'white' : 'inherit', border: 'none', cursor: selectedEmployeeId ? 'pointer' : 'not-allowed', opacity: selectedEmployeeId ? 1 : 0.5 }}
              >
                <Edit3 size={12} />
              </button>
              {mode !== 'DISABLED' && (
                <button 
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('DISABLED');
                  }}
                  style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <form onSubmit={handleSaveEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="form-section">
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Full Name *</label>
                <input required className="form-input" value={name} onChange={e => setName(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} placeholder="e.g. Ali Ahmed" />
              </div>
              
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Employee Category / Post *</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <select required className="form-select" value={postRecId} onChange={e => setPostRecId(e.target.value === '' ? '' : Number(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'} style={{ flex: 1 }}>
                    <option value="">Select a category...</option>
                    {posts.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  {mode !== 'VIEW' && mode !== 'DISABLED' && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const val = window.prompt("Enter new category name:");
                        if (val && val.trim()) {
                          handleQuickCreateCategory(val.trim());
                        }
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '0 8px', fontSize: '11px', fontWeight: 700 }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Login Credentials Section */}
              <div style={{ 
                background: '#f0f9ff', 
                border: '1px solid #bae6fd', 
                borderRadius: '6px', 
                padding: '8px', 
                marginBottom: '8px' 
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Key size={12} /> Staff ERP Login Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', marginBottom: '2px' }}>Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={username} 
                      onChange={e => setUsername(e.target.value)} 
                      disabled={mode === 'VIEW' || mode === 'DISABLED'} 
                      placeholder="e.g. cashier1" 
                      style={{ background: '#ffffff', fontSize: '11px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', marginBottom: '2px' }}>Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      disabled={mode === 'VIEW' || mode === 'DISABLED'} 
                      placeholder={mode === 'EDIT' ? "Leave blank to keep" : "Set password"} 
                      style={{ background: '#ffffff', fontSize: '11px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Permission Status Badge */}
              <div style={{
                background: activeCount > 0 ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${activeCount > 0 ? '#86efac' : '#cbd5e1'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color={activeCount > 0 ? '#16a34a' : '#64748b'} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: activeCount > 0 ? '#166534' : '#334155' }}>
                      {activeCount}/{ERP_MODULES.length} Pages Allowed
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>
                      Scroll & configure in matrix 👉
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAllPerms(activeCount !== ERP_MODULES.length)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    background: activeCount === ERP_MODULES.length ? '#fef2f2' : '#eff6ff',
                    border: `1px solid ${activeCount === ERP_MODULES.length ? '#fecaca' : '#bfdbfe'}`,
                    color: activeCount === ERP_MODULES.length ? '#dc2626' : '#2563eb',
                    cursor: 'pointer'
                  }}
                >
                  {activeCount === ERP_MODULES.length ? 'Clear All' : 'Select All'}
                </button>
              </div>

              {/* Other Profile Fields */}
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>CNIC</label>
                <input className="form-input" value={empCNIC} onChange={e => setEmpCNIC(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} placeholder="e.g. 35201-XXXXXXX-X" />
              </div>
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} placeholder="e.g. 03001234567" />
              </div>
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} placeholder="e.g. staff@company.com" />
              </div>
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Home Address</label>
                <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Joining Date</label>
                <input type="date" className="form-input" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Base Salary (Rs)</label>
                  <input type="number" className="form-input" value={baseSalary} onChange={e => setBaseSalary(e.target.value === '' ? '' : Number(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Flat Bonus (Rs)</label>
                  <input type="number" className="form-input" value={flatBonus} onChange={e => setFlatBonus(e.target.value === '' ? '' : Number(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '2px' }}>Sales Commission (%)</label>
                <input type="number" step="0.01" className="form-input" value={commissionRate} onChange={e => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              
              {(mode === 'CREATE' || mode === 'EDIT') && (
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Save size={14} /> {mode === 'CREATE' ? 'Save New Employee & Permissions' : 'Update Employee Record'}
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* Right Pane: Grid (Top) & Interactive Permissions Matrix / Compensation (Bottom) */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '8px' }}>
          
          {/* Employee Directory Card */}
          <div className="glass-panel" style={{ flex: '0 0 175px', minHeight: '175px', padding: '8px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Filter Category:</label>
                <select 
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="form-select"
                  style={{ width: '160px', height: '24px', padding: '0 6px', fontSize: '11px' }}
                >
                  <option value="ALL">All Categories</option>
                  {posts.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              {selectedRows.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="btn btn-danger"
                  style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={11} /> Delete ({selectedRows.length})
                </button>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <AgGridReact
                  rowData={filteredEmployees}
                  columnDefs={columnDefs}
                  rowSelection="multiple"
                  onSelectionChanged={handleRowSelected}
                  animateRows={true}
                  defaultColDef={{ sortable: true, filter: true, resizable: true }}
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COMPREHENSIVE STAFF ACCESS PERMISSIONS MATRIX FOR EVERY SINGLE PAGE IN POS */}
          {/* ========================================================================= */}
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '6px', borderTop: '2px solid var(--accent-primary)' }}>
            
            {/* Top Workspace Header with Tabs and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveDrilldownTab('PERMISSIONS')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: activeDrilldownTab === 'PERMISSIONS' ? 'var(--accent-primary)' : 'transparent',
                      color: activeDrilldownTab === 'PERMISSIONS' ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <ShieldCheck size={13} /> Staff Access Control ({activeCount}/{ERP_MODULES.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDrilldownTab('COMPENSATION')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: activeDrilldownTab === 'COMPENSATION' ? 'var(--accent-primary)' : 'transparent',
                      color: activeDrilldownTab === 'COMPENSATION' ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Compensation & Ledger
                  </button>
                </div>

                {selectedEmp && (
                  <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    Staff: {selectedEmp.name} {selectedEmp.username ? `(@${selectedEmp.username})` : ''}
                  </span>
                )}
              </div>

              {activeDrilldownTab === 'PERMISSIONS' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectAllPerms(true)}
                    style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Select All ({ERP_MODULES.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllPerms(false)}
                    style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: PERMISSIONS MATRIX (EVERY SINGLE PAGE IN SYSTEM) */}
            {activeDrilldownTab === 'PERMISSIONS' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', gap: '6px' }}>
                
                {/* Search and Category Filter Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={permissionSearch}
                      onChange={e => setPermissionSearch(e.target.value)}
                      placeholder="Search any page or module (e.g. POS, Invoicing, Ledger, Payroll, Damaged Stock)..."
                      style={{
                        width: '100%',
                        height: '28px',
                        padding: '0 10px 0 30px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedDepartmentFilter('ALL')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: selectedDepartmentFilter === 'ALL' ? '#0f172a' : '#ffffff',
                        color: selectedDepartmentFilter === 'ALL' ? '#ffffff' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      All ({ERP_MODULES.length})
                    </button>
                    {DEPARTMENT_CONFIGS.map(dept => (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setSelectedDepartmentFilter(dept.id)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: `1px solid ${selectedDepartmentFilter === dept.id ? dept.color : '#cbd5e1'}`,
                          background: selectedDepartmentFilter === dept.id ? dept.color : '#ffffff',
                          color: selectedDepartmentFilter === dept.id ? '#ffffff' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        {dept.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categorized Scrollable Full-Height Modules Matrix */}
                <div 
                  className="permissions-scroll-container" 
                  style={{ 
                    flex: 1, 
                    minHeight: 0, 
                    overflowY: 'auto', 
                    maxHeight: '100%', 
                    paddingRight: '6px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px' 
                  }}
                >
                  {DEPARTMENT_CONFIGS.map(dept => {
                    const deptModules = filteredModules.filter(m => m.category === dept.id);
                    if (deptModules.length === 0) return null;

                    const isCollapsed = Boolean(collapsedDepts[dept.id]);
                    const deptActiveCount = deptModules.filter(m => Boolean(permissionsMap[m.key])).length;

                    return (
                      <div 
                        key={dept.id} 
                        style={{
                          background: '#ffffff',
                          border: `1.5px solid ${dept.border}`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          flexShrink: 0
                        }}
                      >
                        {/* Department Header */}
                        <div style={{
                          padding: '6px 12px',
                          background: dept.bg,
                          borderBottom: isCollapsed ? 'none' : `1px solid ${dept.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          userSelect: 'none'
                        }}>
                          <div 
                            onClick={() => toggleCollapseDepartment(dept.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                          >
                            <span style={{ color: dept.color, display: 'flex', alignItems: 'center' }}>
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </span>
                            {dept.icon}
                            <span style={{ fontSize: '11px', fontWeight: 800, color: dept.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {dept.name}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: '#ffffff',
                              color: dept.color,
                              border: `1px solid ${dept.border}`
                            }}>
                              {deptActiveCount} / {deptModules.length} Allowed
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleDepartment(dept.id, true)}
                              style={{ padding: '2px 6px', fontSize: '9px', fontWeight: 700, background: '#ffffff', border: `1px solid ${dept.border}`, color: dept.color, borderRadius: '3px', cursor: 'pointer' }}
                            >
                              Allow All
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleDepartment(dept.id, false)}
                              style={{ padding: '2px 6px', fontSize: '9px', fontWeight: 700, background: '#ffffff', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              Deny All
                            </button>
                          </div>
                        </div>

                        {/* Page Checkboxes Grid */}
                        {!isCollapsed && (
                          <div style={{
                            padding: '8px 10px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                            gap: '6px'
                          }}>
                            {deptModules.map(mod => {
                              const isChecked = Boolean(permissionsMap[mod.key]);

                              return (
                                <div
                                  key={mod.key}
                                  onClick={() => handleToggleModule(mod.key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    background: isChecked ? dept.bg : '#ffffff',
                                    border: isChecked ? `1.5px solid ${dept.color}` : '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.12s ease'
                                  }}
                                >
                                  <div style={{ marginTop: '2px', color: isChecked ? dept.color : '#94a3b8' }}>
                                    {isChecked ? <CheckSquare size={15} /> : <Square size={15} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                    <div style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: isChecked ? dept.color : '#1e293b',
                                      whiteSpace: 'nowrap',
                                      textOverflow: 'ellipsis',
                                      overflow: 'hidden'
                                    }}>
                                      {mod.name}
                                    </div>
                                    <div style={{ fontSize: '9px', color: '#64748b', lineHeight: 1.2, marginTop: '1px' }}>
                                      {mod.description}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: COMPENSATION & AUDIT LEDGER */}
            {activeDrilldownTab === 'COMPENSATION' && selectedEmp && (
              <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                
                {/* Profile Summary */}
                <div style={{ flex: '0 0 25%', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', textTransform: 'uppercase' }}>Compensation Structure</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#475569' }}>Base Salary:</span>
                    <strong style={{ color: '#0f172a' }}>Rs. {Number(selectedEmp.baseSalary || 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#475569' }}>Flat Bonus:</span>
                    <strong style={{ color: '#0f172a' }}>Rs. {Number(selectedEmp.flatBonus || 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#475569' }}>Commission Rate:</span>
                    <strong style={{ color: '#0284c7' }}>{selectedEmp.commissionRate || 0}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '4px', color: '#64748b' }}>
                    <span>Joined Date:</span>
                    <strong>{selectedEmp.joiningDate ? new Date(selectedEmp.joiningDate).toLocaleDateString() : '-'}</strong>
                  </div>
                </div>

                {/* Sales History */}
                <div style={{ flex: '1', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '4px 8px', fontSize: '10px', fontWeight: 800, color: '#475569', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span>SALES BOOKED HISTORY</span>
                    <span style={{ color: '#0284c7' }}>Comm: Rs. {salesmanSales.reduce((sum, s) => sum + s.commission, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Invoice #</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', color: '#0284c7' }}>Comm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesmanSales.map((sale, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{new Date(sale.date).toLocaleDateString()}</td>
                            <td style={{ padding: '4px 6px', fontWeight: 700 }}>{sale.invoiceNumber}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>Rs. {sale.totalAmount.toLocaleString()}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>Rs. {sale.commission.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                          </tr>
                        ))}
                        {salesmanSales.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No sales processed.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Salary Payout Log */}
                <div style={{ flex: '1.1', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '4px 8px', fontSize: '10px', fontWeight: 800, color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                    SALARY PAYOUT LOG
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Payout Date</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Month</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>Net Paid</th>
                          <th style={{ padding: '4px 6px', textAlign: 'center', width: '30px' }}>Print</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEmp.salaries || []).map((sal: any, idx: number) => {
                          const net = (sal.salaryAmount || 0) + (sal.extraIncentive || 0) - (sal.deduction || 0);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{new Date(sal.date).toLocaleDateString()}</td>
                              <td style={{ padding: '4px 6px', fontWeight: 600 }}>
                                {new Date(sal.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>Rs. {net.toLocaleString()}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReceiptModal({
                                      isOpen: true,
                                      type: 'salary',
                                      data: {
                                        id: `SAL-${sal.id}`,
                                        storeName: settings?.storeName || 'Store ERP',
                                        storeAddress: settings?.storeAddress || '',
                                        receiptFooter: settings?.receiptFooter || 'Thank you for your hard work!',
                                        employeeName: selectedEmp.name,
                                        designation: selectedEmp.postRec?.title || 'Employee',
                                        monthYear: new Date(sal.date).toLocaleDateString('default', { month: 'long', year: 'numeric' }),
                                        baseSalary: sal.salaryAmount,
                                        allowances: sal.extraIncentive,
                                        deductions: sal.deduction,
                                        netSalary: net,
                                        paymentMode: 'Cash / Bank Transfer',
                                        paymentDate: sal.date
                                      }
                                    });
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284c7', padding: 0 }}
                                  title="Print Salary Slip"
                                >
                                  <Printer size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(selectedEmp.salaries || []).length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No payouts.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>
      </div>

      {/* Category CRUD Modal */}
      {showCategoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '450px', background: '#ffffff', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <div style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} /> Manage Employee Categories
              </div>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {/* Create Category Form */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="New category (e.g. Delivery Driver)" 
                value={newCategoryTitle}
                onChange={e => setNewCategoryTitle(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                onClick={handleCreateCategory} 
                className="btn btn-primary"
                style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}
              >
                Add Category
              </button>
            </div>

            {/* Categories List */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Category Name</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px' }}>
                        {editingCategoryId === p.id ? (
                          <input 
                            type="text" 
                            value={editingCategoryTitle} 
                            onChange={e => setEditingCategoryTitle(e.target.value)} 
                            className="form-input"
                            style={{ height: '24px', padding: '0 4px' }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{p.title}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        {editingCategoryId === p.id ? (
                          <>
                            <button onClick={() => handleUpdateCategory(p.id)} style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer' }}><Check size={14} /></button>
                            <button onClick={() => setEditingCategoryId(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingCategoryId(p.id); setEditingCategoryTitle(p.title); }} style={{ color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer' }}><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteCategory(p.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {posts.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ padding: '12px', textAlign: 'center', opacity: 0.5 }}>No categories created yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="btn btn-secondary" style={{ padding: '6px 16px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />

      <style>{`
        .permissions-scroll-container::-webkit-scrollbar {
          width: 7px;
        }
        .permissions-scroll-container::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .permissions-scroll-container::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }
        .permissions-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #0284c7;
        }
      `}</style>

    </div>
  );
};

export default EmployeeManagement;
