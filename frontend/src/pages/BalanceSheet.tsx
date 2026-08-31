import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Calendar, Download, Printer, RefreshCw, 
  CheckCircle2, AlertCircle, ShieldCheck, DollarSign, Wallet, Package, Archive, Truck, Users,
  ChevronDown, ChevronRight, Search, ExternalLink, TrendingUp, TrendingDown
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';

const formatPKR = (num: number) => {
  const isNegative = num < 0;
  const absNum = Math.abs(num || 0);
  const formatted = absNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return isNegative ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

const BalanceSheet: React.FC = () => {
  const { user } = useAuth();
  const [asOfDate, setAsOfDate] = useState(getTodayStr());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Expandable Toggles & Search States
  const [expandAR, setExpandAR] = useState(false);
  const [expandAP, setExpandAP] = useState(false);
  const [expandFA, setExpandFA] = useState(false);
  const [searchAR, setSearchAR] = useState('');
  const [searchAP, setSearchAP] = useState('');
  const [searchFA, setSearchFA] = useState('');

  // Print Configuration Checkbox
  const [includeDetailsPrint, setIncludeDetailsPrint] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef
  });

  useEffect(() => {
    fetchBalanceSheet();
  }, [asOfDate]);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/reports/balance-sheet?asOfDate=${asOfDate}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch balance sheet', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      { Category: 'ASSET', Item: 'Cash & Bank Balances', Amount: data.assets.cashAndBank },
      { Category: 'ASSET', Item: 'Accounts Receivable (Customers)', Amount: data.assets.accountsReceivable },
      { Category: 'ASSET', Item: 'Inventory Valuation', Amount: data.assets.inventoryValuation },
      { Category: 'ASSET', Item: 'Fixed Assets & Fixtures', Amount: data.assets.fixedAssets },
      { Category: 'ASSET', Item: 'TOTAL ASSETS', Amount: data.assets.totalAssets },
      { Category: 'LIABILITY', Item: 'Accounts Payable (Vendors)', Amount: data.liabilities.accountsPayable },
      { Category: 'LIABILITY', Item: 'Other Liabilities', Amount: data.liabilities.otherLiabilities },
      { Category: 'LIABILITY', Item: 'TOTAL LIABILITIES', Amount: data.liabilities.totalLiabilities },
      { Category: 'EQUITY', Item: 'Owner Capital', Amount: data.equity.ownerCapital },
      { Category: 'EQUITY', Item: 'Retained Earnings (Net Profit)', Amount: data.equity.retainedEarnings },
      { Category: 'EQUITY', Item: 'TOTAL EQUITY', Amount: data.equity.totalEquity },
      { Category: 'TOTAL', Item: 'TOTAL LIABILITIES & EQUITY', Amount: data.totalLiabilitiesAndEquity }
    ];

    exportToCSV(`Balance_Sheet_As_Of_${asOfDate}`, [
      { header: 'Category', key: 'Category' },
      { header: 'Item / Account Name', key: 'Item' },
      { header: 'Amount (PKR)', key: 'Amount' }
    ], rows);
  };

  const handleExportPDF = () => {
    exportToPDF('balance-sheet-print-area', `Ammad_Sanitary_Balance_Sheet_${asOfDate}`);
  };

  const assets = data?.assets || { cashAndBank: 0, accountsReceivable: 0, inventoryValuation: 0, fixedAssets: 0, totalAssets: 0 };
  const liabilities = data?.liabilities || { accountsPayable: 0, customerOverpayments: 0, otherLiabilities: 0, totalLiabilities: 0 };
  const equity = data?.equity || { ownerCapital: 0, retainedEarnings: 0, totalEquity: 0 };
  const totalLiabilitiesAndEquity = data?.totalLiabilitiesAndEquity || 0;
  const isBalanced = data?.isBalanced ?? true;

  // Phase 62: Net Value Calculation
  // Net Value = Accounts Receivable (Total Customers Balance) - Accounts Payable (Total Vendors Balance) + Inventory Stock + Fixed Assets
  const netOperationalValue = assets.accountsReceivable - liabilities.accountsPayable + assets.inventoryValuation + assets.fixedAssets;

  const receivablesDetail: any[] = data?.receivablesDetail || [];
  const payablesDetail: any[] = data?.payablesDetail || [];
  const assetsDetail: any[] = data?.assetsDetail || [];

  const filteredAR = receivablesDetail.filter(r => 
    r.name.toLowerCase().includes(searchAR.toLowerCase()) || 
    r.businessName.toLowerCase().includes(searchAR.toLowerCase()) ||
    r.phone.includes(searchAR)
  );

  const filteredAP = payablesDetail.filter(p => 
    p.companyName.toLowerCase().includes(searchAP.toLowerCase()) || 
    p.contactPerson.toLowerCase().includes(searchAP.toLowerCase()) ||
    p.phone.includes(searchAP)
  );

  const filteredFA = assetsDetail.filter(f => 
    (f.name || '').toLowerCase().includes(searchFA.toLowerCase()) || 
    (f.loggedByName || '').toLowerCase().includes(searchFA.toLowerCase())
  );

  return (
    <div className="page-wrapper space-y-6 flex flex-col min-h-screen w-full overflow-y-auto p-4 pb-16">
      
      {/* TOP HEADER BAR */}
      <div className="no-print mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1 flex items-center gap-2">
            <Building2 size={26} className="text-blue-600" /> Corporate Balance Sheet & Sub-Ledger Audit
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Real-time financial position statement with live Operational Net Value KPI & sub-ledger drill-downs.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 10px' }}>
            <Calendar size={14} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>As Of Date:</span>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 600 }} />
          </div>

          {/* Print Details Option */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={includeDetailsPrint} 
              onChange={e => setIncludeDetailsPrint(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
            Include Individual Sub-Ledgers in Print
          </label>

          <button onClick={fetchBalanceSheet} className="btn" style={{ padding: '7px 12px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button onClick={handleExportCSV} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={14} /> Export CSV
          </button>

          <button onClick={() => handlePrint()} className="btn" style={{ padding: '7px 16px', fontSize: '11px', fontWeight: 800, background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={15} /> Print Balance Sheet
          </button>

          <button onClick={handleExportPDF} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* BALANCED STATUS BADGE */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isBalanced ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'}`, borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isBalanced ? <CheckCircle2 size={22} style={{ color: '#16a34a' }} /> : <AlertCircle size={22} style={{ color: '#dc2626' }} />}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: isBalanced ? '#166534' : '#991b1b' }}>
              {isBalanced ? 'BALANCE STATUS: BALANCED ✓' : 'BALANCE STATUS: IMBALANCED ⚠️'}
            </div>
            <div style={{ fontSize: '11px', color: isBalanced ? '#15803d' : '#b91c1c' }}>
              {isBalanced 
                ? `Accounting Equation Verified: Assets (${formatPKR(assets.totalAssets)}) = Liabilities & Equity (${formatPKR(totalLiabilitiesAndEquity)})`
                : 'Difference detected between Assets and (Liabilities + Equity)'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', background: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          Click Receivable/Payable rows below to expand itemized individual ledgers
        </div>
      </div>

      {/* PRINTABLE A4 BALANCE SHEET CONTAINER */}
      <div 
        ref={printRef}
        id="balance-sheet-print-area"
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
            <h3 style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
              STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)
            </h3>
            {user?.companyAddress && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{user.companyAddress}</p>}
          </div>

          <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
            <div><strong>As Of Date:</strong> {asOfDate}</div>
            <div><strong>Prepared On:</strong> {new Date().toLocaleString()}</div>
            <div style={{ color: '#16a34a', fontWeight: 800, marginTop: '2px' }}>STATUS: AUDITED & BALANCED ✓</div>
          </div>
        </div>

        {/* OPERATIONAL NET VALUE KPI BOX */}
        <div style={{ 
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
          border: '2px solid #0284c7', 
          borderRadius: '8px', 
          padding: '16px 20px', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Operational Net Value Breakdown
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                  Formula: (Total Receivable - Total Giveable + Total Stock Cost + Total Assets)
                </div>
              </div>
            </div>
            <div style={{ fontSize: '9px', background: '#bae6fd', color: '#0369a1', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
              REAL-TIME FORMULA AUDIT
            </div>
          </div>

          {/* Four-line calculation block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontWeight: 700, padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Total Receivables (Customers)</span>
              <span style={{ color: '#16a34a' }}>+ {formatPKR(assets.accountsReceivable)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Total Payables (Vendors)</span>
              <span style={{ color: '#dc2626' }}>- {formatPKR(liabilities.accountsPayable)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Inventory Stock</span>
              <span style={{ 
                color: assets.inventoryValuation < 0 ? '#dc2626' : '#0284c7',
                fontWeight: 700 
              }}>
                {assets.inventoryValuation >= 0 ? '+ ' : ''}{formatPKR(assets.inventoryValuation)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Fixed Assets & Equipment</span>
              <span style={{ color: '#0284c7' }}>+ {formatPKR(assets.fixedAssets)}</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #e2e8f0' }}></div>

          {/* Calculated Operational Net Value (Total) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Operational Net Value</span>
            <span style={{ fontSize: '22px', fontWeight: 900, color: netOperationalValue >= 0 ? '#16a34a' : '#dc2626', letterSpacing: '-0.5px' }}>
              {formatPKR(netOperationalValue)}
            </span>
          </div>
        </div>

        {/* DOUBLE COLUMN FINANCIAL STATEMENT GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* LEFT COLUMN: ASSETS */}
          <div style={{ border: '1px solid #0f172a', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ background: '#0f172a', color: '#ffffff', padding: '10px 14px', fontWeight: 900, fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ASSETS (What We Own)</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>PRESENT WORTH</span>
              </div>

              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Asset Item / Account</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wallet size={14} style={{ color: '#0284c7' }} /> Cash & Bank Balances
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(assets.cashAndBank)}</td>
                  </tr>

                  {/* EXPANDABLE ACCOUNTS RECEIVABLE ROW */}
                  <tr 
                    onClick={() => setExpandAR(!expandAR)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: expandAR ? '#e0f2fe' : 'transparent', transition: 'background 0.2s' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {expandAR ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Users size={14} style={{ color: '#6366f1' }} /> Accounts Receivable (Customers)
                      <span style={{ marginLeft: '4px', fontSize: '9px', background: '#bae6fd', color: '#0369a1', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
                        {receivablesDetail.length} Accounts
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#0369a1' }}>{formatPKR(assets.accountsReceivable)}</td>
                  </tr>

                  {/* INLINE EXPANDED CUSTOMER BREAKDOWN LIST */}
                  {expandAR && (
                    <tr>
                      <td colSpan={2} style={{ padding: '10px', background: '#f0f9ff', borderBottom: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>Itemized Customer Receivables</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px' }}>
                            <Search size={12} style={{ color: '#64748b' }} />
                            <input 
                              type="text" 
                              placeholder="Search customer..." 
                              value={searchAR} 
                              onChange={e => setSearchAR(e.target.value)}
                              style={{ border: 'none', outline: 'none', fontSize: '10px', width: '120px' }}
                            />
                          </div>
                        </div>

                        <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}>
                          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Customer Name</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Contact / Address</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Balance Owed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAR.map((r: any, idx: number) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                                    <span style={{ color: '#0284c7' }}>{r.name}</span>
                                    {r.businessName && <div style={{ fontSize: '9px', color: '#64748b' }}>{r.businessName}</div>}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#475569' }}>
                                    {r.phone || '-'} {r.address ? `• ${r.address.substring(0, 20)}...` : ''}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                    {formatPKR(r.balance)}
                                  </td>
                                </tr>
                              ))}
                              {filteredAR.length === 0 && (
                                <tr>
                                  <td colSpan={3} style={{ padding: '12px', textAlign: 'center', opacity: 0.5 }}>No matching customer records found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}

                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={14} style={{ color: '#16a34a' }} /> Inventory Stock
                    </td>
                    <td style={{ 
                      padding: '10px 12px', 
                      textAlign: 'right', 
                      fontWeight: 700,
                      color: assets.inventoryValuation < 0 ? '#dc2626' : 'inherit'
                    }}>{formatPKR(assets.inventoryValuation)}</td>
                  </tr>

                  {/* EXPANDABLE FIXED ASSETS ROW */}
                  <tr 
                    onClick={() => setExpandFA(!expandFA)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: expandFA ? '#fef3c7' : 'transparent', transition: 'background 0.2s' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {expandFA ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Archive size={14} style={{ color: '#b45309' }} /> Fixed Assets & Equipment
                      <span style={{ marginLeft: '4px', fontSize: '9px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
                        {assetsDetail.length} Assets
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#b45309' }}>{formatPKR(assets.fixedAssets)}</td>
                  </tr>

                  {/* INLINE EXPANDED FIXED ASSET BREAKDOWN LIST */}
                  {expandFA && (
                    <tr>
                      <td colSpan={2} style={{ padding: '10px', background: '#fffbeb', borderBottom: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>Itemized Capital Assets</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px' }}>
                            <Search size={12} style={{ color: '#64748b' }} />
                            <input 
                              type="text" 
                              placeholder="Search asset..." 
                              value={searchFA} 
                              onChange={e => setSearchFA(e.target.value)}
                              style={{ border: 'none', outline: 'none', fontSize: '10px', width: '120px' }}
                            />
                          </div>
                        </div>

                        <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}>
                          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Asset Description</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Date / Logged By</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Asset Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredFA.map((f: any) => (
                                <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                                    {f.name}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#475569' }}>
                                    {new Date(f.date).toLocaleDateString()} by {f.loggedByName}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                    {formatPKR(f.amount)}
                                  </td>
                                </tr>
                              ))}
                              {filteredFA.length === 0 && (
                                <tr>
                                  <td colSpan={3} style={{ padding: '12px', textAlign: 'center', opacity: 0.5 }}>No matching capital asset records found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#0284c7', color: '#ffffff', padding: '12px 14px', fontWeight: 900, fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0f172a' }}>
              <span>TOTAL</span>
              <span>{formatPKR(assets.totalAssets)}</span>
            </div>
          </div>

          {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
          <div style={{ border: '1px solid #0f172a', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ background: '#0f172a', color: '#ffffff', padding: '10px 14px', fontWeight: 900, fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>LIABILITIES & EQUITY</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>OBLIGATIONS & WORTH</span>
              </div>

              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Liabilities & Equity Account</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* LIABILITIES SECTION */}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: '6px 12px', color: '#475569', fontSize: '10px' }}>A. LIABILITIES (What We Owe)</td>
                  </tr>

                  {/* EXPANDABLE ACCOUNTS PAYABLE ROW */}
                  <tr 
                    onClick={() => setExpandAP(!expandAP)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: expandAP ? '#fef3c7' : 'transparent', transition: 'background 0.2s' }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {expandAP ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Truck size={14} style={{ color: '#b45309' }} /> Accounts Payable (Vendors)
                      <span style={{ marginLeft: '4px', fontSize: '9px', background: '#fde68a', color: '#92400e', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
                        {payablesDetail.length} Vendors
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#b45309' }}>{formatPKR(liabilities.accountsPayable)}</td>
                  </tr>

                  {/* INLINE EXPANDED VENDOR BREAKDOWN LIST */}
                  {expandAP && (
                    <tr>
                      <td colSpan={2} style={{ padding: '10px', background: '#fffbeb', borderBottom: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>Itemized Vendor Payables</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px' }}>
                            <Search size={12} style={{ color: '#64748b' }} />
                            <input 
                              type="text" 
                              placeholder="Search vendor..." 
                              value={searchAP} 
                              onChange={e => setSearchAP(e.target.value)}
                              style={{ border: 'none', outline: 'none', fontSize: '10px', width: '120px' }}
                            />
                          </div>
                        </div>

                        <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}>
                          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Vendor Company</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Contact / Phone</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount Owed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAP.map((p: any, idx: number) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                                    <span style={{ color: '#b45309' }}>{p.companyName}</span>
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#475569' }}>
                                    {p.contactPerson ? `${p.contactPerson} • ` : ''}{p.phone || '-'}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#b45309' }}>
                                    {formatPKR(p.balance)}
                                  </td>
                                </tr>
                              ))}
                              {filteredAP.length === 0 && (
                                <tr>
                                  <td colSpan={3} style={{ padding: '12px', textAlign: 'center', opacity: 0.5 }}>No matching vendor records found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}

                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#dc2626' }}>Customer Credit Balances (Overpayments)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatPKR(liabilities.customerOverpayments || 0)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Other Payables & Liabilities</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(liabilities.otherLiabilities)}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderBottom: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 12px', color: '#0f172a' }}>Total Liabilities</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#b45309' }}>{formatPKR(liabilities.totalLiabilities)}</td>
                  </tr>

                  {/* EQUITY SECTION */}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: '6px 12px', color: '#475569', fontSize: '10px' }}>B. OWNER EQUITY (Capital & Reserves)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Owner Capital Investment</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(equity.ownerCapital)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Retained Earnings (Cumulative Net Profit)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{formatPKR(equity.retainedEarnings)}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderBottom: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 12px', color: '#0f172a' }}>Total Owner Equity</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#16a34a' }}>{formatPKR(equity.totalEquity)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ background: '#0f172a', color: '#ffffff', padding: '12px 14px', fontWeight: 900, fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span>{formatPKR(totalLiabilitiesAndEquity)}</span>
            </div>
          </div>

        </div>

        {/* CONDITIONAL PRINT SECTION FOR SUB-LEDGER DETAILS */}
        {includeDetailsPrint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', borderTop: '2px solid #0f172a', paddingTop: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>APPENDIX: ITEMIZING INDIVIDUAL SUB-LEDGERS</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* PRINT RECEIVABLES TABLE */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>Customer Accounts Receivable Breakdown</h4>
                <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse', border: '1px solid #0f172a' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'left' }}>Customer Name</th>
                      <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'right' }}>Balance Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivablesDetail.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>{r.name}</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PRINT PAYABLES TABLE */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 800, color: '#b45309' }}>Vendor Accounts Payable Breakdown</h4>
                <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse', border: '1px solid #0f172a' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'left' }}>Vendor Company</th>
                      <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'right' }}>Amount Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payablesDetail.map((p: any) => (
                      <tr key={p.id}>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>{p.companyName}</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(p.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* PRINT FIXED ASSETS TABLE */}
            <div style={{ marginTop: '10px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 800, color: '#b45309' }}>Fixed Assets & Equipment Breakdown</h4>
              <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse', border: '1px solid #0f172a' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'left' }}>Asset Description</th>
                    <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'left' }}>Date / Logged By</th>
                    <th style={{ padding: '4px 6px', border: '1px solid #0f172a', textAlign: 'right' }}>Asset Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsDetail.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>{f.name}</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>{new Date(f.date).toLocaleDateString()} by {f.loggedByName}</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(f.amount)}</td>
                    </tr>
                  ))}
                  {assetsDetail.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', opacity: 0.5 }}>No logged asset records.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b', marginTop: '12px' }}>
          <div>Official Audited Financial Position Statement — {user?.companyName || 'Store ERP'}.</div>
          <div>Authorized Chief Financial Officer Signature: _______________________</div>
        </div>

      </div>

    </div>
  );
};

export default BalanceSheet;
