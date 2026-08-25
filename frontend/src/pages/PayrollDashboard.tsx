import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Save, UserCheck, Check, DollarSign, X, Printer, Calendar, Users, CheckCircle, CircleDollarSign } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import PrintableLedger from '../components/PrintableLedger';
import { useReactToPrint } from 'react-to-print';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';

type EmployeeRec = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  empCNIC: string | null;
  joiningDate: string | null;
  baseSalary: number;
  flatBonus?: number;
  commissionRate?: number;
  postRecId: number | null;
  postRec: { id: number; title: string } | null;
  salaries: any[];
  advanceSalaries: any[];
  sales: any[];
  spotSales: any[];
};

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const YEARS = [2025, 2026, 2027, 2028, 2029];

const PayrollDashboard: React.FC = () => {
  const { settings } = useSettings();
  const [employees, setEmployees] = useState<EmployeeRec[]>([]);
  const [selectedRows, setSelectedRows] = useState<EmployeeRec[]>([]);

  // Month & Year Selector
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modals
  const [showPayrollModal, setShowPayrollModal] = useState(false);

  const [salaryAmount, setSalaryAmount] = useState<number | ''>('');
  const [deduction, setDeduction] = useState<number | ''>('');
  const [extraIncentive, setExtraIncentive] = useState<number | ''>('');
  const [overtimeHours, setOvertimeHours] = useState<number | ''>('');
  const [overtimeRate, setOvertimeRate] = useState<number | ''>('');

  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'salary', data: {} });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const [attendanceSummaries, setAttendanceSummaries] = useState<any[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchAttendanceSummary();
  }, [selectedMonth, selectedYear]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/hr/employees');
      if (res.ok) {
        setEmployees(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/hr/attendance/monthly-summary?month=${selectedMonth}&year=${selectedYear}`);
      if (res.ok) {
        setAttendanceSummaries(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch attendance summary', err);
    }
  };

  const handleRowSelected = (e: any) => {
    const selectedNodes = e.api.getSelectedNodes();
    const selectedData = selectedNodes.map((node: any) => node.data);
    setSelectedRows(selectedData);
  };

  // Helper Calculations
  const calculateCommissions = (emp: any, month: number, year: number) => {
    const sales = emp.sales || [];
    const spotSales = emp.spotSales || [];
    
    const stdComm = sales.reduce((sum: number, s: any) => {
      const d = new Date(s.date);
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        return sum + ((s.totalAmount || 0) * (emp.commissionRate || 0)) / 100;
      }
      return sum;
    }, 0);

    const spotComm = spotSales.reduce((sum: number, s: any) => {
      const d = new Date(s.date);
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        return sum + ((s.totalAmount || 0) * (emp.commissionRate || 0)) / 100;
      }
      return sum;
    }, 0);

    return stdComm + spotComm;
  };

  const calculatePendingAdvances = (emp: any) => {
    return (emp.advanceSalaries || [])
      .filter((a: any) => a.status === 'PENDING_ADJUSTMENT')
      .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
  };

  // Row data formatted for monthly view
  const mainGridRowData = useMemo(() => {
    return employees.map((emp) => {
      const baseSalary = emp.baseSalary || 0;
      const flatBonus = emp.flatBonus || 0;
      const commissions = calculateCommissions(emp, selectedMonth, selectedYear);
      const advances = calculatePendingAdvances(emp);
      
      const attSummary = attendanceSummaries.find(a => a.employeeRecId === emp.id);
      const absents = attSummary ? (attSummary.totalAbsents || 0) : 0;
      const absentDeduction = Math.round((baseSalary / 30) * absents);
      const netPayable = baseSalary + flatBonus + commissions - advances - absentDeduction;
      
      const isPaid = (emp.salaries || []).some((s: any) => s.month === selectedMonth && s.year === selectedYear);

      return {
        ...emp,
        baseSalary,
        flatBonus,
        commissions,
        advances,
        absents,
        absentDeduction,
        netPayable,
        paymentStatus: isPaid ? 'Paid' : 'Unpaid'
      };
    });
  }, [employees, selectedMonth, selectedYear, attendanceSummaries]);

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRows.length !== 1) return;

    try {
      const otHrs = Number(overtimeHours) || 0;
      const otRate = Number(overtimeRate) || 0;
      const otPay = otHrs * otRate;

      const res = await fetch(`http://localhost:3000/api/hr/employees/${selectedRows[0].id}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salaryAmount: Number(salaryAmount),
          deduction: Number(deduction),
          extraIncentive: Number(extraIncentive),
          overtimeHours: otHrs,
          overtimeRate: otRate,
          month: selectedMonth,
          year: selectedYear
        })
      });

      if (res.ok) {
        const data = await res.json();
        const emp = selectedRows[0];
        const base = Number(salaryAmount) || 0;
        const ded = Number(deduction) || 0;
        const inc = Number(extraIncentive) || 0;
        const net = base + inc + otPay - ded;

        setReceiptModal({
          isOpen: true,
          type: 'salary',
          data: {
            id: data.id || 'SAL',
            storeName: settings?.storeName || 'Wholesale ERP',
            storeAddress: settings?.storeAddress || '',
            receiptFooter: settings?.receiptFooter || 'Thank you for your hard work!',
            employeeName: emp.name,
            designation: emp.postRec?.title || 'Employee',
            monthYear: new Date(selectedYear, selectedMonth - 1).toLocaleDateString('default', { month: 'long', year: 'numeric' }),
            baseSalary: base,
            allowances: inc + otPay,
            deductions: ded,
            netSalary: net,
            paymentMode: 'Cash / Bank Transfer',
            paymentDate: new Date().toISOString()
          }
        });

        setShowPayrollModal(false);
        setSalaryAmount('');
        setDeduction('');
        setExtraIncentive('');
        setOvertimeHours('');
        setOvertimeRate('');
        fetchEmployees();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to process payroll'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openPayrollModal = () => {
    if (selectedRows.length === 1) {
      const emp = selectedRows[0];
      const commissions = calculateCommissions(emp, selectedMonth, selectedYear);
      const advances = calculatePendingAdvances(emp);
      const baseSalary = emp.baseSalary || 0;
      const flatBonus = emp.flatBonus || 0;

      const attSummary = attendanceSummaries.find(a => a.employeeRecId === emp.id);
      const absents = attSummary ? (attSummary.totalAbsents || 0) : 0;
      const absentDeduction = Math.round((baseSalary / 30) * absents);

      setSalaryAmount(baseSalary);
      setDeduction(advances + absentDeduction);
      setExtraIncentive(flatBonus + commissions);
      setOvertimeHours('');
      setOvertimeRate('');
      setShowPayrollModal(true);
    }
  };

  const columnDefs: any[] = [
    { headerName: 'ID', field: 'id', width: 70, minWidth: 70, checkboxSelection: true },
    { headerName: 'Employee Name', field: 'name', minWidth: 160, flex: 1.2 },
    { headerName: 'Category', field: 'postRec.name', width: 130, minWidth: 120 },
    { headerName: 'Base Salary', field: 'baseSalary', width: 130, minWidth: 120, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { headerName: 'Monthly Bonus', field: 'flatBonus', width: 140, minWidth: 130, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { headerName: 'Commissions', field: 'commissions', width: 130, minWidth: 120, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { headerName: 'Advance Taken', field: 'advances', width: 140, minWidth: 130, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { headerName: 'Absents', field: 'absents', width: 100, minWidth: 95, cellRenderer: (p: any) => `${p.value || 0} days` },
    { headerName: 'Absents Deduction', field: 'absentDeduction', width: 150, minWidth: 140, cellRenderer: (p: any) => `Rs. ${(p.value || 0).toLocaleString()}` },
    { 
      headerName: 'Net Payable', 
      field: 'netPayable', 
      width: 140, 
      minWidth: 130,
      cellRenderer: (p: any) => <span style={{ fontWeight: 'bold', color: p.value >= 0 ? '#10b981' : '#ef4444' }}>Rs. {(p.value || 0).toLocaleString()}</span> 
    },
    { 
      headerName: 'Status', 
      field: 'paymentStatus', 
      width: 110, 
      minWidth: 110,
      cellRenderer: (p: any) => {
        const isPaid = p.value === 'Paid';
        return (
          <span style={{ 
            background: isPaid ? '#dcfce7' : '#fee2e2', 
            color: isPaid ? '#15803d' : '#dc2626', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '11px',
            fontWeight: 'bold' 
          }}>
            {p.value}
          </span>
        );
      }
    }
  ];

  const historyColumnDefs: any[] = [
    { headerName: 'Date', field: 'date', valueFormatter: (params: any) => new Date(params.value).toLocaleString() },
    { headerName: 'Type', field: 'type' },
    { headerName: 'Base/Advance', field: 'baseAmount', cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` },
    { headerName: 'Deduction', field: 'deduction', cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` },
    { headerName: 'Incentive', field: 'incentive', cellRenderer: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` },
    { headerName: 'Net Processed', field: 'netAmount', cellRenderer: (params: any) => <span style={{fontWeight: 'bold', color: '#10b981'}}>Rs. ${(params.value || 0).toLocaleString()}</span> },
    {
      headerName: 'Print',
      width: 70,
      cellRenderer: (params: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const row = params.data;
            const emp = selectedRows[0];
            if (row.type === 'SALARY') {
              setReceiptModal({
                isOpen: true,
                type: 'salary',
                data: {
                  id: `SAL-${row.id}`,
                  storeName: settings?.storeName || 'Wholesale ERP',
                  storeAddress: settings?.storeAddress || '',
                  receiptFooter: settings?.receiptFooter || 'Thank you for your hard work!',
                  employeeName: emp.name,
                  designation: emp.postRec?.title || 'Employee',
                  monthYear: new Date(row.year || new Date(row.date).getFullYear(), (row.month || new Date(row.date).getMonth() + 1) - 1).toLocaleDateString('default', { month: 'long', year: 'numeric' }),
                  baseSalary: row.salaryAmount || row.baseAmount || 0,
                  allowances: row.extraIncentive || row.incentive || 0,
                  deductions: row.deduction || 0,
                  netSalary: row.netAmount || 0,
                  paymentMode: 'Cash / Bank Transfer',
                  paymentDate: row.date
                }
              });
            } else {
              setReceiptModal({
                isOpen: true,
                type: 'payment',
                data: {
                  id: `ADV-${row.id}`,
                  storeName: settings?.storeName || 'Wholesale ERP',
                  storeAddress: settings?.storeAddress || '',
                  receiptFooter: settings?.receiptFooter || 'Thank you for your hard work!',
                  accountName: emp.name,
                  paymentDate: row.date,
                  amountPaid: row.amount || row.baseAmount || 0,
                  paymentMode: 'Cash',
                  remarks: row.remarks || 'Advance Salary Issued',
                  voucherType: 'Salary Advance Voucher',
                  remainingBalance: 0
                }
              });
            }
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}
        >
          <Printer size={14} color="#0284c7" />
        </button>
      )
    }
  ];

  const totalStaffCount = mainGridRowData.length;
  const paidCount = mainGridRowData.filter(r => r.paymentStatus === 'Paid').length;
  const unpaidCount = totalStaffCount - paidCount;
  const totalMonthlyPayout = mainGridRowData
    .filter(r => r.paymentStatus === 'Paid')
    .reduce((sum, r) => {
      const sal = (r.salaries || []).find(s => s.month === selectedMonth && s.year === selectedYear);
      return sum + (sal ? sal.netAmount : 0);
    }, 0);

  const historyData = selectedRows.length === 1 
    ? [
        ...(selectedRows[0].salaries || []).map(s => ({ ...s, type: 'SALARY', baseAmount: s.salaryAmount })),
        ...(selectedRows[0].advanceSalaries || []).map(a => ({ ...a, type: 'ADVANCE', baseAmount: a.amount, deduction: 0, incentive: 0, netAmount: a.amount }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full">
      
      {/* HEADER */}
      <div className="mt-6 pt-4 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Monthly Payroll Dashboard</h1>
          <p className="text-sm text-gray-500 mb-6">Calculate base salaries, track commissions, deduct advances, and process payouts.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          
          {/* Month/Year selector */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', marginRight: '12px' }}>
            <Calendar size={14} style={{ color: '#64748b' }} />
            <select 
              className="pos-input" 
              style={{ padding: '2px 4px', fontSize: '11px', height: '24px', border: 'none', background: 'transparent' }}
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
            >
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select 
              className="pos-input" 
              style={{ padding: '2px 4px', fontSize: '11px', height: '24px', border: 'none', background: 'transparent' }}
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={openPayrollModal}
            disabled={selectedRows.length !== 1}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', padding: '6px 14px' }}
          >
            <Check size={16} /> Pay Salary
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(37, 99, 235, 0.03))', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ background: '#3b82f6', color: '#fff', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Active Employees</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>{totalStaffCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.03))', borderLeft: '4px solid #10b981' }}>
          <div style={{ background: '#10b981', color: '#fff', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Salary Payout Progress</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
              <span style={{ color: '#10b981' }}>{paidCount} Paid</span> / <span style={{ color: '#ef4444' }}>{unpaidCount} Unpaid</span>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08), rgba(202, 138, 4, 0.03))', borderLeft: '4px solid #eab308' }}>
          <div style={{ background: '#eab308', color: '#fff', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <CircleDollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Payout (This Month)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Rs. {totalMonthlyPayout.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Employee List */}
        <div className="glass-panel" style={{ flex: '1.3', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <UserCheck size={18} /> Employee Payroll Breakdown ({MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear})
          </div>
          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm flex-1">
            <div style={{ height: '100%', minWidth: '850px' }} className="ag-theme-alpine">
              <AgGridReact
                rowData={mainGridRowData}
                columnDefs={columnDefs}
                rowSelection="single"
                onSelectionChanged={handleRowSelected}
                domLayout="normal"
              />
            </div>
          </div>
        </div>

        {/* Right Pane: History */}
        <div className="glass-panel" style={{ flex: '0.9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--accent-primary)' }} /> Selected Employee History Log
          </div>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {selectedRows.length === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
                
                {/* Employee Header */}
                <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 800 }}>{selectedRows[0].name}'s Ledger</h4>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{selectedRows[0].postRec?.title || 'Staff'}</span>
                  </div>
                  <button onClick={handlePrint} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Printer size={12} /> Print Statement
                  </button>
                </div>

                {/* Timeline Feed List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                  {historyData.map((item: any, idx: number) => {
                    const isSal = item.type === 'SALARY';
                    return (
                      <div key={idx} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: isSal ? 'rgba(22, 163, 74, 0.01)' : 'rgba(59, 130, 246, 0.01)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ background: isSal ? '#dcfce7' : '#dbeafe', color: isSal ? '#15803d' : '#1e40af', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                              {isSal ? <CheckCircle size={12} /> : <Calendar size={12} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '11px', color: '#1e293b' }}>
                                {isSal ? 'Salary Payout Processed' : 'Salary Advance Issued'}
                              </div>
                              <div style={{ fontSize: '9px', color: '#64748b' }}>
                                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '13px', color: isSal ? '#16a34a' : '#2563eb' }}>
                              Rs. {(item.netAmount || item.amount || 0).toLocaleString()}
                            </div>
                            {!isSal && (
                              <span style={{ 
                                background: item.status === 'PENDING_ADJUSTMENT' ? '#fef3c7' : '#dcfce7', 
                                color: item.status === 'PENDING_ADJUSTMENT' ? '#b45309' : '#15803d', 
                                padding: '1px 5px', 
                                borderRadius: '3px', 
                                fontSize: '8px', 
                                fontWeight: 'bold',
                                display: 'inline-block',
                                marginTop: '2px'
                              }}>
                                {item.status === 'PENDING_ADJUSTMENT' ? 'Pending' : 'Adjusted'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Breakdown Box */}
                        <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', fontSize: '10px', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'space-between' }}>
                          {isSal ? (
                            <>
                              <span>Base: <strong>Rs. {(item.salaryAmount || 0).toLocaleString()}</strong></span>
                              <span>Inc: <strong>Rs. {(item.extraIncentive || 0).toLocaleString()}</strong></span>
                              {(item.overtimeHours > 0) && (
                                <span style={{ color: '#b45309' }}>OT: <strong>{item.overtimeHours}h × Rs.{item.overtimeRate} = Rs. {((item.overtimeHours || 0) * (item.overtimeRate || 0)).toLocaleString()}</strong></span>
                              )}
                              <span>Ded: <strong>-Rs. {(item.deduction || 0).toLocaleString()}</strong></span>
                            </>
                          ) : (
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Remarks: <strong>{item.remarks || 'Advance Salary Payout'}</strong></span>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', height: '22px' }}
                            onClick={() => {
                              if (isSal) {
                                setReceiptModal({
                                  isOpen: true,
                                  type: 'salary',
                                  data: {
                                    id: `SAL-${item.id}`,
                                    storeName: settings?.storeName || 'Ammad Sanitary',
                                    storeAddress: settings?.storeAddress || '',
                                    receiptFooter: settings?.receiptFooter || 'Thank you for your hard work!',
                                    employeeName: selectedRows[0].name,
                                    designation: selectedRows[0].postRec?.title || 'Employee',
                                    monthYear: new Date(item.year || new Date(item.date).getFullYear(), (item.month || new Date(item.date).getMonth() + 1) - 1).toLocaleDateString('default', { month: 'long', year: 'numeric' }),
                                    baseSalary: item.salaryAmount || item.baseAmount || 0,
                                    allowances: item.extraIncentive || item.incentive || 0,
                                    deductions: item.deduction || 0,
                                    netSalary: item.netAmount || 0,
                                    paymentMode: 'Cash / Bank Transfer',
                                    paymentDate: item.date
                                  }
                                });
                              } else {
                                setReceiptModal({
                                  isOpen: true,
                                  type: 'payment',
                                  data: {
                                    id: `ADV-${item.id}`,
                                    storeName: settings?.storeName || 'Ammad Sanitary',
                                    storeAddress: settings?.storeAddress || '',
                                    receiptFooter: settings?.receiptFooter || 'Thank you for your hard work!',
                                    accountName: selectedRows[0].name,
                                    paymentDate: item.date,
                                    amountPaid: item.amount || item.baseAmount || 0,
                                    paymentMode: 'Cash',
                                    remarks: item.remarks || 'Advance Salary Issued',
                                    voucherType: 'Salary Advance Voucher',
                                    remainingBalance: 0
                                  }
                                });
                              }
                            }}
                          >
                            <Printer size={10} /> Print Receipt
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {historyData.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '11px', textAlign: 'center', padding: '32px' }}>
                      No payroll or advance salary history recorded for this employee.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, fontSize: '11px', color: '#64748b' }}>
                Select an employee to view their full payout & advance salary history.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Salary Payout Confirmation Modal */}
      {showPayrollModal && selectedRows.length === 1 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 800 }}>Pay Salary: {selectedRows[0].name}</h3>
              <button onClick={() => setShowPayrollModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleProcessPayroll}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Base Salary (Rs.)</label>
                <input required type="number" step="0.01" min="0" className="form-input" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Deductions (Advances + Absents) (Rs.)</label>
                <input type="number" step="0.01" min="0" className="form-input" value={deduction} onChange={e => setDeduction(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Extra Incentive (Bonus + Commission) (Rs.)</label>
                <input type="number" step="0.01" min="0" className="form-input" value={extraIncentive} onChange={e => setExtraIncentive(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>

              {/* Overtime Fields */}
              <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⏱ Overtime Compensation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px', fontWeight: 700 }}>Overtime Hours</label>
                    <input type="number" step="0.5" min="0" className="form-input" placeholder="e.g. 12" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px', fontWeight: 700 }}>Rate per Hour (Rs.)</label>
                    <input type="number" step="0.01" min="0" className="form-input" placeholder="e.g. 150" value={overtimeRate} onChange={e => setOvertimeRate(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                </div>
                {(Number(overtimeHours) > 0 && Number(overtimeRate) > 0) && (
                  <div style={{ marginTop: '6px', fontSize: '10px', color: '#92400e', fontWeight: 700 }}>
                    OT Pay: Rs. {((Number(overtimeHours) || 0) * (Number(overtimeRate) || 0)).toLocaleString()}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '12px', marginBottom: '16px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                  <span>Net Payable Amount:</span>
                  <span style={{ color: '#16a34a' }}>Rs. {(
                    (Number(salaryAmount) || 0) +
                    (Number(extraIncentive) || 0) +
                    ((Number(overtimeHours) || 0) * (Number(overtimeRate) || 0)) -
                    (Number(deduction) || 0)
                  ).toLocaleString()}</span>
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'var(--accent-primary)', padding: '8px 16px', fontWeight: 700 }}>
                Confirm Payout & Generate Receipt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Container */}
      <div style={{ display: 'none' }}>
        {selectedRows.length === 1 && (
          <PrintableLedger
            ref={printRef}
            entity={{
              name: selectedRows[0].name,
              phone: selectedRows[0].phone,
              address: selectedRows[0].email,
              type: 'Employee'
            }}
            transactions={[
              ...(selectedRows[0].salaries || []).map(s => ({
                date: s.date,
                entityName: selectedRows[0].name,
                referenceId: `SAL-${s.id}`,
                remarks: `Base: Rs. ${s.salaryAmount} | Ded: Rs. ${s.deduction} | Inc: Rs. ${s.extraIncentive}`,
                debit: 0,
                credit: s.netAmount,
                runningBalance: 0
              })),
              ...(selectedRows[0].advanceSalaries || []).map(a => ({
                date: a.date,
                entityName: selectedRows[0].name,
                referenceId: `ADV-${a.id}`,
                remarks: `Advance Issued (${a.status})`,
                debit: a.amount,
                credit: 0,
                runningBalance: 0
              }))
            ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
          />
        )}
      </div>

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />
    </div>
  );
};

export default PayrollDashboard;
