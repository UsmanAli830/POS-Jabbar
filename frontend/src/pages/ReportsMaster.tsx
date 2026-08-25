import React, { useState, useEffect } from 'react';
import { 
  FileText, ShoppingCart, Package, DollarSign, Users, Calendar, 
  Download, Printer, AlertTriangle, Filter, Search, TrendingUp, RefreshCw 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  BarChart, Bar 
} from 'recharts';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import BalanceSheet from './BalanceSheet';

const formatPKR = (num: number) => {
  return `Rs. ${(num || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getMonthStartStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const ReportsMaster: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SALES'|'PURCHASES'|'INVENTORY'|'FINANCIALS'|'BALANCE_SHEET'|'CUSTOMERS_VENDORS'|'PAYROLL'|'RETURNS'>('SALES');
  
  // Date Filters
  const [startDate, setStartDate] = useState(getMonthStartStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  // Data States
  const [salesReport, setSalesReport] = useState<any>(null);
  const [purchaseReport, setPurchaseReport] = useState<any>(null);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [financialReport, setFinancialReport] = useState<any>(null);
  const [customerReport, setCustomerReport] = useState<any[]>([]);
  const [vendorReport, setVendorReport] = useState<any[]>([]);
  const [payrollReport, setPayrollReport] = useState<any>(null);
  const [returnsReport, setReturnsReport] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveTabReport();
  }, [activeTab, startDate, endDate]);

  const fetchActiveTabReport = async () => {
    setLoading(true);
    const qs = `?startDate=${startDate}&endDate=${endDate}`;

    try {
      if (activeTab === 'SALES') {
        const res = await fetch(`http://localhost:3000/api/reports/sales${qs}`);
        if (res.ok) setSalesReport(await res.json());
      } else if (activeTab === 'PURCHASES') {
        const res = await fetch(`http://localhost:3000/api/reports/purchases${qs}`);
        if (res.ok) setPurchaseReport(await res.json());
      } else if (activeTab === 'INVENTORY') {
        const res = await fetch('http://localhost:3000/api/reports/inventory');
        if (res.ok) setInventoryReport(await res.json());
      } else if (activeTab === 'FINANCIALS') {
        const res = await fetch('http://localhost:3000/api/reports/financials');
        if (res.ok) setFinancialReport(await res.json());
      } else if (activeTab === 'CUSTOMERS_VENDORS') {
        const [cRes, vRes] = await Promise.all([
          fetch('http://localhost:3000/api/reports/customers'),
          fetch('http://localhost:3000/api/reports/vendors')
        ]);
        if (cRes.ok) setCustomerReport(await cRes.json());
        if (vRes.ok) setVendorReport(await vRes.json());
      } else if (activeTab === 'PAYROLL') {
        const res = await fetch('http://localhost:3000/api/reports/payroll');
        if (res.ok) setPayrollReport(await res.json());
      } else if (activeTab === 'RETURNS') {
        const res = await fetch(`http://localhost:3000/api/reports/returns${qs}`);
        if (res.ok) setReturnsReport(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch report data', e);
    } finally {
      setLoading(false);
    }
  };

  // CSV Exporters
  const handleExportCSV = () => {
    if (activeTab === 'SALES' && salesReport?.invoices) {
      exportToCSV(`Sales_Report_${startDate}_to_${endDate}`, [
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Date', key: 'date' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Total Amount', key: 'totalAmount' },
        { header: 'Received', key: 'paymentReceived' },
        { header: 'Mode', key: 'paymentMode' }
      ], salesReport.invoices);
    } else if (activeTab === 'PURCHASES' && purchaseReport?.purchases) {
      exportToCSV(`Purchases_Report_${startDate}_to_${endDate}`, [
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Date', key: 'date' },
        { header: 'Vendor', key: 'vendorName' },
        { header: 'Total Amount', key: 'totalAmount' },
        { header: 'Amount Paid', key: 'amountPaid' }
      ], purchaseReport.purchases);
    } else if (activeTab === 'INVENTORY' && inventoryReport?.items) {
      exportToCSV('Inventory_Stock_Report', [
        { header: 'Code', key: 'productCode' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Category', key: 'categoryName' },
        { header: 'Current Stock', key: 'currentStock' },
        { header: 'Min Stock Level', key: 'minStockLevel' },
        { header: 'Purchase Rate', key: 'purchaseRate' },
        { header: 'Valuation', key: 'valuation' },
        { header: 'Status', key: 'status' }
      ], inventoryReport.items);
    } else if (activeTab === 'CUSTOMERS_VENDORS') {
      exportToCSV('Customer_Ledger_Report', [
        { header: 'Customer Name', key: 'name' },
        { header: 'Phone', key: 'phone' },
        { header: 'Opening Balance', key: 'openingBalance' },
        { header: 'Total Purchases', key: 'totalPurchases' },
        { header: 'Current Balance', key: 'currentBalance' }
      ], customerReport);
    }
  };

  const handleExportPDF = () => {
    exportToPDF('report-print-area', `${activeTab}_Report`);
  };

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full p-4">
      
      {/* HEADER & TOP BAR */}
      <div className="mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1 flex items-center gap-2">
            <FileText size={26} className="text-blue-600" /> Enterprise Reports & Analytics
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Live database reports, financial statements, and export control center.
          </p>
        </div>

        {/* Date Filter Bar & Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px' }}>
            <Calendar size={14} style={{ color: '#64748b' }} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '11px', fontWeight: 600 }} />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '11px', fontWeight: 600 }} />
          </div>

          <button onClick={fetchActiveTabReport} className="btn" style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button onClick={handleExportCSV} className="btn" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Download size={13} /> Export CSV
          </button>

          <button onClick={handleExportPDF} className="btn" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Printer size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* REPORT TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px', overflowX: 'auto' }}>
        {[
          { id: 'SALES', label: 'Sales Reports' },
          { id: 'PURCHASES', label: 'Purchase Reports' },
          { id: 'INVENTORY', label: 'Inventory & Stock' },
          { id: 'FINANCIALS', label: 'Financials & P&L' },
          { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
          { id: 'CUSTOMERS_VENDORS', label: 'Customers & Vendors' },
          { id: 'PAYROLL', label: 'HR & Payroll' },
          { id: 'RETURNS', label: 'Returns & Refund' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px', fontSize: '12px', fontWeight: 800,
              border: 'none', borderBottom: activeTab === tab.id ? '3px solid #0284c7' : '3px solid transparent',
              background: activeTab === tab.id ? '#e0f2fe' : 'transparent',
              color: activeTab === tab.id ? '#0369a1' : '#64748b',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT CONTENT VIEW AREA */}
      <div id="report-print-area" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* TAB 8: BALANCE SHEET */}
        {activeTab === 'BALANCE_SHEET' && <BalanceSheet />}

        {/* TAB 1: SALES REPORT */}
        {activeTab === 'SALES' && salesReport && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Net Sales</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{formatPKR(salesReport.summary.totalSales)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Cash/Payments Received</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a' }}>{formatPKR(salesReport.summary.totalReceived)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #b45309' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Discounts Given</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309' }}>{formatPKR(salesReport.summary.totalDiscounts)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #6366f1' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Invoices Generated</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#6366f1' }}>{salesReport.summary.invoiceCount} Bills</div>
              </div>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Sales Trend Over Time</h4>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesReport.salesTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" fontSize={10} stroke="#64748b" />
                      <YAxis fontSize={10} stroke="#64748b" tickFormatter={v => `Rs.${v}`} />
                      <Tooltip formatter={(v: any) => formatPKR(Number(v))} />
                      <Line type="monotone" dataKey="sales" stroke="#0284c7" strokeWidth={3} dot={true} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Top Selling Products (Qty)</h4>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesReport.topProductsByQty} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" fontSize={10} stroke="#64748b" />
                      <YAxis dataKey="name" type="category" fontSize={9} stroke="#64748b" width={80} />
                      <Tooltip />
                      <Bar dataKey="qty" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Sales Invoices Detail List</h4>
              <div className="data-table-container">
                <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date & Time</th>
                      <th>Customer Name</th>
                      <th style={{ textAlign: 'center' }}>Items</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                      <th style={{ textAlign: 'right' }}>Received</th>
                      <th style={{ textAlign: 'center' }}>Payment Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReport.invoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                        <td>{new Date(inv.date).toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                        <td style={{ textAlign: 'center' }}>{inv.itemCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatPKR(inv.totalAmount)}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{formatPKR(inv.paymentReceived)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{inv.paymentMode}</td>
                      </tr>
                    ))}
                    {salesReport.invoices.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>No sales invoices found for selected date range</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: PURCHASE REPORT */}
        {activeTab === 'PURCHASES' && purchaseReport && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Purchases</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{formatPKR(purchaseReport.summary.totalPurchases)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Paid to Vendors</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a' }}>{formatPKR(purchaseReport.summary.totalPaid)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #b45309' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Vendor Dues Remaining</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309' }}>{formatPKR(purchaseReport.summary.totalRemaining)}</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Purchase Orders List</h4>
              <div className="data-table-container">
                <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Purchase Ref #</th>
                      <th>Date</th>
                      <th>Vendor Company</th>
                      <th style={{ textAlign: 'center' }}>Items</th>
                      <th style={{ textAlign: 'right' }}>Total Bill</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseReport.purchases.map((p: any) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{p.invoiceNumber}</td>
                        <td>{new Date(p.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{p.vendorName}</td>
                        <td style={{ textAlign: 'center' }}>{p.itemCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatPKR(p.totalAmount)}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{formatPKR(p.amountPaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: INVENTORY REPORT */}
        {activeTab === 'INVENTORY' && inventoryReport && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Products</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{inventoryReport.summary.totalProducts} SKUs</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Inventory Valuation</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a' }}>{formatPKR(inventoryReport.summary.totalValuation)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #b45309' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Low Stock Warning</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309' }}>{inventoryReport.summary.lowStockCount} Items</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Danger Stock Level</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#dc2626' }}>{inventoryReport.summary.dangerStockCount} Critical</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Stock Level & Valuation Table</h4>
              <div className="data-table-container">
                <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Product Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>Current Stock</th>
                      <th style={{ textAlign: 'center' }}>Min Level</th>
                      <th style={{ textAlign: 'right' }}>Cost Price</th>
                      <th style={{ textAlign: 'right' }}>Total Valuation</th>
                      <th style={{ textAlign: 'center' }}>Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryReport.items.map((item: any) => {
                      const isDanger = item.status === 'DANGER';
                      const isLow = item.status === 'LOW_STOCK';
                      const bg = isDanger ? '#fef2f2' : (isLow ? '#fffbeb' : '#ffffff');
                      const statusColor = isDanger ? '#dc2626' : (isLow ? '#b45309' : '#16a34a');

                      return (
                        <tr key={item.id} style={{ background: bg }}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.productCode || '-'}</td>
                          <td style={{ fontWeight: 700 }}>{item.productName}</td>
                          <td>{item.categoryName}</td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: statusColor }}>{item.currentStock}</td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{item.minStockLevel}</td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(item.purchaseRate)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatPKR(item.valuation)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, background: isDanger ? '#fee2e2' : (isLow ? '#fef3c7' : '#dcfce7'), color: statusColor }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 4: FINANCIALS REPORT */}
        {activeTab === 'FINANCIALS' && financialReport && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Accounts Receivable (AR)</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7' }}>{formatPKR(financialReport.summary.totalAR)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #b45309' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Accounts Payable (AP)</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309' }}>{formatPKR(financialReport.summary.totalAP)}</div>
              </div>
              <div className="glass-panel" style={{ padding: '14px', background: '#ffffff', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Net Profit / Loss</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: financialReport.summary.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatPKR(financialReport.summary.netProfit)}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>30-Day Revenue vs Expenses Statement</h4>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={financialReport.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" fontSize={10} stroke="#64748b" />
                    <YAxis fontSize={10} stroke="#64748b" tickFormatter={v => `Rs.${v}`} />
                    <Tooltip formatter={(v: any) => formatPKR(Number(v))} />
                    <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* TAB 5: CUSTOMERS & VENDORS */}
        {activeTab === 'CUSTOMERS_VENDORS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Customer Accounts Summary</h4>
              <div className="data-table-container">
                <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Phone</th>
                      <th style={{ textAlign: 'right' }}>Total Sales</th>
                      <th style={{ textAlign: 'right' }}>Live Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerReport.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td>{c.phone}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPKR(c.totalPurchases)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: c.currentBalance > 0 ? '#dc2626' : '#16a34a' }}>
                          {formatPKR(c.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Vendor Accounts Summary</h4>
              <div className="data-table-container">
                <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Vendor Name</th>
                      <th>Phone</th>
                      <th style={{ textAlign: 'right' }}>Purchases</th>
                      <th style={{ textAlign: 'right' }}>Live Dues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorReport.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 700 }}>{v.name}</td>
                        <td>{v.phone}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPKR(v.totalPurchases)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: v.currentBalance > 0 ? '#b45309' : '#16a34a' }}>
                          {formatPKR(v.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: HR & PAYROLL */}
        {activeTab === 'PAYROLL' && payrollReport && (
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Monthly Payroll Statement</h4>
            <div className="data-table-container">
              <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Base Salary</th>
                    <th style={{ textAlign: 'right' }}>Bonus</th>
                    <th style={{ textAlign: 'right' }}>Deductions</th>
                    <th style={{ textAlign: 'right' }}>Net Salary</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollReport.employees.map((emp: any) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 700 }}>{emp.name}</td>
                      <td>{emp.role}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(emp.baseSalary)}</td>
                      <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatPKR(emp.bonus)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{formatPKR(emp.deductions)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatPKR(emp.netSalary)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{emp.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: RETURNS REPORT */}
        {activeTab === 'RETURNS' && returnsReport && (
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Sales Return Transactions</h4>
            <div className="data-table-container">
              <table className="data-table" style={{ width: '100%', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th>Return Ref #</th>
                    <th>Return Date</th>
                    <th style={{ textAlign: 'right' }}>Total Refund</th>
                    <th style={{ textAlign: 'right' }}>Cash Returned</th>
                    <th style={{ textAlign: 'right' }}>Adjusted in Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsReport.salesReturns.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.returnRef}</td>
                      <td>{new Date(r.date).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>{formatPKR(r.amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(r.cashReturned)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(r.adjustedInBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportsMaster;
