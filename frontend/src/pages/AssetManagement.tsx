import React, { useState, useEffect } from 'react';
import { Save, Archive, Edit3, Plus, Trash2, Eye } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const AssetManagement: React.FC = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [assetTypes, setAssetTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [formMode, setFormMode] = useState<'DISABLED' | 'CREATE' | 'VIEW' | 'EDIT'>('DISABLED');

  const [name, setName] = useState('');
  const [value, setValue] = useState<number | ''>('');
  const [assetTypeId, setAssetTypeId] = useState<number | ''>('');
  const [employeeRecId, setEmployeeRecId] = useState<number | ''>('');

  useEffect(() => {
    fetchAssets();
    fetchAssetTypes();
    fetchEmployees();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/assets');
      if (res.ok) setAssets(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAssetTypes = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/assets/types');
      if (res.ok) setAssetTypes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/hr/employees');
      if (res.ok) setEmployees(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setName('');
    setValue('');
    setAssetTypeId('');
    setEmployeeRecId('');
    setFormMode('DISABLED');
  };

  const handleRowSelected = (e: any) => {
    const selected = e.api.getSelectedNodes().map((node: any) => node.data);
    setSelectedRows(selected);
    if (selected.length === 1) {
      setFormMode('VIEW');
      const data = selected[0];
      setName(data.name);
      setValue(data.value);
      setAssetTypeId(data.assetTypeId || '');
      setEmployeeRecId(data.employeeRecId || '');
    } else {
      resetForm();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'VIEW' || formMode === 'DISABLED') return;
    try {
      const url = formMode === 'CREATE' ? 'http://localhost:3000/api/assets' : `http://localhost:3000/api/assets/${selectedRows[0].id}`;
      const method = formMode === 'CREATE' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          value: Number(value),
          assetTypeId: assetTypeId === '' ? null : assetTypeId,
          employeeRecId: employeeRecId === '' ? null : employeeRecId
        })
      });

      if (res.ok) {
        alert(`Asset ${formMode === 'CREATE' ? 'created' : 'updated'} successfully`);
        resetForm();
        fetchAssets();
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const handleDelete = async () => {
    if (selectedRows.length !== 1) return;
    if (!window.confirm('Delete this asset?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/assets/${selectedRows[0].id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Deleted successfully');
        resetForm();
        fetchAssets();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const columnDefs = [
    { headerName: 'ID', field: 'id', width: 70, minWidth: 70, checkboxSelection: true },
    { headerName: 'Asset Name', field: 'name', flex: 1.2, minWidth: 160 },
    { headerName: 'Type', field: 'assetType.name', width: 130, minWidth: 120 },
    { headerName: 'Value', field: 'value', width: 130, minWidth: 120, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { headerName: 'Assigned To', field: 'employeeRec.name', width: 150, minWidth: 140, cellRenderer: (p: any) => p.value ? p.value : <span style={{color: '#94a3b8'}}>Unassigned</span> }
  ];

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full">
      <div className="mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Fixed Assets</h1>
          <p className="text-sm text-gray-500 mb-6">Track company equipment, vehicles, and assign them to employees.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleDelete} disabled={selectedRows.length !== 1}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Form Panel */}
        <div className="glass-panel p-6" style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Archive size={20} /> Asset Details
            </div>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '4px' }}>
              <button 
                type="button"
                onClick={() => {
                  resetForm();
                  setFormMode('CREATE');
                }}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: formMode === 'CREATE' ? 'var(--accent-primary)' : 'transparent', color: formMode === 'CREATE' ? 'white' : 'inherit', border: 'none', cursor: 'pointer' }}
              >
                Create
              </button>
              <button 
                type="button"
                disabled={selectedRows.length !== 1}
                onClick={() => setFormMode('VIEW')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: formMode === 'VIEW' ? 'var(--accent-primary)' : 'transparent', color: formMode === 'VIEW' ? 'white' : 'inherit', border: 'none', cursor: selectedRows.length === 1 ? 'pointer' : 'not-allowed', opacity: selectedRows.length === 1 ? 1 : 0.5 }}
              >
                <Eye size={12} />
              </button>
              <button 
                type="button"
                disabled={selectedRows.length !== 1}
                onClick={() => setFormMode('EDIT')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: formMode === 'EDIT' ? 'var(--accent-primary)' : 'transparent', color: formMode === 'EDIT' ? 'white' : 'inherit', border: 'none', cursor: selectedRows.length === 1 ? 'pointer' : 'not-allowed', opacity: selectedRows.length === 1 ? 1 : 0.5 }}
              >
                <Edit3 size={12} />
              </button>
              {formMode !== 'DISABLED' && (
                <button 
                  type="button"
                  onClick={() => {
                    resetForm();
                    setFormMode('DISABLED');
                  }}
                  style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <form onSubmit={handleSave} style={{ flex: 1 }}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Asset Name / Description</label>
              <input required className="form-input" value={name} onChange={e => setName(e.target.value)} disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Estimated Value (Rs.)</label>
              <input type="number" required className="form-input" value={value} onChange={e => setValue(e.target.value === '' ? '' : Number(e.target.value))} disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Asset Type</label>
              <select className="form-select" value={assetTypeId} onChange={e => setAssetTypeId(e.target.value === '' ? '' : Number(e.target.value))} disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                <option value="">-- Select Type --</option>
                {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Assign to Employee</label>
              <select className="form-select" value={employeeRecId} onChange={e => setEmployeeRecId(e.target.value === '' ? '' : Number(e.target.value))} disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                <option value="">-- Unassigned --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            {(formMode === 'CREATE' || formMode === 'EDIT') && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '16px' }}>
                <Save size={18} /> {formMode === 'CREATE' ? 'Save Asset' : 'Update Asset'}
              </button>
            )}
          </form>
        </div>

        {/* Grid Panel */}
        <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', fontWeight: 600 }}>
            Asset Inventory
          </div>
          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm flex-1">
            <div style={{ height: '100%', minWidth: '600px' }} className="ag-theme-alpine">
              <AgGridReact
                rowData={assets}
                columnDefs={columnDefs}
                rowSelection="single"
                onSelectionChanged={handleRowSelected}
                domLayout="normal"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AssetManagement;
