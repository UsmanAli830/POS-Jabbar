import React, { useState, useEffect } from 'react';
import { Calendar, Save, CheckCircle, AlertCircle, Clock, Award } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

type AttendanceRow = {
  employeeRecId: number;
  employeeName: string;
  employeeCategory: string;
  statusText: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALFDAY';
  lateMinutes: number;
};

type SummaryRow = {
  employeeRecId: number;
  employeeName: string;
  employeeCategory: string;
  totalPresents: number;
  totalAbsents: number;
  totalLeaves: number;
  totalLates: number;
  totalHalfDays: number;
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

const EmployeeAttendance: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRow[]>([]);
  
  // Monthly Summary Selector
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [summaryList, setSummaryList] = useState<SummaryRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    fetchDailyAttendance();
  }, [selectedDate]);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedMonth, selectedYear]);

  const fetchDailyAttendance = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/hr/attendance?date=${selectedDate}`);
      if (res.ok) {
        setAttendanceList(await res.json());
      }
    } catch (e) {
      console.error('Error fetching daily attendance:', e);
    }
  };

  const fetchMonthlySummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`http://localhost:3000/api/hr/attendance/monthly-summary?month=${selectedMonth}&year=${selectedYear}`);
      if (res.ok) {
        setSummaryList(await res.json());
      }
    } catch (e) {
      console.error('Error fetching monthly summary:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleStatusChange = (employeeRecId: number, status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALFDAY') => {
    setAttendanceList(prev => 
      prev.map(row => 
        row.employeeRecId === employeeRecId 
          ? { ...row, statusText: status, lateMinutes: status === 'LATE' ? row.lateMinutes || 15 : 0 }
          : row
      )
    );
  };

  const handleLateMinutesChange = (employeeRecId: number, mins: number) => {
    setAttendanceList(prev => 
      prev.map(row => 
        row.employeeRecId === employeeRecId ? { ...row, lateMinutes: mins } : row
      )
    );
  };

  const handleSaveAttendance = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          records: attendanceList
        })
      });

      if (res.ok) {
        alert('Attendance saved successfully!');
        fetchDailyAttendance();
        fetchMonthlySummary();
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (e) {
      alert('Network error.');
    }
  };

  const STATUS_CONFIG: { key: AttendanceRow['statusText']; label: string; color: string; darkColor: string; bg: string; activeBg: string }[] = [
    { key: 'PRESENT',  label: 'Present',  color: '#16a34a', darkColor: '#14532d', bg: '#dcfce7', activeBg: '#16a34a' },
    { key: 'ABSENT',   label: 'Absent',   color: '#dc2626', darkColor: '#7f1d1d', bg: '#fee2e2', activeBg: '#dc2626' },
    { key: 'LEAVE',    label: 'Leave',    color: '#d97706', darkColor: '#78350f', bg: '#fef3c7', activeBg: '#d97706' },
    { key: 'LATE',     label: 'Late',     color: '#7c3aed', darkColor: '#3b0764', bg: '#ede9fe', activeBg: '#7c3aed' },
    { key: 'HALFDAY',  label: 'Half-Day', color: '#0284c7', darkColor: '#0c4a6e', bg: '#e0f2fe', activeBg: '#0284c7' },
  ];

  const dailyColumnDefs: ColDef<any>[] = [
    { headerName: 'Employee', field: 'employeeName', flex: 1, minWidth: 140 },
    { headerName: 'Category', field: 'employeeCategory', width: 110 },
    {
      headerName: 'Attendance Status',
      flex: 2,
      minWidth: 380,
      cellRenderer: (p: any) => {
        const row = p.data as AttendanceRow;
        return (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', height: '100%', padding: '0 4px' }}>
            {STATUS_CONFIG.map(({ key, label, color, darkColor, bg, activeBg }) => {
              const checked = row.statusText === key;
              return (
                <button
                  key={key}
                  onClick={() => handleStatusChange(row.employeeRecId, key)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '20px',
                    border: `2px solid ${color}`,
                    background: checked ? activeBg : bg,
                    color: checked ? '#ffffff' : darkColor,
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    outline: 'none',
                    boxShadow: checked ? `0 2px 6px ${color}55` : 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
      }
    },
    {
      headerName: 'Min. Late',
      width: 110,
      cellRenderer: (p: any) => {
        const row = p.data as AttendanceRow;
        if (row.statusText !== 'LATE') return <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>;
        return (
          <input
            type="number"
            min="0"
            className="pos-input"
            style={{ width: '72px', padding: '2px 6px', height: '26px', fontSize: '11px' }}
            value={row.lateMinutes}
            onChange={e => handleLateMinutesChange(row.employeeRecId, Number(e.target.value))}
          />
        );
      }
    }
  ];

  const summaryColumnDefs: ColDef<any>[] = [
    { headerName: 'Employee Name', field: 'employeeName', minWidth: 160, flex: 1.2 },
    { headerName: 'Category', field: 'employeeCategory', width: 130, minWidth: 120 },
    { 
      headerName: 'Presents', 
      field: 'totalPresents', 
      width: 120,
      minWidth: 120,
      cellRenderer: (p: any) => <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{p.value} days</span>
    },
    { 
      headerName: 'Absents', 
      field: 'totalAbsents', 
      width: 120,
      minWidth: 120,
      cellRenderer: (p: any) => <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{p.value} days</span>
    },
    { 
      headerName: 'Leaves', 
      field: 'totalLeaves', 
      width: 120,
      minWidth: 120,
      cellRenderer: (p: any) => <span style={{ fontWeight: 'bold', color: '#eab308' }}>{p.value} days</span>
    },
    { 
      headerName: 'Lates', 
      field: 'totalLates', 
      width: 120,
      minWidth: 120,
      cellRenderer: (p: any) => <span style={{ fontWeight: 'bold', color: '#64748b' }}>{p.value} times</span>
    },
    { 
      headerName: 'Half-Days', 
      field: 'totalHalfDays', 
      width: 120,
      minWidth: 120,
      cellRenderer: (p: any) => <span style={{ fontWeight: 'bold', color: '#f97316' }}>{p.value} days</span>
    }
  ];

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full">
      
      {/* HEADER */}
      <div className="mt-6 pt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Employee Attendance Control</h1>
        <p className="text-sm text-gray-500 mb-6">Track daily clock-ins, absents, leaves, lates, and auto-sync deductions to payroll calculations.</p>
      </div>

      <div className="space-y-6 flex flex-col flex-1 overflow-y-auto">
        
        {/* TOP PANEL: DAILY ATTENDANCE SHEET */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CheckCircle size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Daily Attendance Sheet</h3>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>
                <Calendar size={14} style={{ color: '#64748b' }} />
                <input 
                  type="date" 
                  className="pos-input"
                  style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '11px', height: '24px' }}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>

              <button 
                className="btn btn-primary" 
                onClick={handleSaveAttendance}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', padding: '6px 14px' }}
              >
                <Save size={14} /> Save Attendance Sheet
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
            <div style={{ height: '300px', minWidth: '700px' }} className="ag-theme-alpine">
              <AgGridReact
                rowData={attendanceList}
                columnDefs={dailyColumnDefs}
                domLayout="normal"
                rowHeight={44}
                headerHeight={36}
              />
            </div>
          </div>
        </div>

        {/* BOTTOM PANEL: MONTHLY SUMMARY & AUDIT */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Clock size={18} style={{ color: '#eab308' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Monthly Summary & Audit Grid</h3>
            </div>
            
            {/* Month selector */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>
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
          </div>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
            <div style={{ height: '280px', minWidth: '700px' }} className="ag-theme-alpine">
              <AgGridReact
                rowData={summaryList}
                columnDefs={summaryColumnDefs}
                domLayout="normal"
                rowHeight={36}
                headerHeight={36}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeAttendance;
