import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  CreditCard,
  Package,
  Activity,
  AlertTriangle,
  ShoppingBag
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar
} from 'recharts';

const Dashboard: React.FC = () => {
  const [kpis, setKpis] = useState({
    todaySalesTotal: 0,
    todayInvoicesCount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalAR: 0,
    totalAP: 0,
    lowStockCount: 0,
    totalProducts: 0
  });

  const [revExpData, setRevExpData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [kpiRes, revExpRes, prodRes] = await Promise.all([
        fetch('http://localhost:3000/api/analytics/kpis'),
        fetch('http://localhost:3000/api/analytics/revenue-expense-30d'),
        fetch('http://localhost:3000/api/analytics/top-products')
      ]);
      
      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (revExpRes.ok) setRevExpData(await revExpRes.json());
      if (prodRes.ok) setTopProducts(await prodRes.json());
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  };

  const formatPKR = (value: number) => {
    return `Rs. ${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', gap: '20px', padding: '16px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={28} color="#0284c7" />
            CEO Analytics Dashboard
          </h1>
          <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Real-time financial pulse and live business performance metrics.
          </p>
        </div>
        <div style={{ padding: '6px 14px', background: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontWeight: 700, fontSize: '12px', border: '1px solid #bae6fd' }}>
          Live Production Data
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Today's Sales Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>Today's Sales Total</div>
          <div style={{ fontSize: '24px', fontWeight: 900, margin: '6px 0' }}>{formatPKR(kpis.todaySalesTotal)}</div>
          <div style={{ fontSize: '11px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShoppingBag size={14} /> {kpis.todayInvoicesCount} Invoices Created Today
          </div>
        </div>

        {/* Revenue Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>This Month's Sales</div>
              <div style={{ color: '#0f172a', fontSize: '20px', fontWeight: 800 }}>{formatPKR(kpis.totalRevenue)}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Cumulative Month Sales</div>
        </div>

        {/* Expenses Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>This Month's Expenses</div>
              <div style={{ color: '#0f172a', fontSize: '20px', fontWeight: 800 }}>{formatPKR(kpis.totalExpenses)}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>Total Operational Costs</div>
        </div>

        {/* AR Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Total Receivables (AR)</div>
              <div style={{ color: '#0284c7', fontSize: '20px', fontWeight: 800 }}>{formatPKR(kpis.totalAR)}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>Customer Dues Balance</div>
        </div>

        {/* AP Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={20} />
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Total Payables (AP)</div>
              <div style={{ color: '#b45309', fontSize: '20px', fontWeight: 800 }}>{formatPKR(kpis.totalAP)}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>Vendor Dues Payable</div>
        </div>

        {/* Stock Alerts Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: kpis.lowStockCount > 0 ? '#fee2e2' : '#dcfce7', color: kpis.lowStockCount > 0 ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Low Stock Alerts</div>
              <div style={{ color: kpis.lowStockCount > 0 ? '#dc2626' : '#16a34a', fontSize: '20px', fontWeight: 800 }}>{kpis.lowStockCount} Items</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Out of {kpis.totalProducts} Products</div>
        </div>

      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* 30-Day Trend Chart */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>30-Day Revenue vs Expenses Trend</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revExpData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={val => `Rs.${val}`} />
                <Tooltip formatter={(value: any) => formatPKR(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Bar Chart */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Top Selling Products</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={100} />
                <Tooltip formatter={(value: any) => [`${value} Units Sold`, 'Quantity']} />
                <Bar dataKey="sold" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
