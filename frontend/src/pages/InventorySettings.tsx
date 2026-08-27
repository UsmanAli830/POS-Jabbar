import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FolderTree, Layers, Tags, Scale, Building2, Plus, Edit2, Trash2, 
  Check, X, Search, RefreshCw, AlertCircle, CheckCircle2 
} from 'lucide-react';

type TabKey = 'pCat' | 'subCat' | 'pType' | 'weightUnit' | 'company';

interface MasterItem {
  id: number;
  name: string;
  pCatId?: number;
  companyId?: number;
}

const TAB_CONFIG: Record<TabKey, { label: string; icon: any; singular: string; placeholder: string }> = {
  pCat: { label: 'Categories (PCat)', icon: FolderTree, singular: 'Category', placeholder: 'e.g. Sanitary Ware, Pipes, Fittings...' },
  subCat: { label: 'Sub-Categories (SubCat)', icon: Layers, singular: 'Sub-Category', placeholder: 'e.g. CPVC Pipes, Ball Valves...' },
  pType: { label: 'Product Types (PType)', icon: Tags, singular: 'Product Type', placeholder: 'e.g. Standard, Luxury, Economy...' },
  weightUnit: { label: 'Weight Units', icon: Scale, singular: 'Weight Unit', placeholder: 'e.g. Pieces (Pcs), Kg, Box, Meter...' },
  company: { label: 'Brands (Company)', icon: Building2, singular: 'Brand', placeholder: 'e.g. Master, Sonex, IIL, Popular...' },
};

const InventorySettings: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<any>({ pCats: [], newSubCats: [], pTypes: [], weightUnits: [], companies: [] });
  const [activeTab, setActiveTab] = useState<TabKey>('pType');
  const [newValue, setNewValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Delete modal confirmation
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: number; name: string } | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const fetchMasterData = async () => {
    setLoading(true);
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
      showStatus('error', 'Failed to fetch inventory settings master data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [token]);

  const handleCreate = async () => {
    if (!newValue.trim()) return;
    setActionLoading(true);
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
        showStatus('success', `Created new ${TAB_CONFIG[activeTab].singular} successfully.`);
        fetchMasterData();
      } else {
        const err = await res.json();
        showStatus('error', err.error || 'Failed to create record.');
      }
    } catch (e) {
      showStatus('error', 'Network error while creating record.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEdit = (item: MasterItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) return;
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:3000/api/master-data-post/${activeTab}/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: editingName.trim() })
      });
      if (res.ok) {
        setEditingId(null);
        setEditingName('');
        showStatus('success', `Updated ${TAB_CONFIG[activeTab].singular} successfully.`);
        fetchMasterData();
      } else {
        const err = await res.json();
        showStatus('error', err.error || 'Failed to update record.');
      }
    } catch (e) {
      showStatus('error', 'Network error while updating record.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setActionLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:3000/api/master-data-post/${activeTab}/${deleteConfirmItem.id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        showStatus('success', `Deleted ${deleteConfirmItem.name} successfully.`);
        setDeleteConfirmItem(null);
        fetchMasterData();
      } else {
        const err = await res.json();
        showStatus('error', err.error || 'Failed to delete master record.');
      }
    } catch (e) {
      console.error(e);
      showStatus('error', 'Network error: Failed to delete master record.');
    } finally {
      setActionLoading(false);
    }
  };

  const getList = (): MasterItem[] => {
    let items: MasterItem[] = [];
    switch (activeTab) {
      case 'pCat': items = data.pCats || []; break;
      case 'subCat': items = data.newSubCats || []; break;
      case 'pType': items = data.pTypes || []; break;
      case 'weightUnit': items = data.weightUnits || []; break;
      case 'company': items = data.companies || []; break;
      default: items = [];
    }
    if (!searchQuery.trim()) return items;
    return items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(item.id).includes(searchQuery));
  };

  const currentTabConfig = TAB_CONFIG[activeTab];
  const list = getList();

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', padding: '4px', boxSizing: 'border-box' }}>
      {/* Left Sidebar Navigation */}
      <div 
        className="glass-panel" 
        style={{ 
          width: '260px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px', 
          padding: '16px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          flexShrink: 0
        }}
      >
        <div style={{ paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Inventory Settings
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>
            Manage catalog classifications & units
          </p>
        </div>

        {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => {
          const tab = TAB_CONFIG[key];
          const Icon = tab.icon;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setEditingId(null);
                setSearchQuery('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#ffffff' : '#334155',
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div 
        className="glass-panel" 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          background: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        {/* Header & Status Alert */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              {currentTabConfig.label}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Add, rename, or remove {currentTabConfig.singular.toLowerCase()} definitions across your inventory.
            </p>
          </div>
          <button
            onClick={fetchMasterData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {statusMsg && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 14px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              fontSize: '13px',
              fontWeight: 600,
              background: statusMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: statusMsg.type === 'success' ? '#16a34a' : '#dc2626',
              border: `1px solid ${statusMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
            }}
          >
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Action Controls: Add New & Search */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '320px' }}>
            <input 
              type="text" 
              placeholder={`Add new ${currentTabConfig.singular}... (${currentTabConfig.placeholder})`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              disabled={actionLoading}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
            <button 
              onClick={handleCreate}
              disabled={actionLoading || !newValue.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: newValue.trim() ? '#2563eb' : '#94a3b8',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: newValue.trim() ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s ease'
              }}
            >
              <Plus size={15} /> Add {currentTabConfig.singular}
            </button>
          </div>

          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder={`Search ${currentTabConfig.singular.toLowerCase()}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Master Data Grid Table */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', width: '80px', fontWeight: 700 }}>ID</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>{currentTabConfig.singular} Name</th>
                <th style={{ padding: '10px 14px', width: '120px', textAlign: 'center', fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr 
                    key={item.id} 
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      background: isEditing ? '#eff6ff' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>
                      #{item.id}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(item.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb',
                              fontSize: '13px',
                              fontWeight: 600,
                              outline: 'none',
                              width: '100%',
                              maxWidth: '350px'
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={actionLoading || !editingName.trim()}
                            title="Save Changes"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#16a34a',
                              color: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            title="Cancel"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleStartEdit(item)}
                            title="Rename / Edit"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#2563eb',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmItem({ id: item.id, name: item.name })}
                            title="Delete Record"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              background: '#ffffff',
                              color: '#dc2626',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '24px' }}>📂</span>
                      <span style={{ fontWeight: 600 }}>
                        {searchQuery ? `No ${currentTabConfig.singular.toLowerCase()}s match "${searchQuery}"` : `No ${currentTabConfig.singular.toLowerCase()} records found.`}
                      </span>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Use the input above to create a new one.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setDeleteConfirmItem(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Delete {currentTabConfig.singular}?
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ margin: '12px 0 20px 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong style={{ color: '#0f172a' }}>"{deleteConfirmItem.name}"</strong>? Any products currently referencing this {currentTabConfig.singular.toLowerCase()} will be safely unlinked.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteConfirmItem(null)}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                }}
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventorySettings;

