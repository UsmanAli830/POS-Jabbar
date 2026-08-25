import React, { useState, useEffect } from 'react';
import { User, DollarSign, FileText, ShoppingBag } from 'lucide-react';

const EmployeeDashboard: React.FC = () => {
  const [employee, setEmployee] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/hr/employees');
        if (res.ok) {
          setEmployees(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmployees();
  }, []);

  const handleEmployeeSelect = (empId: number) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setEmployee(emp);
      fetchSales(emp.id);
    } else {
      setEmployee(null);
      setSales([]);
    }
  };
  // Handled by handleEmployeeSelect

  const fetchSales = async (empId: number) => {
    try {
      const res = await fetch('http://localhost:3000/api/sales');
      if (res.ok) {
        const allSales = await res.json();
        // Filter sales where this employee is the salesman
        const mySales = allSales.filter((s: any) => s.salesmanId === empId);
        setSales(mySales);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!employee) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="glass-panel" style={{ width: '400px', padding: '32px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#0ea5e9' }}>
            <User size={32} />
          </div>
          <h2 style={{ marginBottom: '8px' }}>Employee Portal</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Select your profile to view sales tracking.</p>
          
          <select 
            className="form-select" 
            style={{ width: '100%', fontSize: '18px', padding: '12px', textAlign: 'center' }}
            onChange={(e) => handleEmployeeSelect(Number(e.target.value))}
            value={employee ? employee.id : ''}
          >
            <option value="">-- Select Employee --</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const totalSalesValue = sales.reduce((sum, s) => sum + (s.totalAmount || s.total || 0), 0);

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Welcome, {employee.name}</h1>
          <p className="page-subtitle">Role: {employee.postRec?.title || 'Staff'} | Base Salary: Rs. {Number(employee.baseSalary || 0).toLocaleString()}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setEmployee(null)}>Sign Out</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">Rs. {totalSalesValue.toLocaleString()}</div>
            <div className="stat-label">Total Sales Generated</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{sales.length}</div>
            <div className="stat-label">Total Invoices</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">Rs. {(totalSalesValue * 0.02).toLocaleString()}</div>
            <div className="stat-label">Estimated Commission (2%)</div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Your Recent Sales</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Total Value</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No sales found for you yet.</td></tr>
            ) : (
              sales.slice(0, 10).map(s => (
                <tr key={s.id}>
                  <td>{new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString()}</td>
                  <td style={{ fontWeight: 'bold' }}>{s.invoiceNumber || `INV-${s.id}`}</td>
                  <td>Rs. {Number(s.totalAmount || s.total || 0).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${(s.paymentStatus || (s.paymentReceived >= s.totalAmount ? 'PAID' : 'PENDING')) === 'PAID' ? 'badge-active' : 'badge-inactive'}`}>
                      {s.paymentStatus || (s.paymentReceived >= s.totalAmount ? 'PAID' : 'PENDING')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
