import React, { useState, useEffect, useRef } from 'react';
import { 
  CircleDollarSign, Calendar, Download, Printer, RefreshCw, 
  TrendingUp, TrendingDown, Users, Truck, Filter, ArrowUpRight, ArrowDownRight 
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

const ProfitLossReport: React.FC = () => {
  const { user } = useAuth();
  // Filter States
  const [startDate, setStartDate] = useState(getMonthStartStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'date' | 'customer' | 'vendor'>('date');

  // Option List States
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Report Data State
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef
  });

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchProfitLossReport();
  }, [startDate, endDate, selectedCustomer, selectedVendor, groupBy]);

  const fetchOptions = async () => {
    try {
      const [cRes, vRes] = await Promise.all([
        fetch('http://localhost:3000/api/reports/customers'),
        fetch('http://localhost:3000/api/reports/vendors')
      ]);
      if (cRes.ok) setCustomers(await cRes.json());
      if (vRes.ok) setVendors(await vRes.json());
    } catch (e) {
      console.error('Failed to fetch filter options', e);
    }
  };

  const fetchProfitLossReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy
      });

      if (selectedCustomer) params.append('customerId', selectedCustomer);
      if (selectedVendor) params.append('vendorId', selectedVendor);

      const res = await fetch(`http://localhost:3000/api/reports/profit-loss?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (e) {
      console.error('Failed to fetch profit & loss report', e);
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!reportData?.gridData) return;

    let headers: { header: string; key: string }[] = [];
    if (groupBy === 'date') {
      headers = [
        { header: 'Date', key: 'date' },
        { header: 'Sales Count', key: 'salesCount' },
        { header: 'Total Revenue', key: 'totalRevenue' },
        { header: 'Total Cost (COGS)', key: 'totalCost' },
        { header: 'Gross Profit', key: 'grossProfit' },
        { header: 'Expenses', key: 'expenses' },
        { header: 'Net Profit', key: 'netProfit' }
      ];
    } else if (groupBy === 'customer') {
      headers = [
        { header: 'Customer Name', key: 'customerName' },
        { header: 'Phone', key: 'phone' },
        { header: 'Total Purchased', key: 'totalPurchased' },
        { header: 'Cash Paid', key: 'cashPaid' },
        { header: 'Returns Value', key: 'returnsValue' },
        { header: 'COGS', key: 'cogs' },
        { header: 'Net Profit Generated', key: 'netProfitGenerated' }
      ];
    } else if (groupBy === 'vendor') {
      headers = [
        { header: 'Vendor Name', key: 'vendorName' },
        { header: 'Stock Purchased', key: 'stockPurchased' },
        { header: 'Stock Sold Revenue', key: 'stockSold' },
        { header: 'Purchase Returns', key: 'purchaseReturns' },
        { header: 'Vendor Profit Margin', key: 'vendorMargin' }
      ];
    }

    exportToCSV(`Profit_Loss_Report_${groupBy}_${startDate}_to_${endDate}`, headers, reportData.gridData);
  };

  // PDF Export
  const handleExportPDF = () => {
    exportToPDF('pnl-statement-print-area', `Ammad_Sanitary_PNL_Statement_${startDate}_to_${endDate}`);
  };

  const summary = reportData?.summary || {
    totalSalesRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    totalExpenses: 0,
    netProfit: 0
  };

  const isNetProfitPositive = summary.netProfit >= 0;

  return (
    <div className="page-wrapper space-y-6 flex flex-col min-h-screen w-full overflow-y-auto p-4 pb-16">
      
      {/* TOP HEADER BAR */}
      <div className="no-print mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1 flex items-center gap-2">
            <CircleDollarSign size={26} className="text-emerald-600" /> Sales, Profit & Loss Analytics
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Multi-axis financial analysis engine with live COGS, Margins, and Customer/Vendor profitability statements.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={fetchProfitLossReport} className="btn" style={{ padding: '7px 12px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button onClick={handleExportCSV} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <Download size={14} /> Export CSV
          </button>

          <button onClick={() => handlePrint()} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 800, background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <Printer size={14} /> Print Receipt Statement
          </button>

          <button onClick={handleExportPDF} className="btn" style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="glass-panel no-print" style={{ padding: '14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
        
        {/* Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 10px' }}>
          <Calendar size={15} style={{ color: '#64748b' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>From:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 600 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>To:</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 600 }} />
        </div>

        {/* Customer Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={15} style={{ color: '#64748b' }} />
          <select 
            value={selectedCustomer} 
            onChange={e => setSelectedCustomer(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', outline: 'none' }}
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Vendor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Truck size={15} style={{ color: '#64748b' }} />
          <select 
            value={selectedVendor} 
            onChange={e => setSelectedVendor(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', outline: 'none' }}
          >
            <option value="">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Group By Selector */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          {[
            { id: 'date', label: 'Datewise' },
            { id: 'customer', label: 'Customerwise' },
            { id: 'vendor', label: 'Vendorwise' }
          ].map(g => (
            <button
              key={g.id}
              onClick={() => setGroupBy(g.id as any)}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                borderRadius: '4px',
                background: groupBy === g.id ? '#0284c7' : 'transparent',
                color: groupBy === g.id ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* PRINTABLE STATEMENT RECEIPT CONTAINER */}
      <div 
        ref={printRef}
        id="pnl-statement-print-area" 
        className="printable-area"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
      >
        
        {/* RECEIPT FORMAL HEADER */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {user?.companyName || 'Corporate ERP'}
            </h2>
            <h4 style={{ margin: '2px 0 0', fontSize: '13px', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase' }}>
              OFFICIAL PROFIT & LOSS STATEMENT ({groupBy.toUpperCase()} ANALYSIS)
            </h4>
            {user?.companyAddress && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{user.companyAddress}</p>}
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
            <div><strong>Statement Period:</strong> {startDate} to {endDate}</div>
            <div><strong>Generated On:</strong> {new Date().toLocaleString()}</div>
            <div><strong>Status:</strong> AUDITED REAL-TIME</div>
          </div>
        </div>

        {/* TOP SUMMARY CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #0284c7', borderRadius: '6px', border: '1px solid #e2e8f0', borderLeftWidth: '4px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Sales Revenue</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{formatPKR(summary.totalSalesRevenue)}</div>
          </div>

          <div style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #b45309', borderRadius: '6px', border: '1px solid #e2e8f0', borderLeftWidth: '4px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Cost of Goods Sold (COGS)</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309', marginTop: '4px' }}>{formatPKR(summary.totalCOGS)}</div>
          </div>

          <div style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #64748b', borderRadius: '6px', border: '1px solid #e2e8f0', borderLeftWidth: '4px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Operating Expenses</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#475569', marginTop: '4px' }}>{formatPKR(summary.totalExpenses)}</div>
          </div>

          <div style={{ padding: '14px', background: isNetProfitPositive ? '#f0fdf4' : '#fef2f2', borderLeft: `4px solid ${isNetProfitPositive ? '#16a34a' : '#dc2626'}`, borderRadius: '6px', border: `1px solid ${isNetProfitPositive ? '#bbf7d0' : '#fecaca'}`, borderLeftWidth: '4px' }}>
            <div style={{ fontSize: '11px', color: isNetProfitPositive ? '#166534' : '#991b1b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isNetProfitPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />} Net Profit / Loss
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: isNetProfitPositive ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
              {formatPKR(summary.netProfit)}
            </div>
          </div>
        </div>

        {/* MAIN REPORT DATA GRID TABLE */}
        <div style={{ marginTop: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: '#0284c7' }} /> Detailed Breakdown ({groupBy === 'date' ? 'Datewise Statement' : (groupBy === 'customer' ? 'Customer Profitability List' : 'Vendor Margin Analysis')})
          </h3>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  {groupBy === 'date' && (
                    <>
                      <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                      <th className="min-w-[90px]" style={{ padding: '8px 12px', textAlign: 'center' }}>Invoices</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Total Revenue</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>COGS</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Gross Profit</th>
                      <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Expenses</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Net Profit</th>
                    </>
                  )}

                  {groupBy === 'customer' && (
                    <>
                      <th className="min-w-[180px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Rank & Customer Name</th>
                      <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Phone</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Total Purchased</th>
                      <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Cash Paid</th>
                      <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Returns Value</th>
                      <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'right' }}>COGS</th>
                      <th className="min-w-[140px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Net Profit Generated</th>
                    </>
                  )}

                  {groupBy === 'vendor' && (
                    <>
                      <th className="min-w-[180px]" style={{ padding: '8px 12px', textAlign: 'left' }}>Vendor Company</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Stock Purchased</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Stock Sold Revenue</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Purchase Returns</th>
                      <th className="min-w-[130px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Vendor Cost</th>
                      <th className="min-w-[140px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Vendor Profit Margin</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {reportData?.gridData?.map((row: any, idx: number) => {
                  if (groupBy === 'date') {
                    const isPos = row.netProfit >= 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{row.date}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.salesCount}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatPKR(row.totalRevenue)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b45309' }}>{formatPKR(row.totalCost)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(row.grossProfit)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{formatPKR(row.expenses)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: isPos ? '#16a34a' : '#dc2626' }}>
                          {formatPKR(row.netProfit)}
                        </td>
                      </tr>
                    );
                  }

                  if (groupBy === 'customer') {
                    const isProf = row.netProfitGenerated >= 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx === 0 ? '#f0fdf4' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          <span style={{ fontSize: '10px', color: '#64748b', marginRight: '6px' }}>#{idx + 1}</span>
                          {row.customerName}
                          {idx === 0 && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>MOST PROFITABLE</span>}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.phone || '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(row.totalPurchased)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a' }}>{formatPKR(row.cashPaid)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>{formatPKR(row.returnsValue)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b45309' }}>{formatPKR(row.cogs)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: isProf ? '#16a34a' : '#dc2626' }}>
                          {formatPKR(row.netProfitGenerated)}
                        </td>
                      </tr>
                    );
                  }

                  if (groupBy === 'vendor') {
                    const isMarginPos = row.vendorMargin >= 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{row.vendorName}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0284c7' }}>{formatPKR(row.stockPurchased)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(row.stockSold)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>{formatPKR(row.purchaseReturns)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b45309' }}>{formatPKR(row.vendorCost)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: isMarginPos ? '#16a34a' : '#dc2626' }}>
                          {formatPKR(row.vendorMargin)}
                        </td>
                      </tr>
                    );
                  }

                  return null;
                })}

                {(!reportData?.gridData || reportData.gridData.length === 0) && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', opacity: 0.5 }}>
                      No data recorded for the selected filter parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* STATEMENT FOOTER */}
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b', marginTop: '12px' }}>
          <div>Official computer-generated Profit & Loss Audit Statement of {user?.companyName || 'Store ERP'}.</div>
          <div>Authorized Signature: _______________________</div>
        </div>

      </div>

    </div>
  );
};

export default ProfitLossReport;
