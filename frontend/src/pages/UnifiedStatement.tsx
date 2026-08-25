import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Users, Truck, Calendar, Printer, Download, RefreshCw, 
  TrendingUp, TrendingDown, CircleDollarSign, ArrowUpRight, ArrowDownRight, CreditCard
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';

const formatPKR = (num: number) => {
  return `Rs. ${(num || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getMonthStartStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const UnifiedStatement: React.FC = () => {
  const { user } = useAuth();
  // Filter States
  const [accountType, setAccountType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [startDate, setStartDate] = useState(getMonthStartStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  // Entity Lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Statement Data State
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef
  });

  useEffect(() => {
    fetchEntityLists();
  }, []);

  useEffect(() => {
    // Auto-select first item when type changes or list loads
    if (accountType === 'CUSTOMER' && customers.length > 0 && !selectedEntityId) {
      setSelectedEntityId(String(customers[0].id));
    } else if (accountType === 'VENDOR' && vendors.length > 0 && !selectedEntityId) {
      setSelectedEntityId(String(vendors[0].id));
    }
  }, [accountType, customers, vendors]);

  useEffect(() => {
    if (selectedEntityId) {
      fetchStatement();
    }
  }, [accountType, selectedEntityId, startDate, endDate]);

  const fetchEntityLists = async () => {
    try {
      const [cRes, vRes] = await Promise.all([
        fetch('http://localhost:3000/api/reports/customers'),
        fetch('http://localhost:3000/api/reports/vendors')
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCustomers(cData);
        if (cData.length > 0) setSelectedEntityId(String(cData[0].id));
      }
      if (vRes.ok) {
        const vData = await vRes.json();
        setVendors(vData);
      }
    } catch (e) {
      console.error('Failed to fetch entity lists', e);
    }
  };

  const handleAccountTypeChange = (type: 'CUSTOMER' | 'VENDOR') => {
    setAccountType(type);
    setStatementData(null);
    if (type === 'CUSTOMER' && customers.length > 0) {
      setSelectedEntityId(String(customers[0].id));
    } else if (type === 'VENDOR' && vendors.length > 0) {
      setSelectedEntityId(String(vendors[0].id));
    }
  };

  const fetchStatement = async () => {
    if (!selectedEntityId) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        accountType,
        id: selectedEntityId,
        startDate,
        endDate
      });

      const res = await fetch(`http://localhost:3000/api/reports/statement?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStatementData(data);
      }
    } catch (e) {
      console.error('Failed to fetch account statement', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!statementData?.ledger) return;
    const name = statementData.accountInfo?.name || 'Account';
    exportToCSV(`${accountType}_Statement_${name}_${startDate}_to_${endDate}`, [
      { header: 'Date', key: 'date' },
      { header: 'Reference', key: 'refNo' },
      { header: 'Description', key: 'description' },
      { header: 'Debit', key: 'debit' },
      { header: 'Credit', key: 'credit' },
      { header: 'Running Balance', key: 'runningBalance' }
    ], statementData.ledger);
  };

  const summary = statementData?.summary || {
    grossValue: 0,
    cogs: 0,
    totalPaid: 0,
    totalReturns: 0,
    netProfit: 0
  };

  const info = statementData?.accountInfo || {};
  const isNetProfitPositive = summary.netProfit >= 0;

  return (
    <div className="page-wrapper space-y-6 flex flex-col min-h-screen w-full overflow-y-auto p-4 pb-16">
      
      {/* PAGE TOP BAR */}
      <div className="no-print mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1 flex items-center gap-2">
            <FileText size={26} className="text-blue-600" /> Unified Ledger & Profit Statement
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Combined running balance transaction history with live profit & loss summary on a printable single-page statement.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={fetchStatement} className="btn" style={{ padding: '7px 12px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button onClick={handleExportCSV} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={14} /> Export CSV
          </button>

          <button onClick={() => handlePrint()} className="btn" style={{ padding: '7px 16px', fontSize: '11px', fontWeight: 800, background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={15} /> Print Statement
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="glass-panel no-print" style={{ padding: '14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
        
        {/* Account Type Toggle */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '6px', gap: '4px' }}>
          <button
            onClick={() => handleAccountTypeChange('CUSTOMER')}
            style={{
              padding: '6px 14px', fontSize: '11px', fontWeight: 800, border: 'none', borderRadius: '4px',
              background: accountType === 'CUSTOMER' ? '#0284c7' : 'transparent',
              color: accountType === 'CUSTOMER' ? '#ffffff' : '#64748b', cursor: 'pointer'
            }}
          >
            <Users size={14} style={{ marginRight: '4px', display: 'inline' }} /> Customer Statement
          </button>
          <button
            onClick={() => handleAccountTypeChange('VENDOR')}
            style={{
              padding: '6px 14px', fontSize: '11px', fontWeight: 800, border: 'none', borderRadius: '4px',
              background: accountType === 'VENDOR' ? '#0284c7' : 'transparent',
              color: accountType === 'VENDOR' ? '#ffffff' : '#64748b', cursor: 'pointer'
            }}
          >
            <Truck size={14} style={{ marginRight: '4px', display: 'inline' }} /> Vendor Statement
          </button>
        </div>

        {/* Entity Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '240px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Select {accountType === 'CUSTOMER' ? 'Customer' : 'Vendor'}:</span>
          <select
            value={selectedEntityId}
            onChange={e => setSelectedEntityId(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', outline: 'none' }}
          >
            {accountType === 'CUSTOMER' ? (
              customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)
            ) : (
              vendors.map(v => <option key={v.id} value={v.id}>{v.name} {v.phone ? `(${v.phone})` : ''}</option>)
            )}
          </select>
        </div>

        {/* Date Range Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 10px', marginLeft: 'auto' }}>
          <Calendar size={14} style={{ color: '#64748b' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>From:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 600 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>To:</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 600 }} />
        </div>
      </div>

      {/* PRINTABLE A4 STATEMENT CONTAINER */}
      <div 
        ref={printRef} 
        className="printable-area"
        style={{ 
          background: '#ffffff', 
          padding: '24px', 
          borderRadius: '8px', 
          border: '1px solid #cbd5e1', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        
        {/* HEADER SECTION FOR PRINT */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {user?.companyName || 'Corporate ERP'}
            </h1>
            <h3 style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
              ACCOUNT STATEMENT & PROFIT SUMMARY ({accountType})
            </h3>
            {user?.companyAddress && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{user.companyAddress}</p>}
          </div>

          <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{info.name}</div>
            {info.businessName && <div><strong>Business:</strong> {info.businessName}</div>}
            {info.phone && <div><strong>Phone:</strong> {info.phone}</div>}
            <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>
              <strong>Statement Period:</strong> {startDate} to {endDate}
            </div>
          </div>
        </div>

        {/* SECTION 1: PROFIT & LOSS SUMMARY CARD (TOP) */}
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Account Profitability & Summary Overview
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                {accountType === 'CUSTOMER' ? 'Gross Sales Revenue' : 'Gross Purchases'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{formatPKR(summary.grossValue)}</div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Cost of Goods (COGS)</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>{formatPKR(summary.cogs)}</div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                {accountType === 'CUSTOMER' ? 'Total Cash Collected' : 'Total Payments Made'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>{formatPKR(summary.totalPaid)}</div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Goods Returns Value</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>{formatPKR(summary.totalReturns)}</div>
            </div>

            <div style={{ padding: '10px 12px', background: isNetProfitPositive ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isNetProfitPositive ? '#86efac' : '#fca5a5'}`, borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: isNetProfitPositive ? '#166534' : '#991b1b', fontWeight: 800 }}>Net Profit Generated</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: isNetProfitPositive ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                {formatPKR(summary.netProfit)}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: RUNNING BALANCE LEDGER TABLE (BOTTOM) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 8px 0' }}>
            <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Detailed Transaction History & Running Balance
            </h4>

            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 700 }}>
              <div>Opening Balance: <span style={{ color: '#0284c7' }}>{formatPKR(statementData?.openingBalance || 0)}</span></div>
              <div>Closing Balance: <span style={{ color: (statementData?.closingBalance || 0) > 0 ? '#dc2626' : '#16a34a' }}>{formatPKR(statementData?.closingBalance || 0)}</span></div>
            </div>
          </div>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                  <th className="min-w-[150px]" style={{ padding: '8px 10px', textAlign: 'left' }}>Date / Time</th>
                  <th className="min-w-[120px]" style={{ padding: '8px 10px', textAlign: 'left' }}>Ref #</th>
                  <th className="min-w-[180px]" style={{ padding: '8px 10px', textAlign: 'left' }}>Description / Transaction Note</th>
                  <th className="min-w-[130px]" style={{ padding: '8px 10px', textAlign: 'right' }}>Debit (Dr)</th>
                  <th className="min-w-[130px]" style={{ padding: '8px 10px', textAlign: 'right' }}>Credit (Cr)</th>
                  <th className="min-w-[140px]" style={{ padding: '8px 10px', textAlign: 'right' }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f8fafc', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                  <td colSpan={3} style={{ padding: '8px 10px', color: '#64748b' }}>Opening Balance (Prior to {startDate})</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0284c7' }}>{formatPKR(statementData?.openingBalance || 0)}</td>
                </tr>

                {statementData?.ledger?.map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{row.refNo}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.description}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: row.debit > 0 ? '#0f172a' : '#94a3b8' }}>
                      {row.debit > 0 ? formatPKR(row.debit) : '-'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: row.credit > 0 ? '#16a34a' : '#94a3b8' }}>
                      {row.credit > 0 ? formatPKR(row.credit) : '-'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: row.runningBalance > 0 ? '#dc2626' : '#16a34a' }}>
                      {formatPKR(row.runningBalance)}
                    </td>
                  </tr>
                ))}

                {(!statementData?.ledger || statementData.ledger.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      No transaction entries recorded for this statement period.
                    </td>
                  </tr>
                )}

                <tr style={{ background: '#f1f5f9', fontWeight: 900, borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan={3} style={{ padding: '10px', color: '#0f172a' }}>Closing Balance as of {endDate}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: (statementData?.closingBalance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatPKR(statementData?.closingBalance || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* STATEMENT FOOTER FOR PRINT */}
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
          <div>This is a computer-generated official account statement of {user?.companyName || 'Store ERP'}.</div>
          <div>Authorized Signature: _______________________</div>
        </div>

      </div>

    </div>
  );
};

export default UnifiedStatement;
