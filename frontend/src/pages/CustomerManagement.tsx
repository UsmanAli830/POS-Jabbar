import React, { useState, useEffect } from 'react';
import { Save, UserCheck, Trash2, Edit3, Eye, MapPin, Plus, Check, X } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

type CustomerRec = {
  id: number;
  custName: string;
  businessName: string | null;
  custCNIC: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditLimit: number;
  openingBalance: number;
  liveBalance: number;
  isActive: boolean;
  zone: { id: number, name: string } | null;
  areaRecord: { id: number, name: string } | null;
  route: { id: number, name: string } | null;
  loadType: { id: number, name: string } | null;
  vanRec: { id: number, name: string } | null;
};

type CustomerLocationItem = {
  id?: number;
  locationName: string;
  address?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
};

type DropdownOption = {
  id: number;
  name: string;
};

type FormMode = 'DISABLED' | 'CREATE' | 'VIEW' | 'EDIT';

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRec[]>([]);
  const [zones, setZones] = useState<DropdownOption[]>([]);
  const [areaRecords, setAreaRecords] = useState<DropdownOption[]>([]);
  const [routes, setRoutes] = useState<DropdownOption[]>([]);
  const [loadTypes, setLoadTypes] = useState<DropdownOption[]>([]);
  const [vanRecs, setVanRecs] = useState<DropdownOption[]>([]);

  // Form State
  const [mode, setMode] = useState<FormMode>('DISABLED');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  
  const [custName, setCustName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [custCNIC, setCustCNIC] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
  
  const [zoneId, setZoneId] = useState<number | ''>('');
  const [areaRecordId, setAreaRecordId] = useState<number | ''>('');
  const [routeId, setRouteId] = useState<number | ''>('');
  const [loadTypeId, setLoadTypeId] = useState<number | ''>('');
  const [vanRecId, setVanRecId] = useState<number | ''>('');
  
  const [isActive, setIsActive] = useState(true);

  // Locations sub-section state
  const [locations, setLocations] = useState<CustomerLocationItem[]>([]);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocContact, setNewLocContact] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');

  const [editingLocId, setEditingLocId] = useState<number | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');
  const [editLocContact, setEditLocContact] = useState('');
  const [editLocPhone, setEditLocPhone] = useState('');

  // Grid Selection
  const [selectedRows, setSelectedRows] = useState<CustomerRec[]>([]);

  // Inline Quick Add Modal State
  const [quickAddModal, setQuickAddModal] = useState<{
    type: string;
    title: string;
    setter: React.Dispatch<React.SetStateAction<DropdownOption[]>>;
    selectedSetter: (id: number) => void;
  } | null>(null);

  const handleQuickAddSave = async (name: string) => {
    if (!quickAddModal) return;
    const res = await fetch('http://localhost:3000/api/master-data-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: quickAddModal.type, name })
    });
    if (res.ok) {
      const newRec = await res.json();
      const newOpt = { id: newRec.id, name: newRec.name };
      quickAddModal.setter(prev => [...prev, newOpt]);
      quickAddModal.selectedSetter(newRec.id);
      setQuickAddModal(null);
    } else {
      const err = await res.json();
      alert('Failed: ' + (err.error || 'Could not save option'));
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchCustomers();
  }, []);

  const fetchMasterData = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/master-data');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
        setAreaRecords(data.areaRecords || []);
        setRoutes(data.routes || []);
        setLoadTypes(data.loadTypes || []);
        setVanRecs(data.vanRecs || []);
      }
    } catch (err) {
      console.error('Failed to fetch master data', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch customers', err);
    }
  };

  const fetchCustomerLocations = async (cId: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/customers/${cId}/locations`);
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
      }
    } catch (err) {
      console.error('Failed to fetch customer locations', err);
    }
  };

  const resetForm = () => {
    setCustName('');
    setBusinessName('');
    setCustCNIC('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCreditLimit('');
    setOpeningBalance('');
    setZoneId('');
    setAreaRecordId('');
    setRouteId('');
    setLoadTypeId('');
    setVanRecId('');
    setIsActive(true);
    setSelectedCustomerId(null);
    setLocations([]);
    setNewLocName('');
    setNewLocAddress('');
    setNewLocContact('');
    setNewLocPhone('');
    setEditingLocId(null);
  };

  const handleRowSelected = (e: any) => {
    const selectedNodes = e.api.getSelectedNodes();
    const selectedData = selectedNodes.map((node: any) => node.data);
    setSelectedRows(selectedData);

    if (selectedData.length === 1) {
      const c = selectedData[0] as CustomerRec;
      setMode('VIEW');
      setSelectedCustomerId(c.id);
      setCustName(c.custName || '');
      setBusinessName(c.businessName || '');
      setCustCNIC(c.custCNIC || '');
      setPhone(c.phone || '');
      setEmail(c.email || '');
      setAddress(c.address || '');
      setCreditLimit(c.creditLimit || 0);
      setOpeningBalance(c.openingBalance || 0);
      
      setZoneId(c.zone?.id || '');
      setAreaRecordId(c.areaRecord?.id || '');
      setRouteId(c.route?.id || '');
      setLoadTypeId(c.loadType?.id || '');
      setVanRecId(c.vanRec?.id || '');
      
      setIsActive(c.isActive);

      fetchCustomerLocations(c.id);
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

  const handleAddLocation = async () => {
    if (!newLocName.trim()) {
      alert('Location Name is required.');
      return;
    }

    if (selectedCustomerId) {
      try {
        const res = await fetch(`http://localhost:3000/api/customers/${selectedCustomerId}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationName: newLocName.trim(),
            address: newLocAddress.trim() || null,
            contactPerson: newLocContact.trim() || null,
            phone: newLocPhone.trim() || null,
          })
        });

        if (res.ok) {
          fetchCustomerLocations(selectedCustomerId);
          setNewLocName('');
          setNewLocAddress('');
          setNewLocContact('');
          setNewLocPhone('');
        } else {
          alert('Failed to add location.');
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local state before customer creation
      setLocations([
        ...locations,
        {
          locationName: newLocName.trim(),
          address: newLocAddress.trim() || null,
          contactPerson: newLocContact.trim() || null,
          phone: newLocPhone.trim() || null,
        }
      ]);
      setNewLocName('');
      setNewLocAddress('');
      setNewLocContact('');
      setNewLocPhone('');
    }
  };

  const handleStartEditLocation = (loc: CustomerLocationItem) => {
    setEditingLocId(loc.id || null);
    setEditLocName(loc.locationName);
    setEditLocAddress(loc.address || '');
    setEditLocContact(loc.contactPerson || '');
    setEditLocPhone(loc.phone || '');
  };

  const handleSaveEditLocation = async (locId: number) => {
    if (!editLocName.trim()) {
      alert('Location Name is required.');
      return;
    }

    if (selectedCustomerId && locId) {
      try {
        const res = await fetch(`http://localhost:3000/api/customers/${selectedCustomerId}/locations/${locId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationName: editLocName.trim(),
            address: editLocAddress.trim() || null,
            contactPerson: editLocContact.trim() || null,
            phone: editLocPhone.trim() || null,
          })
        });

        if (res.ok) {
          fetchCustomerLocations(selectedCustomerId);
          setEditingLocId(null);
        } else {
          alert('Failed to update location.');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteLocation = async (locId?: number, idx?: number) => {
    if (selectedCustomerId && locId) {
      if (!window.confirm('Are you sure you want to delete this location?')) return;
      try {
        const res = await fetch(`http://localhost:3000/api/customers/${selectedCustomerId}/locations/${locId}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          fetchCustomerLocations(selectedCustomerId);
        } else {
          alert('Failed to delete location.');
        }
      } catch (err) {
        console.error(err);
      }
    } else if (idx !== undefined) {
      setLocations(locations.filter((_, i) => i !== idx));
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'VIEW') return;

    try {
      const url = mode === 'CREATE' ? 'http://localhost:3000/api/customers' : `http://localhost:3000/api/customers/${selectedCustomerId}`;
      const method = mode === 'CREATE' ? 'POST' : 'PUT';

      const payload = {
        custName,
        businessName,
        custCNIC,
        phone,
        email,
        address,
        creditLimit: creditLimit === '' ? 0 : creditLimit,
        openingBalance: openingBalance === '' ? 0 : openingBalance,
        isActive,
        zoneId: zoneId === '' ? null : zoneId,
        areaRecordId: areaRecordId === '' ? null : areaRecordId,
        routeId: routeId === '' ? null : routeId,
        loadTypeId: loadTypeId === '' ? null : loadTypeId,
        vanRecId: vanRecId === '' ? null : vanRecId,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedCust = await res.json();

        // If in CREATE mode and we have pending local locations, post them
        if (mode === 'CREATE' && locations.length > 0) {
          for (const loc of locations) {
            await fetch(`http://localhost:3000/api/customers/${savedCust.id}/locations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(loc)
            });
          }
        }

        alert(`Customer ${mode === 'CREATE' ? 'created' : 'updated'} successfully!`);
        fetchCustomers();
        if (mode === 'CREATE') {
          resetForm();
        } else {
          setMode('VIEW');
        }
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to save customer'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving customer.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} customers?`)) return;

    try {
      const res = await fetch('http://localhost:3000/api/customers/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRows.map(c => c.id) })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Bulk operation complete: ${data.deletedCount} deleted.`);
        fetchCustomers();
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
    { headerName: 'Customer Name', field: 'custName', flex: 1 },
    { headerName: 'Business Name', field: 'businessName', flex: 1 },
    { headerName: 'Phone', field: 'phone', width: 130 },
    { headerName: 'Zone', field: 'zone.name', width: 130 },
    { headerName: 'Status', field: 'isActive', width: 100, cellRenderer: (params: any) => params.value ? 'Active' : 'Inactive' },
    { headerName: 'Credit Limit', field: 'creditLimit', width: 130, cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` },
    { headerName: 'Opening Balance', field: 'openingBalance', width: 150, cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` },
    { 
      headerName: 'Live Balance', 
      field: 'liveBalance', 
      width: 260, 
      cellStyle: (params: any) => {
        if (params.value > 0) return { color: '#ef4444', fontWeight: 'bold' };
        if (params.value < 0) return { color: '#d97706', fontWeight: 'bold' };
        return null;
      },
      cellRenderer: (params: any) => {
        const val = params.value || 0;
        if (val < 0) return `Payable to Customer (Overpaid): Rs. ${Math.abs(val).toLocaleString()}`;
        return `Rs. ${val.toLocaleString()}`;
      } 
    }
  ];

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', padding: '6px' }}>
      <div className="pos-sub-header" style={{ marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '4px' }}>
        <div>
          <h1 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Enterprise Customer CRM & Accounts Receivable</h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Manage customer profiles, credit limits, multi-locations, and accounts receivable.</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            className="pos-btn pos-btn-secondary" 
            onClick={handleBulkDelete}
            disabled={selectedRows.length === 0}
          >
            <Trash2 size={12} /> Bulk Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Form */}
        <div className="pos-panel" style={{ flex: '0 0 420px', padding: '12px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={14} style={{ color: '#0284c7' }} /> Customer Details
            </div>
            <div style={{ display: 'flex', gap: '2px', background: '#f8fafc', padding: '2px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <button 
                type="button"
                onClick={handleCreateNew}
                className={mode === 'CREATE' ? 'pos-btn pos-btn-primary' : 'pos-btn pos-btn-secondary'}
                style={{ padding: '2px 8px', height: '22px' }}
              >
                Create
              </button>
              <button 
                type="button"
                disabled={!selectedCustomerId}
                onClick={() => setMode('VIEW')}
                className={mode === 'VIEW' ? 'pos-btn pos-btn-primary' : 'pos-btn pos-btn-secondary'}
                style={{ padding: '2px 8px', height: '22px' }}
              >
                <Eye size={12} />
              </button>
              <button 
                type="button"
                disabled={!selectedCustomerId}
                onClick={() => setMode('EDIT')}
                className={mode === 'EDIT' ? 'pos-btn pos-btn-primary' : 'pos-btn pos-btn-secondary'}
                style={{ padding: '2px 8px', height: '22px' }}
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
                  className="pos-btn pos-btn-secondary"
                  style={{ padding: '2px 8px', height: '22px', background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <form onSubmit={handleSaveCustomer}>
            <div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Customer Name</label>
                <input required className="pos-input" value={custName} onChange={e => setCustName(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Business Name</label>
                <input className="pos-input" value={businessName} onChange={e => setBusinessName(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">CNIC</label>
                <input className="pos-input" value={custCNIC} onChange={e => setCustCNIC(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Phone</label>
                <input className="pos-input" value={phone} onChange={e => setPhone(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Email</label>
                <input type="email" className="pos-input" value={email} onChange={e => setEmail(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Address</label>
                <input className="pos-input" value={address} onChange={e => setAddress(e.target.value)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Credit Limit (Rs.)</label>
                <input type="number" step="0.01" min="0" className="pos-input" value={creditLimit} onChange={e => setCreditLimit(e.target.value === '' ? '' : Number(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Opening Balance (Rs.)</label>
                <input type="number" step="0.01" className="pos-input" value={openingBalance} onChange={e => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))} disabled={!(mode === 'CREATE' || mode === 'EDIT')} />
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Zone</label>
                <div className="flex gap-2 items-center w-full">
                  <select className="pos-input flex-1" value={zoneId} onChange={e => setZoneId(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'}>
                    <option value="">-- Select Zone --</option>
                    {zones.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setQuickAddModal({ type: 'zone', title: 'Zone', setter: setZones, selectedSetter: (id) => setZoneId(id) })} 
                    className="bg-[#0088cc] hover:bg-[#0077b5] text-white p-2 rounded-md transition-colors w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0"
                    disabled={mode === 'VIEW' || mode === 'DISABLED'}
                    title="Add New Zone"
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Area Record</label>
                <div className="flex gap-2 items-center w-full">
                  <select className="pos-input flex-1" value={areaRecordId} onChange={e => setAreaRecordId(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'}>
                    <option value="">-- Select Area --</option>
                    {areaRecords.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setQuickAddModal({ type: 'areaRecord', title: 'Area Record', setter: setAreaRecords, selectedSetter: (id) => setAreaRecordId(id) })} 
                    className="bg-[#0088cc] hover:bg-[#0077b5] text-white p-2 rounded-md transition-colors w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0"
                    disabled={mode === 'VIEW' || mode === 'DISABLED'}
                    title="Add New Area"
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Route</label>
                <div className="flex gap-2 items-center w-full">
                  <select className="pos-input flex-1" value={routeId} onChange={e => setRouteId(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'}>
                    <option value="">-- Select Route --</option>
                    {routes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setQuickAddModal({ type: 'route', title: 'Route', setter: setRoutes, selectedSetter: (id) => setRouteId(id) })} 
                    className="bg-[#0088cc] hover:bg-[#0077b5] text-white p-2 rounded-md transition-colors w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0"
                    disabled={mode === 'VIEW' || mode === 'DISABLED'}
                    title="Add New Route"
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Load Type</label>
                <div className="flex gap-2 items-center w-full">
                  <select className="pos-input flex-1" value={loadTypeId} onChange={e => setLoadTypeId(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'}>
                    <option value="">-- Select Load Type --</option>
                    {loadTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setQuickAddModal({ type: 'loadType', title: 'Load Type', setter: setLoadTypes, selectedSetter: (id) => setLoadTypeId(id) })} 
                    className="bg-[#0088cc] hover:bg-[#0077b5] text-white p-2 rounded-md transition-colors w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0"
                    disabled={mode === 'VIEW' || mode === 'DISABLED'}
                    title="Add New Load Type"
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label className="pos-label">Van Record</label>
                <div className="flex gap-2 items-center w-full">
                  <select className="pos-input flex-1" value={vanRecId} onChange={e => setVanRecId(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={mode === 'VIEW' || mode === 'DISABLED'}>
                    <option value="">-- Select Van --</option>
                    {vanRecs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setQuickAddModal({ type: 'vanRec', title: 'Van Record', setter: setVanRecs, selectedSetter: (id) => setVanRecId(id) })} 
                    className="bg-[#0088cc] hover:bg-[#0077b5] text-white p-2 rounded-md transition-colors w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0"
                    disabled={mode === 'VIEW' || mode === 'DISABLED'}
                    title="Add New Van Record"
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} disabled={mode === 'VIEW' || mode === 'DISABLED'} />
                <label htmlFor="isActive" className="pos-label" style={{ marginBottom: 0 }}>Active Customer</label>
              </div>

              {/* Work Locations Sub-Section */}
              <div style={{ marginTop: '16px', marginBottom: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ color: '#10b981' }} /> Work Locations ({locations.length})
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflowX: 'auto', background: '#ffffff' }}>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase', color: '#475569', fontWeight: 600 }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Location Name</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Address</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Contact Person</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Phone</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '50px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.length === 0 && (mode === 'VIEW' || mode === 'DISABLED') && (
                        <tr>
                          <td colSpan={5} style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No locations added yet.</td>
                        </tr>
                      )}
                      {locations.map((loc, idx) => (
                        <tr key={loc.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          {editingLocId === loc.id && loc.id ? (
                            <>
                              <td style={{ padding: '3px 4px' }}>
                                <input className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '22px' }} value={editLocName} onChange={e => setEditLocName(e.target.value)} />
                              </td>
                              <td style={{ padding: '3px 4px' }}>
                                <input className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '22px' }} value={editLocAddress} onChange={e => setEditLocAddress(e.target.value)} />
                              </td>
                              <td style={{ padding: '3px 4px' }}>
                                <input className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '22px' }} value={editLocContact} onChange={e => setEditLocContact(e.target.value)} />
                              </td>
                              <td style={{ padding: '3px 4px' }}>
                                <input className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '22px' }} value={editLocPhone} onChange={e => setEditLocPhone(e.target.value)} />
                              </td>
                              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                  <button type="button" onClick={() => handleSaveEditLocation(loc.id!)} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: '3px', padding: '2px 4px', cursor: 'pointer' }}><Check size={12} /></button>
                                  <button type="button" onClick={() => setEditingLocId(null)} style={{ background: '#94a3b8', border: 'none', color: '#fff', borderRadius: '3px', padding: '2px 4px', cursor: 'pointer' }}><X size={12} /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '6px', fontWeight: 600, color: '#0f172a' }}>{loc.locationName}</td>
                              <td style={{ padding: '6px', color: '#475569' }}>{loc.address || '-'}</td>
                              <td style={{ padding: '6px', color: '#475569' }}>{loc.contactPerson || '-'}</td>
                              <td style={{ padding: '6px', color: '#475569' }}>{loc.phone || '-'}</td>
                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                {mode !== 'VIEW' && (
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <button type="button" onClick={() => handleStartEditLocation(loc)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0 }} title="Edit Location"><Edit3 size={13} /></button>
                                    <button type="button" onClick={() => handleDeleteLocation(loc.id, idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Delete Location"><Trash2 size={13} /></button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}

                      {mode !== 'VIEW' && mode !== 'DISABLED' && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td style={{ padding: '4px' }}>
                            <input placeholder="Location Name *" className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '24px' }} value={newLocName} onChange={e => setNewLocName(e.target.value)} />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input placeholder="Address" className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '24px' }} value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)} />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input placeholder="Contact Person" className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '24px' }} value={newLocContact} onChange={e => setNewLocContact(e.target.value)} />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input placeholder="Phone" className="pos-input" style={{ fontSize: '11px', padding: '2px 4px', height: '24px' }} value={newLocPhone} onChange={e => setNewLocPhone(e.target.value)} />
                          </td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>
                            <button type="button" onClick={handleAddLocation} style={{ background: '#10b981', border: 'none', color: '#ffffff', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Add Location">
                              <Plus size={14} />
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {(mode === 'CREATE' || mode === 'EDIT') && (
                <button type="submit" className="pos-btn pos-btn-primary" style={{ width: '100%' }}>
                  <Save size={12} /> {mode === 'CREATE' ? 'Save New Customer' : 'Update Record'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Pane: Grid */}
        <div className="pos-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="pos-header">
            Customer List
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }} className="ag-theme-alpine">
            <AgGridReact
              rowData={customers}
              columnDefs={columnDefs}
              rowSelection="multiple"
              onSelectionChanged={handleRowSelected}
              domLayout="normal"
            />
          </div>
        </div>

      </div>

      {/* Quick Add Modal Popup */}
      {quickAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', width: '380px', padding: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              Add New {quickAddModal.title}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const inputEl = e.currentTarget.elements.namedItem('quickAddInput') as HTMLInputElement;
              if (inputEl && inputEl.value.trim()) {
                handleQuickAddSave(inputEl.value.trim());
              }
            }}>
              <input
                type="text"
                name="quickAddInput"
                autoFocus
                placeholder={`Enter new ${quickAddModal.title} name...`}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                  fontSize: '14px', marginBottom: '16px', outline: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setQuickAddModal(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1',
                    background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: '#0088cc', color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Save Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerManagement;
