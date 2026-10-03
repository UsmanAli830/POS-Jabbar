import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Lockout from './Lockout';
import { 
  ShieldCheck, ArrowRight, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles, Store
} from 'lucide-react';

const LoginGate: React.FC = () => {
  const { login } = useAuth();

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(username.trim(), password.trim());
    } catch (err: any) {
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

  if (lockoutData !== null) {
    return (
      <Lockout
        expiresAt={lockoutData.expiresAt}
        onUnlocked={() => {
          setLockoutData(null);
          resetForm();
        }}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#09090b',
      backgroundImage: 'radial-gradient(circle at 50% 0%, #1c1917 0%, #09090b 75%)',
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
      
      {/* Subtle Glows */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      {/* Main Single Login Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(18, 18, 20, 0.85)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '40px 36px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        zIndex: 10,
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
          }}>
            <Store size={28} color="#ffffff" />
          </div>

          <h1 style={{
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            margin: '0 0 6px 0',
            color: '#ffffff'
          }}>
            POS Jabbar Enterprise ERP
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#a1a1aa',
            margin: 0
          }}>
            Unified Portal Sign In
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: '#f87171'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLoginSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#d4d4d8',
              marginBottom: '8px'
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a'
              }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                style={{
                  width: '100%',
                  height: '46px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '0 16px 0 42px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
            </div>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#d4d4d8',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a'
              }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  height: '46px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '0 44px 0 42px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              height: '48px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '28px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#52525b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <ShieldCheck size={14} color="#3b82f6" />
          <span>Role-based automated security gateway active</span>
        </div>
      </div>
    </div>
  );
};

export default LoginGate;
