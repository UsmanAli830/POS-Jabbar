import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';

type TimeclockModalProps = {
  onSuccess: (employee: any, shift?: any) => void;
};

const TimeclockModal: React.FC<TimeclockModalProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNumber = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClockIn = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:3000/api/hr/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: pin })
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.employee, data.shift);
      } else {
        // If they are already clocked in, let's just bypass the lock screen and let them in.
        if (data.error === 'Employee is already clocked in') {
           // We need to fetch their info, or we can assume success for UI sake, but better to hit an endpoint.
           // For simplicity, we just pass an empty mock or we change backend to return employee even if already clocked in.
           // Since backend doesn't return employee on 'already clocked in' error right now, we can do a workaround:
           // Let's clock them out and immediately clock them back in, OR just show error.
           // Ideally, the system should allow them to resume session.
           // For this phase, if they are already clocked in, we'll ask them to clock out first or use a 'resume' flow.
           setError('Already clocked in. You can resume (contact admin).');
           // Quick fix: allow bypass if already clocked in
        } else {
          setError(data.error || 'Invalid PIN');
        }
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
      setPin('');
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={32} color="var(--accent-primary)" />
          </div>
        </div>
        <h1 style={{ color: 'white', margin: 0, fontSize: '28px' }}>Register Locked</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Enter your 4-digit PIN to clock in</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: pin.length > i ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
            transition: 'all 0.2s'
          }} />
        ))}
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontWeight: 500 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '280px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button 
            key={num}
            onClick={() => handleNumber(num.toString())}
            style={{
              padding: '20px',
              fontSize: '24px',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.1s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {num}
          </button>
        ))}
        
        {/* Empty slot for bottom row alignment */}
        <div />

        <button 
          onClick={() => handleNumber('0')}
          style={{
            padding: '20px',
            fontSize: '24px',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.1s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          0
        </button>

        <button 
          onClick={handleDelete}
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '16px',
            color: '#ef4444',
            cursor: 'pointer',
            transition: 'all 0.1s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Delete size={28} />
        </button>
      </div>

      <button 
        className="btn btn-primary"
        style={{ marginTop: '32px', width: '280px', padding: '16px', fontSize: '18px', fontWeight: 600 }}
        onClick={handleClockIn}
        disabled={loading || pin.length !== 4}
      >
        {loading ? 'Verifying...' : 'Clock In / Unlock'}
      </button>

    </div>
  );
};

export default TimeclockModal;
