import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Lockout from './Lockout';
import { 
  ShieldCheck, ArrowRight, ArrowLeft, 
  Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles,
  Users, Store
} from 'lucide-react';

type GatePortal = 'SELECTION' | 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';

const LoginGate: React.FC = () => {
  const { login } = useAuth();
  const [activeGate, setActiveGate] = useState<GatePortal>('SELECTION');

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // License lockout state — shown when a locked company tries to login
  const [lockoutData, setLockoutData] = useState<{ expiresAt?: string } | null>(null);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  const handleSelectGate = (gate: GatePortal) => {
    resetForm();
    setActiveGate(gate);
    if (gate === 'SUPER_ADMIN') {
      setUsername('superadmin');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent, gateType: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE') => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(username.trim(), password.trim(), gateType);
    } catch (err: any) {
      // Detect LICENSE_EXPIRED specifically — show Lockout screen instead of generic error
      if (err.code === 'LICENSE_EXPIRED') {
        setLockoutData({ expiresAt: err.expiresAt || undefined });
        setIsLoading(false);
        return;
      }
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // If a locked company tried to login, show the Lockout screen
  if (lockoutData !== null) {
    return (
      <Lockout
        expiresAt={lockoutData.expiresAt}
        onUnlocked={() => {
          setLockoutData(null);
          resetForm();
          setActiveGate('SELECTION');
        }}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#000000',
      backgroundImage: 'radial-gradient(circle at 50% 0%, #171717 0%, #000000 75%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
      color: '#ffffff'
    }}>
      
      {/* Background Subtle Monochrome Glows */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
        top: '-20%',
        left: '50%',
        transform: 'translateX(-50%)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      {/* TOP-RIGHT SUPER ADMIN ACCESS CARD / BUTTON */}
      {activeGate === 'SELECTION' && (
        <button
          onClick={() => handleSelectGate('SUPER_ADMIN')}
          style={{
            position: 'absolute',
            top: '24px',
            right: '28px',
            fontSize: '12px',
            fontWeight: 800,
            padding: '10px 18px',
            background: '#09090b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 20,
            transition: 'all 0.25s ease',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            letterSpacing: '0.3px'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#18181b';
            e.currentTarget.style.borderColor = '#ffffff';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(255,255,255,0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#09090b';
            e.currentTarget.style.borderColor = '#27272a';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.6)';
          }}
        >
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000000'
          }}>
            <ShieldCheck size={14} />
          </div>
          <span>Super Admin</span>
        </button>
      )}

      {/* Main Container */}
      <div style={{
        width: '100%',
        maxWidth: activeGate === 'SELECTION' ? '760px' : '440px',
        position: 'relative',
        zIndex: 10,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>

        {/* ========================================================================= */}
        {/* STAGE 1: GATE SELECTION SCREEN (2 BLACK & WHITE CARDS)                     */}
        {/* ========================================================================= */}
        {activeGate === 'SELECTION' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Top Brand Header */}
            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#09090b',
                border: '1px solid #27272a',
                padding: '6px 18px',
                borderRadius: '30px',
                color: '#e4e4e7',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '1px',
                marginBottom: '20px',
                textTransform: 'uppercase'
              }}>
                <Sparkles size={13} color="#ffffff" />
                Ali Sanitary Store — Enterprise System
              </div>

              <h1 style={{
                fontSize: '36px',
                fontWeight: 900,
                color: '#ffffff',
                margin: '0 0 12px 0',
                letterSpacing: '-1px'
              }}>
                Select Authentication Gate
              </h1>

              <p style={{
                fontSize: '14px',
                color: '#a1a1aa',
                maxWidth: '480px',
                margin: '0 auto',
                lineHeight: 1.6
              }}>
                Choose your authorized portal to sign in to the store management system.
              </p>
            </div>

            {/* 2 Portal Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '28px',
              width: '100%'
            }}>
              
              {/* CARD 1: COMPANY ADMIN */}
              <div
                onClick={() => handleSelectGate('ADMIN')}
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '24px',
                  padding: '40px 32px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.borderColor = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 30px 60px rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#27272a';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.8)';
                }}
              >
                <div>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '26px',
                    color: '#ffffff'
                  }}>
                    <Store size={30} />
                  </div>

                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.3px' }}>
                    Company Admin
                  </h2>
                  
                  <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 32px 0', lineHeight: 1.6 }}>
                    Full business management, store analytics, inventory controls &amp; financial ledgers.
                  </p>
                </div>

                <button style={{
                  width: '100%',
                  padding: '14px',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  letterSpacing: '-0.2px'
                }}>
                  Enter Portal <ArrowRight size={16} />
                </button>
              </div>

              {/* CARD 2: EMPLOYEE PORTAL */}
              <div
                onClick={() => handleSelectGate('EMPLOYEE')}
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '24px',
                  padding: '40px 32px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.borderColor = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 30px 60px rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#27272a';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.8)';
                }}
              >
                <div>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '26px',
                    color: '#ffffff'
                  }}>
                    <Users size={30} />
                  </div>

                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.3px' }}>
                    Employee Portal
                  </h2>
                  
                  <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 32px 0', lineHeight: 1.6 }}>
                    POS cash register, billing counter, order booking, and daily sales operations.
                  </p>
                </div>

                <button style={{
                  width: '100%',
                  padding: '14px',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  letterSpacing: '-0.2px'
                }}>
                  Enter Portal <ArrowRight size={16} />
                </button>
              </div>

            </div>

            {/* Bottom Footer Note */}
            <div style={{
              textAlign: 'center',
              marginTop: '44px',
              color: '#52525b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 600
            }}>
              <Lock size={13} />
              <span>Secure Role-Based Access Control • End-to-End Enterprise Encryption</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: SUPER ADMIN LOGIN FORM (TIER 1)                                  */}
        {/* ========================================================================= */}
        {activeGate === 'SUPER_ADMIN' && (
          <div style={{
            background: '#09090b',
            border: '1px solid #27272a',
            borderRadius: '24px',
            padding: '40px 36px',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 255, 255, 0.05)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveGate('SELECTION')}
              style={{
                position: 'absolute',
                top: '22px',
                left: '22px',
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#a1a1aa',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#000000',
                boxShadow: '0 8px 20px rgba(255, 255, 255, 0.15)'
              }}>
                <ShieldCheck size={28} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '0 0 6px 0' }}>
                Super Admin Sign In
              </h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0 }}>
                Software Supplier Licensing &amp; Master Provisioning
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={e => handleLoginSubmit(e, 'SUPER_ADMIN')} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#71717a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 44px 12px 42px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  padding: '14px',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? <Loader2 size={18} className="spin" /> : 'Authenticate as Super Admin'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: COMPANY ADMIN LOGIN FORM (TIER 2)                                */}
        {/* ========================================================================= */}
        {activeGate === 'ADMIN' && (
          <div style={{
            background: '#09090b',
            border: '1px solid #27272a',
            borderRadius: '24px',
            padding: '40px 36px',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 255, 255, 0.05)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveGate('SELECTION')}
              style={{
                position: 'absolute',
                top: '22px',
                left: '22px',
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#a1a1aa',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#000000',
                boxShadow: '0 8px 20px rgba(255, 255, 255, 0.15)'
              }}>
                <Store size={28} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '0 0 6px 0' }}>
                Company Admin Sign In
              </h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0 }}>
                Store Owner &amp; General Business Management Terminal
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={e => handleLoginSubmit(e, 'ADMIN')} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#71717a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 44px 12px 42px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  padding: '14px',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? <Loader2 size={18} className="spin" /> : 'Authenticate as Company Admin'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: EMPLOYEE / STAFF LOGIN FORM (TIER 3)                             */}
        {/* ========================================================================= */}
        {activeGate === 'EMPLOYEE' && (
          <div style={{
            background: '#09090b',
            border: '1px solid #27272a',
            borderRadius: '24px',
            padding: '40px 36px',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 255, 255, 0.05)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveGate('SELECTION')}
              style={{
                position: 'absolute',
                top: '22px',
                left: '22px',
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#a1a1aa',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#000000',
                boxShadow: '0 8px 20px rgba(255, 255, 255, 0.15)'
              }}>
                <Users size={28} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '0 0 6px 0' }}>
                Employee Portal Sign In
              </h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0 }}>
                Store Cashier, Salesman &amp; Staff Terminal Access
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={e => handleLoginSubmit(e, 'EMPLOYEE')} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#71717a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 44px 12px 42px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  padding: '14px',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? <Loader2 size={18} className="spin" /> : 'Authenticate as Staff Member'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginGate;
