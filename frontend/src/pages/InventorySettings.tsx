import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const InventorySettings: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<any>({ pCats: [], newSubCats: [], pTypes: [], weightUnits: [], companies: [] });
  const [activeTab, setActiveTab] = useState<'pCat' | 'subCat' | 'pType' | 'weightUnit' | 'company'>('pCat');
  const [newValue, setNewValue] = useState('');

  const fetchMasterData = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('http://localhost:3000/api/master-data', { headers });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [token]);

  const handleCreate = async () => {
    if (!newValue.trim()) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('http://localhost:3000/api/master-data-post', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: activeTab, name: newValue.trim() })
      });
      if (res.ok) {
        setNewValue('');
        fetchMasterData();
      } else {
        alert('Failed to create');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete this ${activeTab}?`)) return;
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:3000/api/master-data-post/${activeTab}/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        fetchMasterData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete master record.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error: Failed to delete master record.');
    }
  };

  const getList = () => {
    switch (activeTab) {
      case 'pCat': return data.pCats || [];
      case 'subCat': return data.newSubCats || [];
      case 'pType': return data.pTypes || [];
      case 'weightUnit': return data.weightUnits || [];
      case 'company': return data.companies || [];
      default: return [];
    }
  };

  return (
    <div style={{ display: 'flex', gap: '16px', height: '100%' }}>
      {/* Sidebar for Tabs */}
      <div className="glass-panel" style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>Inventory Settings</h3>
        <button 
          onClick={() => setActiveTab('pCat')} 
          style={{ padding: '8px', textAlign: 'left', background: activeTab === 'pCat' ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: activeTab === 'pCat' ? 'bold' : 'normal' }}
        >
          Categories (PCat)
        </button>
        <button 
          onClick={() => setActiveTab('subCat')} 
          style={{ padding: '8px', textAlign: 'left', background: activeTab === 'subCat' ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: activeTab === 'subCat' ? 'bold' : 'normal' }}
        >
          Sub-Categories (SubCat)
        </button>
        <button 
          onClick={() => setActiveTab('pType')} 
          style={{ padding: '8px', textAlign: 'left', background: activeTab === 'pType' ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: activeTab === 'pType' ? 'bold' : 'normal' }}
        >
          Product Types (PType)
        </button>
        <button 
          onClick={() => setActiveTab('weightUnit')} 
          style={{ padding: '8px', textAlign: 'left', background: activeTab === 'weightUnit' ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: activeTab === 'weightUnit' ? 'bold' : 'normal' }}
        >
          Weight Units
        </button>
        <button 
          onClick={() => setActiveTab('company')} 
          style={{ padding: '8px', textAlign: 'left', background: activeTab === 'company' ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: activeTab === 'company' ? 'bold' : 'normal' }}
        >
          Brands (Company)
        </button>
      </div>

      {/* Main Content */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input 
            type="text" 
            className="desktop-input" 
            placeholder={`Add new ${activeTab}...`} 
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{ width: '300px' }}
          />
          <button className="btn-primary" onClick={handleCreate}>Add</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1', width: '80px' }}>ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1', width: '80px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getList().map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px' }}>{item.id}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.name}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                      title="Delete Record"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {getList().length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No records found for this company. Add a new item above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventorySettings;
