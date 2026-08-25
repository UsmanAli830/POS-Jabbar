import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, Building2, Lock, User, ArrowRight, ArrowLeft, 
  Key, Eye, EyeOff, Loader2, Server, Store, CheckCircle2, AlertCircle, Sparkles,
  Users, ShoppingBag
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
      setUsername('admin');
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
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#020617',
      backgroundImage: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
      color: '#f8fafc'
    }}>
      
      {/* Background Decorative Glows */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
        top: '-15%',
        left: '25%',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
        bottom: '-15%',
        right: '25%',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />

      {/* TOP-RIGHT SUPER ADMIN / DEVELOPER ACCESS BUTTON */}
      {activeGate === 'SELECTION' && (
        <button
          onClick={() => handleSelectGate('SUPER_ADMIN')}
          style={{
            position: 'absolute',
            top: '20px',
            right: '24px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 14px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 20,
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#f1f5f9';
            e.currentTarget.style.borderColor = '#64748b';
            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
          }}
        >
          <ShieldCheck size={14} color="#38bdf8" /> Developer Access
        </button>
      )}

      {/* Main Container */}
      <div style={{
        width: '100%',
        maxWidth: activeGate === 'SELECTION' ? '860px' : '440px',
        position: 'relative',
        zIndex: 10,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>

        {/* ========================================================================= */}
        {/* STAGE 1: GATE SELECTION SCREEN (2 CLEAN CARDS)                            */}
        {/* ========================================================================= */}
        {activeGate === 'SELECTION' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Top Brand Header */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid #1e293b',
                padding: '6px 16px',
                borderRadius: '30px',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                marginBottom: '16px',
                backdropFilter: 'blur(10px)'
              }}>
                <Sparkles size={14} />
                AIi SANITARY STORE — ENTERPRISE SYSTEM
              </div>

              <h1 style={{
                fontSize: '32px',
                fontWeight: 900,
                color: '#ffffff',
                margin: '0 0 10px 0',
                letterSpacing: '-0.5px'
              }}>
                Select Your Authentication Gate
              </h1>

              <p style={{
                fontSize: '14px',
                color: '#94a3b8',
                maxWidth: '480px',
                margin: '0 auto',
                lineHeight: 1.5
              }}>
                Choose your authorized portal to sign in to the store management system.
              </p>
            </div>

            {/* 2 Clean Portal Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
              width: '100%',
              maxWidth: '780px'
            }}>
              
              {/* CARD 1: COMPANY ADMIN */}
              <div
                onClick={() => handleSelectGate('ADMIN')}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid #1e293b',
                  borderRadius: '20px',
                  padding: '36px 30px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                  transition: 'all 0.25s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                  e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(168, 85, 247, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#1e293b';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.4)';
                }}
              >
                <div>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(126, 34, 206, 0.3))',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '22px',
                    color: '#c084fc'
                  }}>
                    <Store size={28} />
                  </div>

                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Company Admin
                  </h2>
                  
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 28px 0', lineHeight: 1.5 }}>
                    Full business management & controls
                  </p>
                </div>

                <button style={{
                  width: '100%',
                  padding: '13px',
                  background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)',
                  transition: 'opacity 0.2s'
                }}>
                  Enter Portal <ArrowRight size={16} />
                </button>
              </div>

              {/* CARD 2: EMPLOYEE PORTAL */}
              <div
                onClick={() => handleSelectGate('EMPLOYEE')}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid #1e293b',
                  borderRadius: '20px',
                  padding: '36px 30px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                  transition: 'all 0.25s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                  e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(16, 185, 129, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#1e293b';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.4)';
                }}
              >
                <div>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '22px',
                    color: '#34d399'
                  }}>
                    <Users size={28} />
                  </div>

                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Employee Portal
                  </h2>
                  
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 28px 0', lineHeight: 1.5 }}>
                    POS, billing, and daily sales operations
                  </p>
                </div>

                <button style={{
                  width: '100%',
                  padding: '13px',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'opacity 0.2s'
                }}>
                  Enter Portal <ArrowRight size={16} />
                </button>
              </div>

            </div>

            {/* Bottom Footer Note */}
            <div style={{
              textAlign: 'center',
              marginTop: '40px',
              color: '#64748b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
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
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(25px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '24px',
            padding: '36px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 50px rgba(56, 189, 248, 0.15)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveGate('SELECTION')}
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 6px 16px rgba(2, 132, 199, 0.3)'
              }}>
                <ShieldCheck size={26} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                Super Admin Sign In
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Software Supplier Licensing & Master Provisioning
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={e => handleLoginSubmit(e, 'SUPER_ADMIN')} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 38px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                }}
              >
                {isLoading ? <Loader2 size={16} className="spin" /> : 'Authenticate as Super Admin'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: COMPANY ADMIN LOGIN FORM (TIER 2)                                */}
        {/* ========================================================================= */}
        {activeGate === 'ADMIN' && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(25px)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '24px',
            padding: '36px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 50px rgba(168, 85, 247, 0.15)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveGate('SELECTION')}
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 6px 16px rgba(147, 51, 234, 0.3)'
              }}>
                <Store size={26} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                Company Admin Sign In
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Store Owner & General Business Management Terminal
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={e => handleLoginSubmit(e, 'ADMIN')} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 38px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)'
                }}
              >
                {isLoading ? <Loader2 size={16} className="spin" /> : 'Authenticate as Company Admin'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: EMPLOYEE / STAFF LOGIN FORM (TIER 3)                             */}
        {/* ========================================================================= */}
        {activeGate === 'EMPLOYEE' && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(25px)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '24px',
            padding: '36px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 50px rgba(16, 185, 129, 0.15)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveGate('SELECTION')}
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #059669, #047857)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
              }}>
                <Users size={26} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                Employee Portal Sign In
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Store Cashier, Salesman & Staff Terminal Access
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={e => handleLoginSubmit(e, 'EMPLOYEE')} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 38px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                {isLoading ? <Loader2 size={16} className="spin" /> : 'Authenticate as Staff Member'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginGate;
