import React, { useState, useEffect } from 'react';
import { Save, DollarSign, Calendar, FileText, User } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const AdvanceSalary: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchEmployees();
    fetchAdvances();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/hr/employees');
      if (res.ok) setEmployees(await res.json());
    } catch (e) {
      console.error('Error fetching employees:', e);
    }
  };

  const fetchAdvances = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/hr/employees');
      if (res.ok) {
        const emps = await res.json();
        // Flatten advance salaries
        const allAdvances: any[] = [];
        emps.forEach((emp: any) => {
          if (emp.advanceSalaries) {
            emp.advanceSalaries.forEach((adv: any) => {
              allAdvances.push({
                ...adv,
                employeeName: emp.name,
                employeeCategory: emp.postRec?.name || 'Staff'
              });
            });
          }
        });
        // Sort by date desc
        allAdvances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAdvances(allAdvances);
      }
    } catch (e) {
      console.error('Error fetching advances:', e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !amount || Number(amount) <= 0) {
      alert('Please select an employee and input a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/hr/employees/${employeeId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          remarks,
          date
        })
      });

      if (res.ok) {
        alert('Advance salary issued successfully and cash flow ledger posted.');
        setAmount('');
        setRemarks('');
        fetchAdvances();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const columnDefs: any[] = [
    { headerName: 'ID', field: 'id', width: 70, minWidth: 70 },
    { headerName: 'Employee', field: 'employeeName', flex: 1.2, minWidth: 150 },
    { headerName: 'Category', field: 'employeeCategory', width: 130, minWidth: 120 },
    { headerName: 'Amount (PKR)', field: 'amount', width: 140, minWidth: 130, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { headerName: 'Issue Date', field: 'date', width: 130, minWidth: 120, cellRenderer: (p: any) => new Date(p.value).toLocaleDateString() },
    { 
      headerName: 'Status', 
      field: 'status', 
      width: 160, 
      minWidth: 150,
      cellRenderer: (p: any) => {
        const isPending = p.value === 'PENDING_ADJUSTMENT';
        return (
          <span style={{ 
            background: isPending ? '#fef3c7' : '#dcfce7', 
            color: isPending ? '#d97706' : '#15803d', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '11px',
            fontWeight: 'bold' 
          }}>
            {isPending ? 'Pending Adjustment' : 'Adjusted'}
          </span>
        );
      }
    },
    { headerName: 'Remarks', field: 'remarks', flex: 1.5, minWidth: 160 }
  ];

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full">
      <div className="mt-6 pt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Advance Salary Logger</h1>
        <p className="text-sm text-gray-500 mb-6">Record short-term salary advances given to employees. Syncs automatically with next monthly payroll deduction.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Form */}
        <div className="glass-panel p-6" style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} /> Issue Advance Salary
          </h3>

          <form onSubmit={handleSave} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={14} /> Select Employee *
              </label>
              <select 
                required 
                className="form-select" 
                value={employeeId} 
                onChange={e => setEmployeeId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">-- Select Employee --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.postRec?.name || 'Staff'})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <DollarSign size={14} /> Advance Amount (Rs.) *
              </label>
              <input 
                type="number" 
                required 
                min="1" 
                className="form-input" 
                placeholder="e.g. 5000" 
                value={amount} 
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} /> Payment Date
              </label>
              <input 
                type="date" 
                required 
                className="form-input" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileText size={14} /> Remarks
              </label>
              <textarea 
                className="form-input" 
                rows={3} 
                style={{ resize: 'none' }}
                placeholder="Reason for advance..." 
                value={remarks} 
                onChange={e => setRemarks(e.target.value)} 
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: 'auto' }}
              disabled={loading}
            >
              <Save size={16} /> {loading ? 'Saving...' : 'Save Advance Entry'}
            </button>
          </form>
        </div>

        {/* Right Pane: History Grid */}
        <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Historical Advance Payments</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Total payments recorded: {advances.length}</span>
          </div>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm flex-1">
            <div style={{ height: '100%', minWidth: '700px' }} className="ag-theme-alpine">
              <AgGridReact
                rowData={advances}
                columnDefs={columnDefs}
                domLayout="normal"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdvanceSalary;
