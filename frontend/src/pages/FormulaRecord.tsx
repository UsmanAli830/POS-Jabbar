import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileText, PackageOpen } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

type FormulaComponent = {
  rawMaterialProductId: string;
  quantityRequired: number;
};

const FormulaRecord: React.FC = () => {
  const { products } = useInventory();
  const [formulas, setFormulas] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [components, setComponents] = useState<FormulaComponent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFormulas();
  }, []);

  const fetchFormulas = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/formulas');
      const data = await res.json();
      setFormulas(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComponent = () => {
    setComponents([...components, { rawMaterialProductId: '', quantityRequired: 1 }]);
  };

  const handleComponentChange = (index: number, field: string, value: string | number) => {
    const newComps = [...components];
    newComps[index] = { ...newComps[index], [field]: value };
    setComponents(newComps);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('Name required');
    if (components.length === 0) return alert('Add at least one component');
    if (components.some(c => !c.rawMaterialProductId || c.quantityRequired <= 0)) return alert('Invalid component data');
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, components })
      });
      if (res.ok) {
        setName('');
        setComponents([]);
        fetchFormulas();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`http://localhost:3000/api/formulas/${id}`, { method: 'DELETE' });
      fetchFormulas();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Formula / BOM Setup</h1>
          <p className="page-subtitle">Create bundled products or assembly kits</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ marginBottom: '16px' }}>Create New Formula</h2>
          
          <div className="form-group">
            <label className="form-label">Formula Name</label>
            <input 
              className="form-input" 
              placeholder="e.g. Complete Bathroom Set" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>

          <h3 style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
            Components
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={handleAddComponent}>
              <Plus size={14} style={{ marginRight: '4px' }} /> Add Component
            </button>
          </h3>
          
          {components.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              No components added. Click 'Add Component' to begin.
            </div>
          )}

          {components.map((comp, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 40px', gap: '12px', marginBottom: '12px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Raw Material Product</label>
                <select 
                  className="form-input"
                  value={comp.rawMaterialProductId}
                  onChange={e => handleComponentChange(i, 'rawMaterialProductId', e.target.value)}
                >
                  <option value="">Select Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.productCode} - {p.productName}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quantity</label>
                <input 
                  type="number"
                  className="form-input"
                  value={comp.quantityRequired}
                  onChange={e => handleComponentChange(i, 'quantityRequired', Number(e.target.value))}
                  min="0.1"
                  step="0.1"
                />
              </div>

              <button className="btn btn-secondary" style={{ padding: '12px', color: '#ef4444' }} onClick={() => handleRemoveComponent(i)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '24px', padding: '12px' }} 
            onClick={handleSave} 
            disabled={loading}
          >
            <Save size={18} style={{ marginRight: '8px' }} />
            {loading ? 'Saving...' : 'Save Formula'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ marginBottom: '16px' }}>Existing Formulas</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Formula Name</th>
                <th>Components</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formulas.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: '500' }}>{f.name}</td>
                  <td>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {f.components.map((c: any) => `${c.quantityRequired}x ${c.rawMaterialProduct?.productName}`).join(', ')}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '4px', color: '#ef4444' }} onClick={() => handleDelete(f.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {formulas.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No formulas created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FormulaRecord;
