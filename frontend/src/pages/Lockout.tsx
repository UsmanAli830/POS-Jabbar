import React, { useState } from 'react';
import { 
  ShieldAlert, Lock, Key, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp, ShieldCheck 
} from 'lucide-react';

interface LockoutProps {
  expiresAt?: string;
  onUnlocked?: () => void;
}

const Lockout: React.FC<LockoutProps> = ({ expiresAt, onUnlocked }) => {
  const [showAdminBypass, setShowAdminBypass] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [daysPreset, setDaysPreset] = useState<number>(365);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyPreset = (days: number) => {
    setDaysPreset(days);
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNewExpiryDate(d.toISOString().split('T')[0]);
  };

  const handleExtendLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setStatusMessage({ type: 'error', text: 'Enter Super Admin username and password.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/license/extend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password,
          newExpiryDate: `${newExpiryDate}T23:59:59.999Z`
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMessage({ type: 'success', text: '✓ License renewed and unlocked!' });
        setTimeout(() => {
          if (onUnlocked) {
            onUnlocked();
          } else {
            window.location.reload();
          }
        }, 1000);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to authenticate Super Admin.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Network error connecting to license server.' });
    } finally {
      setLoading(false);
    }
  };

  const formattedExpiry = expiresAt 
    ? new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Subscription Expired';

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 45%, #020617 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '430px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        
        {/* Compact Red Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #dc2626, #991b1b)',
          padding: '16px 20px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ShieldAlert size={22} color="#ffffff" />
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '16px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
              System Access Locked
            </h1>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#fecaca',
              fontSize: '11px',
              fontWeight: 600,
              marginTop: '2px'
            }}>
              <Lock size={10} /> License Expiration / Security Lockout
            </div>
          </div>
        </div>

        {/* Compact Body Content */}
        <div style={{ padding: '16px 20px' }}>
          <p style={{ 
            fontSize: '13px', 
            fontWeight: 700, 
            color: '#1e293b', 
            lineHeight: 1.4,
            margin: '0 0 6px 0'
          }}>
            Your access duration has ended. Please contact your supplier to renew.
          </p>

          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4 }}>
            Point of Sale, inventory calculations, and ledger posting activities have been suspended pending license validation.
          </p>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            fontSize: '11px'
          }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>License Valid Until:</span>
            <span style={{ fontWeight: 800, color: '#dc2626' }}>{formattedExpiry}</span>
          </div>

          {/* Super Admin Bypass Toggle */}
          <div style={{
            borderTop: '1px solid #f1f5f9',
            paddingTop: '10px'
          }}>
            <button
              onClick={() => setShowAdminBypass(!showAdminBypass)}
              style={{
                width: '100%',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '6px 10px'
              }}
            >
              <Key size={12} />
              {showAdminBypass ? 'Hide Super Admin Renewal Key' : 'Super Admin / Master License Renewal Bypass'}
              {showAdminBypass ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Super Admin Bypass Form */}
          {showAdminBypass && (
            <form onSubmit={handleExtendLicense} style={{ marginTop: '12px', textAlign: 'left' }}>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '6px 10px',
                marginBottom: '10px',
                fontSize: '10px',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}>
                <ShieldCheck size={14} />
                Input Super Admin master credentials to set a new license duration.
              </div>

              {statusMessage && (
                <div style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: statusMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  color: statusMessage.type === 'success' ? '#065f46' : '#991b1b',
                  border: `1px solid ${statusMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`
                }}>
                  {statusMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {statusMessage.text}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Super Admin Username:
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    required
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: '11px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Master Password:
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: '11px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155' }}>Extension Presets:</label>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { label: '+30 Days', days: 30 },
                    { label: '+90 Days', days: 90 },
                    { label: '+1 Year', days: 365 },
                    { label: '+2 Years', days: 730 },
                  ].map(preset => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => handleApplyPreset(preset.days)}
                      style={{
                        flex: 1,
                        padding: '4px 0',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: daysPreset === preset.days ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        background: daysPreset === preset.days ? '#eff6ff' : '#ffffff',
                        color: daysPreset === preset.days ? '#1d4ed8' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                  New Expiry Date:
                </label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={e => {
                    setNewExpiryDate(e.target.value);
                    setDaysPreset(0);
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '11px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                }}
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {loading ? 'Authorizing...' : 'Authorize & Extend License'}
              </button>
            </form>
          )}
        </div>

        {/* Compact Footer */}
        <div style={{
          background: '#f8fafc',
          padding: '8px 16px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '10px',
          color: '#94a3b8',
          textAlign: 'center'
        }}>
          Wholesale ERP Point of Sale • Enterprise License Guard
        </div>

      </div>
    </div>
  );
};

export default Lockout;
