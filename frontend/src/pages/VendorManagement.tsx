import React, { useState, useEffect } from 'react';
import { Save, Truck, Trash2, Edit3, Eye, X } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useAuth } from '../context/AuthContext';

type SellerRec = {
  id: number;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sellerCNIC: string | null;
  openingBalance: number;
  liveBalance: number;
  isActive: boolean;
};

type FormMode = 'DISABLED' | 'CREATE' | 'VIEW' | 'EDIT';

const VendorManagement: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canEditVendor = Boolean(user?.isAdmin || user?.role === 'ADMIN' || user?.username === 'admin' || hasPermission('vendor:edit') || hasPermission('vendors'));

  const [vendors, setVendors] = useState<SellerRec[]>([]);

  // Form State
  const [mode, setMode] = useState<FormMode>('DISABLED');
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [sellerCNIC, setSellerCNIC] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  // Grid Selection
  const [selectedRows, setSelectedRows] = useState<SellerRec[]>([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/vendors');
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (err) {
      console.error('Failed to fetch vendors', err);
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setContactPerson('');
    setSellerCNIC('');
    setPhone('');
    setEmail('');
    setAddress('');
    setOpeningBalance('');
    setIsActive(true);
    setSelectedVendorId(null);
  };

  const handleRowSelected = (e: any) => {
    const selectedNodes = e.api.getSelectedNodes();
    const selectedData = selectedNodes.map((node: any) => node.data);
    setSelectedRows(selectedData);

    if (selectedData.length === 1) {
      const v = selectedData[0] as SellerRec;
      setMode('VIEW');
      setSelectedVendorId(v.id);
      setCompanyName(v.companyName || '');
      setContactPerson(v.contactPerson || '');
      setSellerCNIC(v.sellerCNIC || '');
      setPhone(v.phone || '');
      setEmail(v.email || '');
      setAddress(v.address || '');
      setOpeningBalance(v.openingBalance || 0);
      setIsActive(v.isActive);
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

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'VIEW') return;

    try {
      const url = mode === 'CREATE' ? 'http://localhost:3000/api/vendors' : `http://localhost:3000/api/vendors/${selectedVendorId}`;
      const method = mode === 'CREATE' ? 'POST' : 'PUT';

      const payload = {
        companyName,
        contactPerson,
        sellerCNIC,
        phone,
        email,
        address,
        openingBalance: openingBalance === '' ? 0 : openingBalance,
        isActive,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(`Vendor ${mode === 'CREATE' ? 'created' : 'updated'} successfully!`);
        fetchVendors();
        if (mode === 'CREATE') {
          resetForm();
        } else {
          setMode('VIEW');
        }
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to save vendor'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving vendor.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} vendors?`)) return;

    try {
      const res = await fetch('http://localhost:3000/api/vendors/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRows.map(v => v.id) })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Bulk operation complete: ${data.deletedCount} deleted.`);
        fetchVendors();
        setSelectedRows([]);
      } else {
        alert('Failed to perform bulk operation.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const columnDefs: any[] = [
    { headerName: 'ID', field: 'id', width: 80, checkboxSelection: true, headerCheckboxSelection: true },
    { headerName: 'Company Name', field: 'companyName', flex: 1 },
    { headerName: 'Contact Person', field: 'contactPerson', flex: 1 },
    { headerName: 'CNIC', field: 'sellerCNIC', width: 130 },
    { headerName: 'Phone', field: 'phone', width: 130 },
    { headerName: 'Status', field: 'isActive', width: 100, cellRenderer: (params: any) => params.value ? 'Active' : 'Inactive' },
    { headerName: 'Opening Balance', field: 'openingBalance', width: 150, cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` },
    { 
      headerName: 'Live Balance', 
      field: 'liveBalance', 
      width: 150, 
      cellStyle: (params: any) => {
        if (params.value > 0) return { color: '#ef4444', fontWeight: 'bold' }; // Liability: positive means we owe them (red = debt)
        if (params.value < 0) return { color: '#22c55e', fontWeight: 'bold' }; // Liability: negative means we overpaid (green = good)
        return null;
      },
      cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` 
    }
  ];

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Enterprise Vendor & Supplier Management</h1>
          <p className="page-subtitle">Manage supplier profiles and accounts payable.</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleBulkDelete}
            disabled={selectedRows.length === 0 || !canEditVendor}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', opacity: canEditVendor && selectedRows.length > 0 ? 1 : 0.5 }}
            title={canEditVendor ? 'Delete selected vendors' : 'Vendor updates disabled by administrator permissions'}
          >
            <Trash2 size={12} /> Bulk Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Form */}
        <div className="glass-panel" style={{ flex: '0 0 32%', padding: '12px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={14} /> Vendor Details
            </div>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '4px' }}>
              <button 
                type="button"
                onClick={handleCreateNew}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: mode === 'CREATE' ? 'var(--accent-primary)' : 'transparent', color: mode === 'CREATE' ? 'white' : 'inherit', border: 'none', cursor: 'pointer' }}
              >
                Create
              </button>
              <button 
                type="button"
                disabled={!selectedVendorId}
                onClick={() => setMode('VIEW')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: mode === 'VIEW' ? 'var(--accent-primary)' : 'transparent', color: mode === 'VIEW' ? 'white' : 'inherit', border: 'none', cursor: selectedVendorId ? 'pointer' : 'not-allowed', opacity: selectedVendorId ? 1 : 0.5 }}
              >
                <Eye size={12} />
              </button>
              <button 
                type="button"
                disabled={!selectedVendorId || !canEditVendor}
                onClick={() => setMode('EDIT')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: mode === 'EDIT' ? 'var(--accent-primary)' : 'transparent', color: mode === 'EDIT' ? 'white' : 'inherit', border: 'none', cursor: canEditVendor && selectedVendorId ? 'pointer' : 'not-allowed', opacity: canEditVendor && selectedVendorId ? 1 : 0.5 }}
                title={canEditVendor ? 'Edit Vendor' : 'Vendor editing disabled by administrator permissions'}
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
          
          <form onSubmit={handleSaveVendor}>
            <div className="form-section">
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Company Name</label>
                <input required className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Contact Person</label>
                <input className="form-input" value={contactPerson} onChange={e => setContactPerson(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>CNIC</label>
                <input className="form-input" value={sellerCNIC} onChange={e => setSellerCNIC(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Address</label>
                <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Opening Balance (Rs.)</label>
                <input type="number" step="0.01" className="form-input" value={openingBalance} onChange={e => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))} disabled={!(mode === 'CREATE' || mode === 'EDIT')} />
              </div>

              <div className="form-group" style={{ marginBottom: '12px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
                <label htmlFor="isActive" className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 0 }}>Active Vendor</label>
              </div>
              
              {(mode === 'CREATE' || mode === 'EDIT') && (
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '4px' }}>
                  <Save size={12} /> {mode === 'CREATE' ? 'Save New' : 'Update Record'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Pane: Grid */}
        <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 16px' }}>
            <button 
              style={{ padding: '16px 24px', background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent-primary)', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
            >
              Vendor List
            </button>
          </div>

          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }} className="ag-theme-alpine data-table-container">
            <AgGridReact
              rowData={vendors}
              columnDefs={columnDefs}
              rowSelection="multiple"
              onSelectionChanged={handleRowSelected}
              domLayout="normal"
            />
          </div>
        </div>

      </div>

    </div>
  );
};

export default VendorManagement;
