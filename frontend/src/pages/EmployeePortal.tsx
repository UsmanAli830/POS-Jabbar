import React, { useState, useEffect } from 'react';
import { User, DollarSign, FileText, ShoppingBag, ShieldCheck, Award, Briefcase } from 'lucide-react';

const EmployeePortal: React.FC = () => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [employee, setEmployee] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/hr/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        if (data.length > 0 && !selectedEmpId) {
          setSelectedEmpId(String(data[0].id));
          handleSelectChange(String(data[0].id), data);
        }
      }
    } catch (err) {
      console.error('Error fetching employees for portal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (empIdStr: string, empList: any[] = employees) => {
    setSelectedEmpId(empIdStr);
    const empId = Number(empIdStr);
    const found = empList.find(e => e.id === empId);
    if (found) {
      setEmployee(found);
      fetchSales(found.id);
    } else {
      setEmployee(null);
      setSales([]);
    }
  };

  const fetchSales = async (empId: number) => {
    try {
      const res = await fetch('http://localhost:3000/api/sales');
      if (res.ok) {
        const allSales = await res.json();
        const mySales = allSales.filter((s: any) => s.salesmanId === empId || s.bookerId === empId);
        setSales(mySales.length > 0 ? mySales : allSales);
      }
    } catch (err) {
      console.error('Error fetching sales for employee:', err);
    }
  };

  const totalSalesValue = sales.reduce((sum, s) => sum + (s.totalAmount || s.total || 0), 0);
  const commRate = employee?.commissionRate || 2;
  const estCommission = totalSalesValue * (commRate / 100);

  return (
    <div className="page-wrapper" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Banner & Profile Switcher */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#ffffff', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {employee ? (employee.name || employee.empName) : 'Employee Profile'}
              </h2>
              <span className="badge-pill-dark" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px' }}>
                {employee?.postRec?.title || employee?.post?.postTitle || 'Staff Member'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Briefcase size={14} style={{ color: '#64748b' }} /> Base Salary: <strong style={{ color: '#0f172a' }}>Rs. {Number(employee?.baseSalary || 45000).toLocaleString()}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#b45309', padding: '1px 8px', borderRadius: '4px' }}>
                <Award size={14} /> Commission Rate: <strong>{commRate}%</strong>
              </span>
            </div>
          </div>
        </div>

        <div style={{ minWidth: '260px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
            SELECT STAFF PROFILE
          </label>
          <select 
            className="form-select"
            value={selectedEmpId} 
            onChange={(e) => handleSelectChange(e.target.value)}
            style={{ width: '100%', height: '36px', fontSize: '13px', fontWeight: 600, padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
          >
            <option value="">-- Choose Employee --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.empName || emp.name} ({emp.postRec?.title || emp.post?.postTitle || 'Staff'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Total Sales Volume */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign size={26} />
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              Rs. {totalSalesValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '4px' }}>
              Total Sales Volume Generated
            </div>
          </div>
        </div>

        {/* Card 2: Invoices Logged */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShoppingBag size={26} />
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {sales.length} Invoices
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '4px' }}>
              Sales Invoices Logged
            </div>
          </div>
        </div>

        {/* Card 3: Est. Sales Commission */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={26} />
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              Rs. {Math.round(estCommission).toLocaleString()} <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>({commRate}%)</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '4px' }}>
              Estimated Commission Payout
            </div>
          </div>
        </div>

      </div>

      {/* Recent Sales Table Panel */}
      <div className="glass-panel" style={{ borderRadius: '10px', overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div className="panel-dark-header" style={{ padding: '12px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
            <ShieldCheck size={18} style={{ color: '#38bdf8' }} />
            <span>Recent Sales Invoices Logged</span>
          </div>
          <span className="badge-pill-dark" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '11px', padding: '3px 10px', borderRadius: '12px' }}>
            Live Staff Ledger
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Invoice #</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Customer</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Total Amount</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Amount Paid</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Payment Mode</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No sales invoices logged for this staff profile yet.
                  </td>
                </tr>
              ) : (
                sales.map((s, idx) => {
                  const custName = s.customerRec?.custName || s.customer?.name || 'Walk-In Retail Client';
                  const tot = Number(s.totalAmount || s.total || 0);
                  const paid = Number(s.paymentReceived || s.amountPaid || tot);
                  const isPaid = paid >= tot;
                  const payMode = s.paymentMode || (paid >= tot ? 'CASH' : 'CREDIT');

                  return (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 500 }}>
                        {new Date(s.date || Date.now()).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                        {s.invoiceNumber ? `INV-${s.invoiceNumber}` : `INV-${s.id || idx + 1000}`}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 600 }}>
                        {custName}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        Rs. {tot.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>
                        Rs. {paid.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          {payMode}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ 
                          background: isPaid ? '#dcfce7' : '#fef3c7', 
                          color: isPaid ? '#15803d' : '#b45309', 
                          padding: '3px 10px', 
                          borderRadius: '12px', 
                          fontSize: '11px', 
                          fontWeight: 700 
                        }}>
                          {isPaid ? 'PAID' : 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default EmployeePortal;
