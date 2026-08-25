import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Package, AlertTriangle, 
  Printer, Percent, MapPin, Layers, ChevronRight, Award, ShoppingBag, Search, RefreshCw
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';

const formatPKR = (num: number) => {
  return `Rs. ${(num || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getMonthStartStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const SalesAnalysis: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'customers' | 'losses' | 'routes'>('products');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date States
  const [startDate, setStartDate] = useState(getMonthStartStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState<any>({
    topProducts: [],
    topCustomers: [],
    underCostItems: [],
    discountLeakage: [],
    routeAnalytics: [],
    zoneAnalytics: []
  });

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef
  });

  const fetchDeepAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      });
      const res = await fetch(`http://localhost:3000/api/analytics/sales-deep?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch Deep Sales Analysis data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeepAnalysis();
  }, [startDate, endDate]);

  // Client-Side Search Filters
  const filteredProducts = data.topProducts.filter((p: any) => 
    p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = data.topCustomers.filter((c: any) => 
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.topProducts && c.topProducts.some((tp: string) => tp.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const filteredUnderCostItems = data.underCostItems.filter((item: any) => 
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDiscountLeakage = data.discountLeakage.filter((item: any) => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRouteAnalytics = data.routeAnalytics.filter((r: any) => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredZoneAnalytics = data.zoneAnalytics.filter((z: any) => 
    z.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary Metrics based on base data (keeping KPIs in sync with date duration, unaffected by client-side text searches)
  const bestSellingProduct = data.topProducts[0] || null;
  const totalUnderCostLoss = data.underCostItems.reduce((acc: number, item: any) => acc + (item.lossAmount || 0), 0);
  const totalDiscountsGiven = data.discountLeakage.reduce((acc: number, item: any) => acc + (item.totalDiscounts || 0), 0);
  const totalSalesFromProducts = data.topProducts.reduce((acc: number, item: any) => acc + (item.salesValue || 0), 0);
  const totalProfitFromProducts = data.topProducts.reduce((acc: number, item: any) => acc + (item.netProfit || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Analyzing Sales Ledger & Database Aggregations...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', margin: '20px', color: '#b91c1c' }}>
        <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}><AlertTriangle /> Data Loading Error</h3>
        <p style={{ margin: 0 }}>{error}</p>
        <button onClick={fetchDeepAnalysis} style={{ marginTop: '12px', padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '20px', padding: '16px' }}>
      
      {/* Styles for print & elements */}
      <style>{`
        @media screen {
          .print-only-container {
            display: none !important;
          }
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only-container {
            display: block !important;
            padding: 30px;
            color: #000 !important;
            background: #fff !important;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size: 11px;
          }
          .print-table th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .print-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .print-section-title {
            font-size: 14px;
            font-weight: bold;
            margin-top: 24px;
            margin-bottom: 8px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 4px;
          }
        }

        .tab-btn {
          padding: 8px 16px;
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tab-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .tab-btn.active {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
          box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .data-table th {
          background: #f8fafc;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        .data-table td {
          padding: 12px 16px;
          font-size: 13px;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
        }
        .data-table tbody tr:hover {
          background: #f8fafc;
        }

        .tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          margin-right: 4px;
          margin-bottom: 4px;
        }
        .tag-info {
          background: #e0f2fe;
          color: #0369a1;
        }
        .tag-danger {
          background: #fee2e2;
          color: #b91c1c;
        }
        .tag-warning {
          background: #fef3c7;
          color: #d97706;
        }

        .filter-input {
          height: 32px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          padding: 0 10px;
          font-size: 12px;
          color: #1e293b;
          outline: none;
          background: #ffffff;
        }
        .filter-input:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
      `}</style>

      {/* Screen view layout */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={28} color="#0284c7" />
              Sales & Profitability Analysis
            </h1>
            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Deep database aggregations tracking top products, customer behaviors, geographic performance, and loss prevention.
            </p>
          </div>
          <button 
            onClick={handlePrint}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 18px', 
              background: '#0284c7', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: 700, 
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#0369a1'}
            onMouseOut={e => e.currentTarget.style.background = '#0284c7'}
          >
            <Printer size={16} /> Print Analysis Report
          </button>
        </div>

        {/* SEARCH AND DATE DURATION CONTROL PANEL */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Start Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Date</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="filter-input"
              />
            </div>

            {/* End Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End Date</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="filter-input"
              />
            </div>

            {/* Reload Button */}
            <button 
              onClick={fetchDeepAnalysis}
              style={{ 
                height: '32px', 
                marginTop: '18px', 
                padding: '0 12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                background: '#ffffff'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '320px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search Analysis</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Search products, categories, customers, invoices..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="filter-input"
                style={{ width: '100%', paddingLeft: '32px' }}
              />
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
            </div>
          </div>
        </div>

        {/* HERO CARDS SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          
          {/* Best Selling Product Card */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>Best Selling Product</span>
              <Award size={18} />
            </div>
            {bestSellingProduct ? (
              <>
                <div style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {bestSellingProduct.productName}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  Sold: <strong>{bestSellingProduct.qtySold} Units</strong> | Profit: <strong>{formatPKR(bestSellingProduct.netProfit)}</strong>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '14px', margin: '12px 0' }}>No products sold yet</div>
            )}
          </div>

          {/* Cumulative Profit Card */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <DollarSign size={14} style={{ color: '#10b981' }} /> Cumulative Gross Profit
            </div>
            <div style={{ color: '#0f172a', fontSize: '22px', fontWeight: 900, margin: '8px 0 4px' }}>
              {formatPKR(totalProfitFromProducts)}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
              Gross Sales Margin: {totalSalesFromProducts > 0 ? ((totalProfitFromProducts / totalSalesFromProducts) * 100).toFixed(1) : '0'}%
            </div>
          </div>

          {/* Under-cost Loss Card */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <AlertTriangle size={14} style={{ color: '#ef4444' }} /> Total Under-Cost Losses
            </div>
            <div style={{ color: totalUnderCostLoss > 0 ? '#ef4444' : '#1e293b', fontSize: '22px', fontWeight: 900, margin: '8px 0 4px' }}>
              {formatPKR(totalUnderCostLoss)}
            </div>
            <div style={{ fontSize: '11px', color: totalUnderCostLoss > 0 ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
              {filteredUnderCostItems.length} transactions flagged at loss
            </div>
          </div>

          {/* Discount Leakage Card */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <Percent size={14} style={{ color: '#f59e0b' }} /> Total Discounts Given
            </div>
            <div style={{ color: '#0f172a', fontSize: '22px', fontWeight: 900, margin: '8px 0 4px' }}>
              {formatPKR(totalDiscountsGiven)}
            </div>
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>
              Discounts leaked from cash/credit invoices
            </div>
          </div>

        </div>

        {/* NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <button 
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Package size={16} /> Product Performance
          </button>
          <button 
            className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={16} /> Customer Insights
          </button>
          <button 
            className={`tab-btn ${activeTab === 'losses' ? 'active' : ''}`}
            onClick={() => setActiveTab('losses')}
            style={filteredUnderCostItems.length > 0 ? { border: '1px solid #fecaca', background: activeTab === 'losses' ? '#dc2626' : '#fef2f2', color: activeTab === 'losses' ? '#fff' : '#b91c1c' } : {}}
          >
            <AlertTriangle size={16} /> Loss & Leakage Tracker
            {filteredUnderCostItems.length > 0 && (
              <span style={{ padding: '2px 6px', background: activeTab === 'losses' ? '#fff' : '#ef4444', color: activeTab === 'losses' ? '#b91c1c' : '#fff', fontSize: '10px', borderRadius: '10px', fontWeight: 'bold' }}>
                {filteredUnderCostItems.length}
              </span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
            onClick={() => setActiveTab('routes')}
          >
            <MapPin size={16} /> Route Profitability
          </button>
        </div>

        {/* TAB CONTENTS */}
        
        {/* Tab 1: Product Performance */}
        {activeTab === 'products' && (
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Top Products by Net Profit Contribution</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Total Qty Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                    <th style={{ textAlign: 'right' }}>Profit Generated</th>
                    <th style={{ textAlign: 'right' }}>Profit Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p: any, idx: number) => {
                    const isBestSeller = idx === 0;
                    return (
                      <tr key={p.productId} style={isBestSeller ? { background: '#f0f9ff' } : {}}>
                        <td style={{ fontWeight: 600 }}>
                          {isBestSeller && <span className="tag tag-info" style={{ marginRight: '6px' }}>Best Seller</span>}
                          {p.productName}
                        </td>
                        <td>{p.categoryName}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.qtySold}</td>
                        <td style={{ textAlign: 'right' }}>{formatPKR(p.salesValue)}</td>
                        <td style={{ textAlign: 'right', color: p.netProfit >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                          {formatPKR(p.netProfit)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: p.marginPercent >= 20 ? '#16a34a' : p.marginPercent >= 5 ? '#d97706' : '#ef4444' }}>
                          {p.marginPercent.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>No matching products found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Customer Insights */}
        {activeTab === 'customers' && (
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Customer Purchase Power & Margin Contribution</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th style={{ textAlign: 'right' }}>Total Purchases (Net)</th>
                    <th style={{ textAlign: 'right' }}>Net Profit Contribution</th>
                    <th>Top 3 Purchased Products (by Quantity)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c: any) => (
                    <tr key={c.customerId}>
                      <td style={{ fontWeight: 600 }}>{c.customerName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPKR(c.totalBilling)}</td>
                      <td style={{ textAlign: 'right', color: c.totalProfit >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                        {formatPKR(c.totalProfit)}
                      </td>
                      <td>
                        {c.topProducts && c.topProducts.length > 0 ? (
                          c.topProducts.map((pName: string, i: number) => (
                            <span key={i} className="tag tag-info">
                              {pName}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>No matching customer transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Loss & Leakage Tracker */}
        {activeTab === 'losses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* UNDER COST LOSSES PANEL */}
            <div className="glass-panel" style={{ overflow: 'hidden', border: '1px solid #fee2e2' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #fecaca', background: '#fef2f2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle color="#dc2626" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>Under-Cost Flagged Sales (Loss-making Items)</h3>
                  <span style={{ fontSize: '12px', color: '#b91c1c' }}>Transactions where net billing rate is lower than the product cost price.</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#fdf2f2' }}>
                      <th>Date</th>
                      <th>Invoice ID</th>
                      <th>Product</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Cost Price</th>
                      <th style={{ textAlign: 'right' }}>Net Selling Rate</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Total Net Sale</th>
                      <th style={{ textAlign: 'right', color: '#b91c1c' }}>Net Loss Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnderCostItems.map((item: any) => (
                      <tr key={item.id} style={{ background: '#fff5f5' }}>
                        <td>{new Date(item.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{item.invoiceNumber}</td>
                        <td style={{ fontWeight: 600 }}>{item.productName}</td>
                        <td>
                          <span className="tag tag-warning">{item.customerName}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatPKR(item.costPrice)}</td>
                        <td style={{ textAlign: 'right', color: '#b91c1c', fontWeight: 600 }}>{formatPKR(item.sellingPrice)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatPKR(item.netAmount)}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 800 }}>{formatPKR(item.lossAmount)}</td>
                      </tr>
                    ))}
                    {filteredUnderCostItems.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold', padding: '24px' }}>No under-cost transactions detected for the query.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DISCOUNT LEAKAGE ROW */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Discount Leakage Analysis (Top Discount Recipients)</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Customers receiving the highest amount of flat discounts.</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Customer Name</th>
                      <th style={{ textAlign: 'right' }}>Total Discounts Given</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiscountLeakage.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: '#64748b' }}>#{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 700 }}>{formatPKR(item.totalDiscounts)}</td>
                      </tr>
                    ))}
                    {filteredDiscountLeakage.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>No discounts recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Route Profitability */}
        {activeTab === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Custom Tooltips for Route & Zone charts */}
            {(() => {
              const CustomRouteTooltip = ({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const val = payload[0].payload;
                  return (
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                        {val.name} <span style={{ fontWeight: 500, color: '#64748b' }}>(Parent: {val.parentZoneName})</span>
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                        Total Sales: {formatPKR(val.sales)}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        Net Profit: {formatPKR(val.profit)}
                      </p>
                    </div>
                  );
                }
                return null;
              };

              const CustomZoneTooltip = ({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const val = payload[0].payload;
                  const routesList = val.contributingRoutes || [];
                  return (
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxWidth: '320px' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                        {val.name}: {formatPKR(val.sales)}
                      </p>
                      {routesList.length > 0 ? (
                        <>
                          <p style={{ margin: '4px 0 2px 0', fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Contributing Routes:
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '10px', color: '#334155', listStyleType: 'disc' }}>
                            {routesList.map((rc: any, idx: number) => (
                              <li key={idx} style={{ marginBottom: '2px' }}>
                                <strong>{rc.routeName}</strong>: {formatPKR(rc.sales)} (Profit: {formatPKR(rc.profit)})
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>No routes assigned</p>
                      )}
                      <p style={{ marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '4px', margin: 0, fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                        Total Profit: {formatPKR(val.profit)}
                      </p>
                    </div>
                  );
                }
                return null;
              };

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                  
                  {/* Route Performance */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={18} color="#0284c7" /> Sales & Net Profit by Route
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
                      Breaks down sales performance by individual delivery paths (routes).
                    </p>
                    <div style={{ width: '100%', height: 300 }}>
                      {filteredRouteAnalytics.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredRouteAnalytics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                            <YAxis stroke="#64748b" fontSize={11} tickFormatter={val => `Rs.${val}`} />
                            <Tooltip content={<CustomRouteTooltip />} />
                            <Legend />
                            <Bar dataKey="sales" name="Total Sales" fill="#0284c7" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>No route transactions found.</div>
                      )}
                    </div>
                  </div>

                  {/* Zone Performance */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={18} color="#8b5cf6" /> Sales & Net Profit by Zone
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
                      Aggregates total sales by geographical regions (zones). A single zone includes multiple routes.
                    </p>
                    <div style={{ width: '100%', height: 300 }}>
                      {filteredZoneAnalytics.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredZoneAnalytics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                            <YAxis stroke="#64748b" fontSize={11} tickFormatter={val => `Rs.${val}`} />
                            <Tooltip content={<CustomZoneTooltip />} />
                            <Legend />
                            <Bar dataKey="sales" name="Total Sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="profit" name="Net Profit" fill="#ec4899" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>No zone transactions found.</div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Geographical Performance Summary Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Route & Zone Geographical Matrix</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Geography Name</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Total Sales</th>
                      <th style={{ textAlign: 'right' }}>Net Profit</th>
                      <th style={{ textAlign: 'right' }}>Profit Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRouteAnalytics.map((r: any) => (
                      <tr key={`route-${r.name}`}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td><span className="tag tag-info">Route</span></td>
                        <td style={{ textAlign: 'right' }}>{formatPKR(r.sales)}</td>
                        <td style={{ textAlign: 'right', color: r.profit >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{formatPKR(r.profit)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {r.sales > 0 ? ((r.profit / r.sales) * 100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    ))}
                    {filteredZoneAnalytics.map((z: any) => (
                      <tr key={`zone-${z.name}`}>
                        <td style={{ fontWeight: 600 }}>{z.name}</td>
                        <td><span className="tag tag-warning">Zone</span></td>
                        <td style={{ textAlign: 'right' }}>{formatPKR(z.sales)}</td>
                        <td style={{ textAlign: 'right', color: z.profit >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{formatPKR(z.profit)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {z.sales > 0 ? ((z.profit / z.sales) * 100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    ))}
                    {filteredRouteAnalytics.length === 0 && filteredZoneAnalytics.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>No geographical data matching filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* PRINT-ONLY AREA TARGETED BY REACT-TO-PRINT */}
      <div ref={printRef} className="print-only-container">
        <div className="print-header">
          <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 'bold' }}>{user?.companyName || 'Corporate ERP'}</h1>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'normal', color: '#555' }}>Sales & Profitability Analysis Report</h2>
          <p style={{ margin: 0, fontSize: '10px', color: '#888' }}>
            Date Duration: {startDate} to {endDate}
          </p>
          <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>
            Report Generated On: {new Date().toLocaleString()} {searchQuery ? `| Searched for: "${searchQuery}"` : ''}
          </p>
        </div>

        {/* Summary Card Values */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
          <div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#777' }}>Cumulative Profit</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '3px 0' }}>{formatPKR(totalProfitFromProducts)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#777' }}>Total Under-Cost Losses</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: totalUnderCostLoss > 0 ? '#b91c1c' : '#000', margin: '3px 0' }}>{formatPKR(totalUnderCostLoss)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#777' }}>Total Discounts Given</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '3px 0' }}>{formatPKR(totalDiscountsGiven)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#777' }}>Best Seller</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', margin: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bestSellingProduct ? bestSellingProduct.productName : 'N/A'}
            </div>
          </div>
        </div>

        {/* 1. TOP PRODUCTS TABLE */}
        <div className="print-section-title">I. Product Profitability Aggregations</div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Qty Sold</th>
              <th style={{ textAlign: 'right' }}>Gross Revenue</th>
              <th style={{ textAlign: 'right' }}>Net Profit</th>
              <th style={{ textAlign: 'right' }}>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p: any) => (
              <tr key={p.productId}>
                <td style={{ fontWeight: 'bold' }}>{p.productName}</td>
                <td>{p.categoryName}</td>
                <td style={{ textAlign: 'right' }}>{p.qtySold}</td>
                <td style={{ textAlign: 'right' }}>{formatPKR(p.salesValue)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(p.netProfit)}</td>
                <td style={{ textAlign: 'right' }}>{p.marginPercent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 2. TOP CUSTOMERS TABLE */}
        <div className="print-section-title">II. Customer Purchases & Profit Impact</div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th style={{ textAlign: 'right' }}>Total Purchases (Net)</th>
              <th style={{ textAlign: 'right' }}>Profit Contribution</th>
              <th>Top Purchased Products</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c: any) => (
              <tr key={c.customerId}>
                <td style={{ fontWeight: 'bold' }}>{c.customerName}</td>
                <td style={{ textAlign: 'right' }}>{formatPKR(c.totalBilling)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(c.totalProfit)}</td>
                <td>{c.topProducts ? c.topProducts.join(', ') : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 3. LOSS & DISCOUNTS REPORT */}
        <div className="print-section-title">III. Leakage & Risk Audit Report</div>
        
        <h4 style={{ fontSize: '11px', margin: '12px 0 6px 0', color: '#b91c1c' }}>Flagged Under-Cost (Loss-making) Invoices</h4>
        <table className="print-table">
          <thead>
            <tr style={{ backgroundColor: '#fee2e2' }}>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Product</th>
              <th>Customer</th>
              <th style={{ textAlign: 'right' }}>Cost Price</th>
              <th style={{ textAlign: 'right' }}>Sale Rate</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Loss Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredUnderCostItems.map((item: any) => (
              <tr key={item.id}>
                <td>{new Date(item.date).toLocaleDateString()}</td>
                <td>{item.invoiceNumber}</td>
                <td style={{ fontWeight: 'bold' }}>{item.productName}</td>
                <td>{item.customerName}</td>
                <td style={{ textAlign: 'right' }}>{formatPKR(item.costPrice)}</td>
                <td style={{ textAlign: 'right' }}>{formatPKR(item.sellingPrice)}</td>
                <td style={{ textAlign: 'right' }}>{item.qty}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>{formatPKR(item.lossAmount)}</td>
              </tr>
            ))}
            {filteredUnderCostItems.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'green', fontSize: '10px' }}>No under-cost sales transactions detected.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h4 style={{ fontSize: '11px', margin: '12px 0 6px 0', color: '#d97706' }}>Highest Invoice Discounts Leakage (Top Customers)</h4>
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Rank</th>
              <th>Customer Name</th>
              <th style={{ textAlign: 'right' }}>Total Discounts Given</th>
            </tr>
          </thead>
          <tbody>
            {filteredDiscountLeakage.map((item: any, idx: number) => (
              <tr key={idx}>
                <td>#{idx + 1}</td>
                <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#d97706' }}>{formatPKR(item.totalDiscounts)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '40px', borderTop: '1px solid #ddd', paddingTop: '10px', fontSize: '9px', color: '#777', textAlign: 'center' }}>
          End of Deep Profitability & Loss Mitigation Report. Confidential.
        </div>
      </div>

    </div>
  );
};

export default SalesAnalysis;
