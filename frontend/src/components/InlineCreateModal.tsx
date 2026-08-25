import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

type InlineCreateModalProps = {
  title: string;
  type: string;
  onClose: () => void;
  onSuccess: (newItem: any) => void;
};

const InlineCreateModal: React.FC<InlineCreateModalProps> = ({ title, type, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/master-data-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name })
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data);
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel" style={{ width: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} /> Create {title}
          </h3>
          <button className="btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="form-group">
          <label className="form-label">{title} Name</label>
          <input 
            autoFocus
            className="form-input" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder={`Enter new ${title.toLowerCase()}...`}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={loading || !name.trim()}
          style={{ padding: '12px', marginTop: '8px', display: 'flex', justifyContent: 'center' }}
        >
          {loading ? 'Saving...' : 'Save & Select'}
        </button>
      </div>
    </div>
  );
};

export default InlineCreateModal;
