import React, { useState, useEffect, useRef } from 'react';
import { 
  CircleDollarSign, Calendar, Download, Printer, RefreshCw, 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, FolderPlus, 
  ClipboardList, Search, User, Landmark, Tag
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';

const formatPKR = (num: number) => {
  return `Rs. ${(num || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

const AssetsAndExpenses: React.FC = () => {
  const { user } = useAuth();
  // Form Mode State
  const [formMode, setFormMode] = useState<'DISABLED' | 'CREATE'>('DISABLED');

  // Add Entry Form States
  const [type, setType] = useState<'ASSET' | 'EXPENSE'>('EXPENSE');
  const [spentOn, setSpentOn] = useState('');
  const [amount, setAmount] = useState('');
  const [financialHeadId, setFinancialHeadId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayStr());

  // Dropdown Option States
  const [financialHeads, setFinancialHeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Report & List Data States
  const [summary, setSummary] = useState<any>({ totalAssets: 0, totalExpenses: 0, combinedOutflow: 0 });
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterHead, setFilterHead] = useState<string>('ALL');
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef
  });

  useEffect(() => {
    fetchOptions();
    fetchRecords();
  }, []);

  const fetchOptions = async () => {
    try {
      const [headsRes, empRes] = await Promise.all([
        fetch('http://localhost:3000/api/finance/heads'),
        fetch('http://localhost:3000/api/employees')
      ]);
      if (headsRes.ok) setFinancialHeads(await headsRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (e) {
      console.error('Failed to fetch dropdown options', e);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/reports/assets-expenses');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setRecords(data.records);
      }
    } catch (e) {
      console.error('Failed to fetch assets and expenses records', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spentOn || !amount || !financialHeadId) {
      alert('Spent On, Amount, and Financial Head are required fields');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/reports/assets-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spentOn,
          amount: parseFloat(amount),
          financialHeadId: Number(financialHeadId),
          employeeId: employeeId ? Number(employeeId) : null,
          transactionDate,
          type
        })
      });

      if (res.ok) {
        alert(`${type === 'ASSET' ? 'Asset Purchase' : 'Expense'} logged successfully! Ledger synced.`);
        // Reset form
        setSpentOn('');
        setAmount('');
        setFinancialHeadId('');
        setEmployeeId('');
        setTransactionDate(getTodayStr());
        setFormMode('DISABLED');
        // Reload list
        fetchRecords();
      } else {
        const err = await res.json();
        alert(`Failed to save entry: ${err.error}`);
      }
    } catch (err) {
      console.error('Save entry error:', err);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(`Assets_Expenses_Outflow_Report_${getTodayStr()}`, [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Description / Item', key: 'spentOn' },
      { header: 'Financial Head', key: 'financialHeadName' },
      { header: 'Logged By', key: 'loggedByName' },
      { header: 'Amount (PKR)', key: 'amount' }
    ], filteredRecords);
  };

  const handleExportPDF = () => {
    exportToPDF('assets-expenses-print-area', `Assets_Expenses_Report_${getTodayStr()}`);
  };

  // Filter financial heads for the dropdown based on type toggle
  const filteredHeadsForForm = financialHeads.filter(h => {
    const groupName = h.finHeadMainGroup?.name || '';
    if (type === 'ASSET') return groupName === 'Asset';
    return groupName === 'Expense';
  });

  // Filter records list dynamically
  const filteredRecords = records.filter(r => {
    const matchesType = filterType === 'ALL' || r.type === filterType;
    const matchesHead = filterHead === 'ALL' || String(r.financialHeadId) === filterHead;
    const matchesEmployee = filterEmployee === 'ALL' || String(r.loggedById) === filterEmployee;
    
    let matchesDate = true;
    const recDate = new Date(r.date.split('T')[0]);
    if (filterStartDate) {
      matchesDate = matchesDate && recDate >= new Date(filterStartDate);
    }
    if (filterEndDate) {
      matchesDate = matchesDate && recDate <= new Date(filterEndDate);
    }

    return matchesType && matchesHead && matchesEmployee && matchesDate;
  });

  // Re-calculate totals based on filtered records
  const filteredTotalAssets = filteredRecords.filter(r => r.type === 'ASSET').reduce((s, r) => s + r.amount, 0);
  const filteredTotalExpenses = filteredRecords.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page-wrapper space-y-6 flex flex-col min-h-screen w-full overflow-y-auto p-4 pb-16">
      
      {/* TOP HEADER BAR */}
      <div className="no-print mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1 flex items-center gap-2">
            <CircleDollarSign size={26} className="text-blue-600" /> Assets & Expenses Hub
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Log capital assets and operational expenses, audit outlays, and sync with dual-entry general ledger.
          </p>
        </div>

        {/* Top Control Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={fetchRecords} className="btn" style={{ padding: '7px 12px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          
          <button onClick={handleExportCSV} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={14} /> Export CSV
          </button>

          <button onClick={() => handlePrint()} className="btn" style={{ padding: '7px 16px', fontSize: '11px', fontWeight: 800, background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={15} /> Print Report
          </button>

          <button onClick={handleExportPDF} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* TOP FORM: ADD NEW ENTRY & SUMMARY INFO */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px' }}>
        
        {/* LOG OUTFLOW FORM */}
        <div className="glass-panel" style={{ padding: '16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderPlus size={16} style={{ color: '#0284c7' }} /> Log Capital Asset / Operational Expense
            </h3>
            <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '4px' }}>
              <button 
                type="button"
                onClick={() => setFormMode('CREATE')}
                style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: formMode === 'CREATE' ? '#0f172a' : 'transparent', color: formMode === 'CREATE' ? 'white' : '#64748b', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                Create
              </button>
              {formMode !== 'DISABLED' && (
                <button 
                  type="button"
                  onClick={() => {
                    setSpentOn('');
                    setAmount('');
                    setFinancialHeadId('');
                    setEmployeeId('');
                    setTransactionDate(getTodayStr());
                    setFormMode('DISABLED');
                  }}
                  style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Toggle Switch */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '6px', gap: '4px', alignSelf: 'flex-start', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={() => { setType('EXPENSE'); setFinancialHeadId(''); }}
                disabled={formMode === 'DISABLED'}
                style={{
                  padding: '6px 14px', fontSize: '10px', fontWeight: 800, border: 'none', borderRadius: '4px',
                  background: type === 'EXPENSE' ? '#0f172a' : 'transparent',
                  color: type === 'EXPENSE' ? '#ffffff' : '#64748b', cursor: formMode === 'DISABLED' ? 'not-allowed' : 'pointer'
                }}
              >
                Log Expense
              </button>
              <button
                type="button"
                onClick={() => { setType('ASSET'); setFinancialHeadId(''); }}
                disabled={formMode === 'DISABLED'}
                style={{
                  padding: '6px 14px', fontSize: '10px', fontWeight: 800, border: 'none', borderRadius: '4px',
                  background: type === 'ASSET' ? '#0284c7' : 'transparent',
                  color: type === 'ASSET' ? '#ffffff' : '#64748b', cursor: formMode === 'DISABLED' ? 'not-allowed' : 'pointer'
                }}
              >
                Purchase Asset
              </button>
            </div>

            {/* Fields Inputs Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Spent On / Description</span>
                <input 
                  type="text" 
                  placeholder="e.g. Computer Chair, Office Bill"
                  value={spentOn}
                  onChange={e => setSpentOn(e.target.value)}
                  disabled={formMode === 'DISABLED'}
                  style={{ padding: '7px 10px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Amount (PKR)</span>
                <input 
                  type="number" 
                  placeholder="Rs. Amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  disabled={formMode === 'DISABLED'}
                  style={{ padding: '7px 10px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Financial Head (Chart of Accounts)</span>
                <select
                  value={financialHeadId}
                  onChange={e => setFinancialHeadId(e.target.value)}
                  disabled={formMode === 'DISABLED'}
                  style={{ padding: '7px 10px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', background: '#ffffff' }}
                >
                  <option value="">Select Financial Head...</option>
                  {filteredHeadsForForm.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Logged By (Employee)</span>
                <select
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  disabled={formMode === 'DISABLED'}
                  style={{ padding: '7px 10px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', background: '#ffffff' }}
                >
                  <option value="">Admin / Cashier</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Transaction Date</span>
                <input 
                  type="date"
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  disabled={formMode === 'DISABLED'}
                  style={{ padding: '6px 10px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                />
              </div>
            </div>

            {formMode === 'CREATE' && (
              <button 
                type="submit" 
                className="btn" 
                style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 800, background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-end', marginTop: '6px' }}
              >
                Save Outflow Entry
              </button>
            )}

          </form>
        </div>

        {/* OUTFLOW SUMMARY CARD LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '14px', background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '4px solid #0284c7', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={14} style={{ color: '#0284c7' }} /> Total Logged Assets Worth
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{formatPKR(summary.totalAssets)}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Audited capital asset purchases in system</div>
          </div>

          <div style={{ padding: '14px', background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '4px solid #b45309', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingDown size={14} style={{ color: '#b45309' }} /> Total Operating Expenses
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>{formatPKR(summary.totalExpenses)}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Audit expenses debited from Cash in Till</div>
          </div>

          <div style={{ padding: '14px', background: '#0f172a', borderRadius: '8px', color: '#ffffff' }}>
            <div style={{ fontSize: '11px', color: '#bae6fd', fontWeight: 700 }}>Combined Outflow Summary</div>
            <div style={{ fontSize: '22px', fontWeight: 900, marginTop: '2px' }}>{formatPKR(summary.combinedOutflow)}</div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>Double-Entry ledger matched outflow total</div>
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS */}
      <div className="glass-panel no-print" style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
        
        {/* Outflow Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Type:</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}>
            <option value="ALL">All Records</option>
            <option value="EXPENSE">Expense Outlays</option>
            <option value="ASSET">Asset Purchases</option>
          </select>
        </div>

        {/* Financial Head Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Financial Head:</span>
          <select value={filterHead} onChange={e => setFilterHead(e.target.value)} style={{ padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}>
            <option value="ALL">All Accounts</option>
            {financialHeads.map(h => (
              <option key={h.id} value={h.id}>{h.name} ({h.finHeadMainGroup?.name || 'General'})</option>
            ))}
          </select>
        </div>

        {/* Employee Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Logged By:</span>
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} style={{ padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}>
            <option value="ALL">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <Calendar size={13} style={{ color: '#64748b' }} />
          <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '10px', fontWeight: 600 }} />
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>to</span>
          <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '10px', fontWeight: 600 }} />
        </div>

      </div>

      {/* PRINTABLE A4 AREA: TRANSACTION GRID & OUTLAY AUDIT */}
      <div 
        ref={printRef}
        id="assets-expenses-print-area"
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
        {/* HEADER FOR PRINT */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {user?.companyName || 'Corporate ERP'}
            </h1>
            <h3 style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 800, color: '#0284c7' }}>
              CAPITAL ASSETS & OPERATING EXPENSES REPORT
            </h3>
            {user?.companyAddress && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{user.companyAddress}</p>}
          </div>

          <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
            <div><strong>Report Period:</strong> {filterStartDate || 'Inception'} to {filterEndDate || 'Present'}</div>
            <div><strong>Prepared On:</strong> {new Date().toLocaleString()}</div>
            <div style={{ color: '#0284c7', fontWeight: 800, marginTop: '2px' }}>STATUS: DOUBLE-ENTRY AUDITED</div>
          </div>
        </div>

        {/* SUMMARIZED TOTALS CARD FOR PRINT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Total Filtered Assets Value</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{formatPKR(filteredTotalAssets)}</div>
          </div>

          <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Total Filtered Expense Value</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>{formatPKR(filteredTotalExpenses)}</div>
          </div>

          <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#166534', fontWeight: 800 }}>Combined Outflow Summary</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>{formatPKR(filteredTotalAssets + filteredTotalExpenses)}</div>
          </div>
        </div>

        {/* BOTTOM TRANSACTION LEDGER GRID */}
        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Assets & Expenses Transaction Log
          </h4>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                  <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                  <th className="min-w-[100px]" style={{ padding: '8px 12px', textAlign: 'center' }}>Type</th>
                  <th className="min-w-[180px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Description / spentOn</th>
                  <th className="min-w-[160px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Financial Head</th>
                  <th className="min-w-[140px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Logged By</th>
                  <th className="min-w-[140px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r: any, idx: number) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleDateString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ 
                        fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '100px',
                        background: r.type === 'ASSET' ? '#e0f2fe' : '#fffbeb',
                        color: r.type === 'ASSET' ? '#0369a1' : '#b45309'
                      }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.spentOn}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{r.financialHeadName}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{r.loggedByName}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{formatPKR(r.amount)}</td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', opacity: 0.5 }}>
                      No asset or expense transactions logged matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PRINT FOOTER */}
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b', marginTop: '12px' }}>
          <div>This is an official Capital Assets & Operating Expenses summary of {user?.companyName || 'Store ERP'}.</div>
          <div>Audited & Confirmed: _______________________</div>
        </div>

      </div>

    </div>
  );
};

export default AssetsAndExpenses;
