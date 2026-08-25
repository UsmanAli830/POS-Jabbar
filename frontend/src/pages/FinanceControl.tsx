import React, { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';

type AccountHead = {
  id: number;
  headName: string;
  headType: string;
  openingBalance: number;
};

type LedgerEntry = {
  id: number;
  transactionDate: string;
  description: string;
  debit: number;
  credit: number;
  referenceId: string | null;
  runningBalance: number;
};

const FinanceControl: React.FC = () => {
  const [heads, setHeads] = useState<AccountHead[]>([]);
  const [selectedHeadId, setSelectedHeadId] = useState<number | ''>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedHeadBalance, setSelectedHeadBalance] = useState<number>(0);

  // Form State
  const [headName, setHeadName] = useState('');
  const [headType, setHeadType] = useState('ASSET');
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0);

  useEffect(() => {
    fetchHeads();
  }, []);

  const fetchHeads = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/finance/heads');
      if (res.ok) {
        const data = await res.json();
        setHeads(data);
      }
    } catch (err) {
      console.error('Failed to fetch heads', err);
    }
  };

  const fetchLedger = async (headId: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/finance/ledger/${headId}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.entries);
        setSelectedHeadBalance(data.accountHead.openingBalance);
      }
    } catch (err) {
      console.error('Failed to fetch ledger', err);
    }
  };

  const handleHeadSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setSelectedHeadId('');
      setLedgerEntries([]);
      setSelectedHeadBalance(0);
    } else {
      const id = parseInt(val);
      setSelectedHeadId(id);
      fetchLedger(id);
    }
  };

  const handleCreateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/finance/heads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headName,
          headType,
          openingBalance: openingBalance === '' ? 0 : openingBalance
        })
      });

      if (res.ok) {
        alert('Account Head created successfully!');
        setHeadName('');
        setOpeningBalance(0);
        fetchHeads();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to create account head'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while creating account head.');
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">Finance & Ledgers</h1>
        <p className="page-subtitle">Manage Chart of Accounts and view Double-Entry Ledgers.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Create Account Head */}
        <div className="glass-panel" style={{ flex: '0 0 35%', padding: '24px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '24px', fontWeight: 600, color: 'var(--accent-primary)', fontSize: '18px' }}>
            Chart of Accounts
          </div>
          
          <form onSubmit={handleCreateHead}>
            <div className="form-section">
              <div className="form-section-title">Create New Account Head</div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Head Name</label>
                <input 
                  required 
                  className="form-input" 
                  value={headName} 
                  onChange={e => setHeadName(e.target.value)} 
                  placeholder="e.g., Office Supplies" 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Head Type</label>
                <select className="form-select" value={headType} onChange={e => setHeadType(e.target.value)}>
                  <option value="ASSET">Asset</option>
                  <option value="LIABILITY">Liability</option>
                  <option value="EQUITY">Equity</option>
                  <option value="REVENUE">Revenue</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Opening Balance</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={openingBalance} 
                  onChange={e => setOpeningBalance(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Save size={18} /> Save Account Head
              </button>
            </div>
          </form>

          <div style={{ marginTop: '32px' }}>
            <div className="form-section-title">Existing Account Heads</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {heads.map(h => (
                <li key={h.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{h.headName}</span>
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: 'var(--accent-secondary)', color: 'white' }}>
                    {h.headType}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Pane: Ledger View */}
        <div className="glass-panel" style={{ flex: '1', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '18px' }}>
              Ledger Reports
            </div>
            <button className="btn btn-secondary" onClick={() => selectedHeadId && fetchLedger(selectedHeadId)}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className="form-group" style={{ maxWidth: '300px', marginBottom: '24px' }}>
            <label className="form-label">Select Account Head</label>
            <select className="form-select" value={selectedHeadId} onChange={handleHeadSelect}>
              <option value="">-- Choose an Account --</option>
              {heads.map(h => (
                <option key={h.id} value={h.id}>{h.headName} ({h.headType})</option>
              ))}
            </select>
          </div>

          {selectedHeadId !== '' ? (
            <div style={{ flex: 1, overflowY: 'auto' }} className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan={3} style={{ fontWeight: 500 }}>Opening Balance</td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{selectedHeadBalance.toFixed(2)}</td>
                  </tr>
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', opacity: 0.5 }}>No ledger entries found.</td>
                    </tr>
                  ) : (
                    ledgerEntries.map(entry => (
                      <tr key={entry.id}>
                        <td>{new Date(entry.transactionDate).toLocaleString()}</td>
                        <td>{entry.description}</td>
                        <td>{entry.referenceId || '-'}</td>
                        <td style={{ textAlign: 'right', color: entry.debit > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: entry.credit > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {entry.runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
              Please select an account head to view its ledger.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default FinanceControl;
