import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Database, Download, RefreshCw, HardDrive, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const SettingsControl: React.FC = () => {
  const { settings, refreshSettings } = useSettings();
  const { token: authToken } = useAuth();
  const [formData, setFormData] = useState({
    storeName: '',
    storeAddress: '',
    receiptFooter: '',
    primaryColor: '#3b82f6',
    logoUrl: '',
    allowNegativeStock: false
  });
  const [loading, setLoading] = useState(false);

  // Backup States
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');

  const getEffectiveToken = () => {
    return authToken || localStorage.getItem('pos_token') || localStorage.getItem('token') || '';
  };

  useEffect(() => {
    if (settings) {
      setFormData({
        storeName: settings.storeName || '',
        storeAddress: settings.storeAddress || '',
        receiptFooter: settings.receiptFooter || '',
        primaryColor: settings.primaryColor || '#3b82f6',
        logoUrl: settings.logoUrl || '',
        allowNegativeStock: settings.allowNegativeStock || false
      });
    }
    fetchBackups();
  }, [settings, authToken]);

  const fetchBackups = async () => {
    setBackupLoading(true);
    try {
      const token = getEffectiveToken();
      const res = await fetch('http://localhost:3000/api/backup/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error('Failed to fetch backup list', e);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupCreating(true);
    setBackupSuccessMsg('');
    try {
      const token = getEffectiveToken();
      const res = await fetch('http://localhost:3000/api/backup/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackupSuccessMsg(`Backup created successfully: ${data.filename} (${data.sizeFormatted})`);
        fetchBackups();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to create backup' }));
        alert(err.error || 'Failed to create backup.');
      }
    } catch (e) {
      alert('Network error while creating backup.');
    } finally {
      setBackupCreating(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const token = getEffectiveToken();
      const res = await fetch(`http://localhost:3000/api/backup/download/${filename}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download backup file.');
      }
    } catch (e) {
      alert('Error downloading backup file.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await refreshSettings();
        alert('Settings saved and applied successfully!');
      } else {
        alert('Failed to save settings.');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Are you sure you want to run the Database Cleanup to reset all negative stock values to zero?')) return;
    try {
      const res = await fetch('http://localhost:3000/api/inventory/reset-negatives', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`Cleanup complete! Reset ${data.fixedCount} negative products to zero.`);
      } else {
        alert('Failed to run cleanup.');
      }
    } catch (e) {
      alert('Network error during cleanup.');
    }
  };

  return (
    <div className="page-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title"><SettingsIcon size={28} style={{ display: 'inline', verticalAlign: 'bottom', marginRight: '8px' }} /> Store Settings</h1>
        <p className="page-subtitle">White-label your POS, manage automated database backups, and configure defaults.</p>
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DATABASE BACKUP ON DEMAND SECTION */}
          <div className="form-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={20} color="#0284c7" /> Database Backup & Hard Drive Snapshots
              </div>
              <button 
                onClick={fetchBackups} 
                className="btn" 
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={12} className={backupLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The system automatically backs up your entire database to the hard drive <strong>every 6 hours</strong> (00:00, 06:00, 12:00, 18:00). You can also create an on-demand snapshot or download a backup anytime below.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleCreateBackup}
                disabled={backupCreating}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: backupCreating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                }}
              >
                <HardDrive size={16} /> {backupCreating ? 'Creating Snapshot...' : 'Backup Data Now (On Demand)'}
              </button>
              
              <div style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ShieldCheck size={15} color="#16a34a" /> 6-Hour Auto-Backup Active
              </div>
            </div>

            {backupSuccessMsg && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span>{backupSuccessMsg}</span>
              </div>
            )}

            {/* Backups List Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
              <div style={{ padding: '8px 12px', background: '#f1f5f9', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                Recent Local Hard Drive Backups ({backups.length})
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {backups.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                    {backupLoading ? 'Loading backups...' : 'No backups found on disk.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {backups.slice(0, 10).map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{b.filename}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{new Date(b.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{b.sizeFormatted}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDownloadBackup(b.filename)}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Download size={11} /> Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Brand Customization</div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Primary Brand Color (Hex)</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  name="primaryColor" 
                  value={formData.primaryColor} 
                  onChange={handleChange} 
                  style={{ width: '50px', height: '40px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  name="primaryColor" 
                  value={formData.primaryColor} 
                  onChange={handleChange} 
                  className="form-input" 
                  style={{ width: '120px' }}
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                This instantly changes the entire system's accent color (buttons, borders, highlights).
              </p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Store Logo URL</label>
              <input 
                name="logoUrl" 
                value={formData.logoUrl} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Inventory Controls</div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  name="allowNegativeStock" 
                  checked={formData.allowNegativeStock} 
                  onChange={(e) => setFormData(prev => ({ ...prev, allowNegativeStock: e.target.checked }))}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                Allow Negative Stock (Overselling)
              </label>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Enable this if physical stock often arrives before data entry is completed. This allows cashiers to process sales even if the system shows 0 stock.
              </p>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Store Identity & Receipts</div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Store Name</label>
              <input 
                name="storeName" 
                value={formData.storeName} 
                onChange={handleChange} 
                className="form-input" 
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Store Address</label>
              <textarea 
                name="storeAddress" 
                value={formData.storeAddress} 
                onChange={handleChange} 
                className="form-input" 
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Footer Message</label>
              <textarea 
                name="receiptFooter" 
                value={formData.receiptFooter} 
                onChange={handleChange} 
                className="form-input" 
                rows={2}
                style={{ resize: 'vertical' }}
                placeholder="Thank you for your business! No refunds after 7 days."
              />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={loading}
            style={{ padding: '12px 24px', alignSelf: 'flex-start', fontSize: '16px' }}
          >
            <Save size={18} /> {loading ? 'Saving...' : 'Save Settings'}
          </button>

          <div style={{ marginTop: '48px', padding: '16px', border: '1px solid #ef4444', borderRadius: '8px', background: '#fef2f2' }}>
            <h3 style={{ color: '#b91c1c', marginTop: 0, fontSize: '15px' }}>Danger Zone / System Utils</h3>
            <p style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '12px' }}>
              Phase 19.5 Data Cleanup: Instantly finds all products with corrupted negative stock values and adjusts them back to zero.
            </p>
            <button 
              onClick={handleCleanup}
              style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              Run Database Cleanup (Zero Negatives)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsControl;
