import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Filter, Search, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PrintableLedger from '../components/PrintableLedger';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';

const GeneralLedger: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const { settings } = useSettings();

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [filterId, setFilterId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Printable state
  const [periodOpeningBalance, setPeriodOpeningBalance] = useState<number>(0);
  const [printableTransactions, setPrintableTransactions] = useState<any[]>([]);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'payment', data: {} });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Customer_Ledger_${filterId || 'Report'}`
  });

  useEffect(() => {
    fetchCustomers();
    fetchVendors();
    fetchLedger();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/vendors');
      if (res.ok) setVendors(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLedger = async () => {
    try {
      if (filterType === 'CUSTOMER' && filterId) {
        // Fetch Phase 24 Date-Filtered Customer Ledger Engine API
        let url = `http://localhost:3000/api/ledger/customer/${filterId}?`;
        if (startDate) url += `startDate=${startDate}&`;
        if (endDate) url += `endDate=${endDate}&`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPeriodOpeningBalance(data.periodOpeningBalance || 0);
          setPrintableTransactions(data.transactions || []);
          
          // Map to AG-Grid format
          const mapped = data.transactions.map((t: any) => ({
            id: t.id,
            main: { date: t.date, description: t.description },
            finHead: { name: data.customer.name },
            transactionType: t.debit > 0 ? 'DR' : 'CR',
            amount: t.debit > 0 ? t.debit : t.credit,
            debit: t.debit,
            credit: t.credit
          }));
          setTransactions(mapped);
          return;
        }
      }

      // Standard Ledger fetch for ALL / VENDOR
      let url = 'http://localhost:3000/api/finance/ledger?';
      if (filterType === 'VENDOR' && filterId) url += `vendorId=${filterId}&`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        setPeriodOpeningBalance(0);
        setPrintableTransactions([]);
      }
    } catch (e) {
      console.error('Failed to fetch ledger', e);
    }
  };

  const applyFilters = () => {
    fetchLedger();
  };

  // Compute running balance based on transaction type if a specific party is selected
  const rowsWithBalance = useMemo(() => {
    let balance = periodOpeningBalance;
    return transactions.map((t, idx) => {
      if (filterType === 'CUSTOMER') {
        balance += ((t.debit || (t.transactionType === 'DR' ? t.amount : 0)) - (t.credit || (t.transactionType === 'CR' ? t.amount : 0)));
      } else if (filterType === 'VENDOR') {
        balance += (t.transactionType === 'CR' ? t.amount : -t.amount);
      } else {
        balance = 0; 
      }
      
      return {
        ...t,
        runningBalance: balance,
        displayIndex: idx + 1
      };
    });
  }, [transactions, filterType, periodOpeningBalance]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rowsWithBalance;
    const q = searchQuery.toLowerCase();
    return rowsWithBalance.filter((t: any) => 
      t.main?.description?.toLowerCase().includes(q) ||
      t.finHead?.name?.toLowerCase().includes(q)
    );
  }, [rowsWithBalance, searchQuery]);

  const selectedCustomerName = useMemo(() => {
    if (filterType === 'CUSTOMER' && filterId) {
      const c = customers.find(item => item.id === filterId);
      return c ? (c.name || c.custName) : 'Customer';
    }
    return 'Customer';
  }, [customers, filterType, filterId]);

  const colDefs: any[] = [
    { field: 'displayIndex', headerName: '#', width: 60 },
    { 
      field: 'main.date', 
      headerName: 'Date', 
      width: 140,
      valueFormatter: (p: any) => new Date(p.value).toLocaleString()
    },
    { field: 'finHead.name', headerName: 'Account Head', width: 180 },
    { field: 'main.description', headerName: 'Description', flex: 2, minWidth: 200 },
    { 
      headerName: 'Debit (DR)', 
      width: 130,
      cellStyle: { textAlign: 'right' },
      valueGetter: (p: any) => p.data.debit || (p.data.transactionType === 'DR' ? p.data.amount : 0),
      cellRenderer: (p: any) => p.value ? `Rs. ${Number(p.value).toLocaleString()}` : '-'
    },
    { 
      headerName: 'Credit (CR)', 
      width: 130,
      cellStyle: { textAlign: 'right' },
      valueGetter: (p: any) => p.data.credit || (p.data.transactionType === 'CR' ? p.data.amount : 0),
      cellRenderer: (p: any) => p.value ? `Rs. ${Number(p.value).toLocaleString()}` : '-'
    },
    { 
      field: 'runningBalance', 
      headerName: 'Balance', 
      width: 140,
      cellStyle: { textAlign: 'right', fontWeight: 'bold' },
      hide: filterType === 'ALL',
      cellRenderer: (p: any) => `Rs. ${Number(p.value || 0).toLocaleString()}`
    },
    {
      headerName: 'Action',
      width: 80,
      cellStyle: { textAlign: 'center' },
      cellRenderer: (p: any) => (
        <button
          onClick={() => {
            const t = p.data;
            const dr = t.debit || (t.transactionType === 'DR' ? t.amount : 0);
            const cr = t.credit || (t.transactionType === 'CR' ? t.amount : 0);
            setReceiptModal({
              isOpen: true,
              type: 'payment',
              data: {
                storeName: user?.companyName || settings?.storeName || 'Store ERP',
                storeAddress: user?.companyAddress || settings?.storeAddress || '',
                receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
                accountName: t.finHead?.name || selectedCustomerName || 'General Account',
                paymentDate: t.main?.date || new Date().toISOString(),
                amountPaid: dr || cr,
                paymentMode: dr ? 'Debit Voucher' : 'Credit Voucher',
                remarks: t.main?.description || 'General Ledger Entry',
                remainingBalance: t.runningBalance || 0,
                voucherType: dr ? 'Payment Voucher (DR)' : 'Receipt Voucher (CR)'
              }
            });
          }}
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
          title="Print Voucher Receipt"
        >
          <Printer size={12} /> Print
        </button>
      )
    }
  ];

  const defaultColDef = { sortable: true, filter: true, resizable: true };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '12px' }}>
        <h1 className="page-title">Master General Ledger</h1>
        <p className="page-subtitle">View all financial transactions with double-entry precision.</p>
      </div>

      <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label className="desktop-label">Entity Type</label>
          <select className="desktop-input" style={{ height: '32px' }} value={filterType} onChange={e => { setFilterType(e.target.value as any); setFilterId(''); }}>
            <option value="ALL">All Accounts</option>
            <option value="CUSTOMER">Specific Customer</option>
            <option value="VENDOR">Specific Vendor</option>
          </select>
        </div>

        {filterType === 'CUSTOMER' && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="desktop-label">Select Customer</label>
            <select className="desktop-input" style={{ height: '32px' }} value={filterId} onChange={e => setFilterId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">-- Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || c.custName} - Balance: Rs. {(c.CurrentBalance !== undefined ? c.CurrentBalance : (c.liveBalance || 0)).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterType === 'VENDOR' && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="desktop-label">Select Vendor</label>
            <select className="desktop-input" style={{ height: '32px' }} value={filterId} onChange={e => setFilterId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">-- Vendor --</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1, minWidth: '140px' }}>
          <label className="desktop-label">From Date</label>
          <input type="date" className="desktop-input" style={{ height: '32px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label className="desktop-label">To Date</label>
          <input type="date" className="desktop-input" style={{ height: '32px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <button className="btn-primary" onClick={applyFilters} style={{ padding: '6px 18px', height: '32px', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, borderRadius: '4px' }}>
          <Filter size={15} /> Apply Filters
        </button>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search descriptions..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="desktop-input"
              style={{ paddingLeft: '32px', height: '36px' }}
            />
          </div>
          
          <button 
            className="btn-secondary" 
            onClick={() => handlePrint()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Printer size={16} /> Print Ledger
          </button>
        </div>
        
        <div className="ag-theme-alpine" style={{ flex: 1, width: '100%' }}>
          <AgGridReact
            rowData={filteredRows}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            animateRows={true}
          />
        </div>
      </div>

      {/* HIDDEN PRINT CONTAINER FOR REACT-TO-PRINT */}
      <div style={{ display: 'none' }}>
        <PrintableLedger
          ref={printRef}
          storeName={user?.companyName || settings?.storeName || 'Store ERP'}
          storeAddress={user?.companyAddress || settings?.storeAddress || ''}
          customerName={selectedCustomerName}
          startDate={startDate}
          endDate={endDate}
          periodOpeningBalance={periodOpeningBalance}
          transactions={printableTransactions}
        />
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

export default GeneralLedger;
