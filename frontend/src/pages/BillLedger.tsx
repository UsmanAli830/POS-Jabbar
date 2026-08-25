import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Search, X, Printer, PackageMinus, UserMinus, Filter } from 'lucide-react';
import Receipt from '../components/Receipt';
import PrintableMasterLedger from '../components/PrintableMasterLedger';
import PrintableLedger from '../components/PrintableLedger';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';
import { useReactToPrint } from 'react-to-print';

const BillLedger: React.FC = () => {
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [selectedRowData, setSelectedRowData] = useState<any>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | number | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'payment', data: {} });
  
  const voucherPrintRef = useRef<HTMLDivElement>(null);
  const masterLedgerPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintVoucher = useReactToPrint({ contentRef: voucherPrintRef });
  const handlePrintMasterLedger = useReactToPrint({ contentRef: masterLedgerPrintRef });
  
  const { settings } = useSettings();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/sales/master-ledger`);
      if (res.ok) {
        setRawTransactions(await res.json());
      }
    } catch(e) {
      console.error(e);
    }
  };

  const uniqueCustomers = useMemo(() => {
    const names = rawTransactions.map(t => t.customerName).filter(Boolean);
    return ['All Customers', ...Array.from(new Set(names))].sort();
  }, [rawTransactions]);

  const filteredLedger = useMemo(() => {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    
    const balances: Record<string, number> = {};
    const processed: any[] = [];
    let specificCustomerOpening = 0;

    for (const t of rawTransactions) {
      const debit = t.debit || 0;
      const credit = t.credit || 0;

      // Group walk-ins under one key 'Walk-in', or use customerName if ID is missing
      const cId = t.customerId ? `cust-${t.customerId}` : t.customerName;
      if (!balances[cId]) balances[cId] = 0;
      
      // Calculate running balance per distinct customer entity
      balances[cId] += (debit - credit);

      const cName = t.customerName || 'Unknown';
      const tTime = new Date(t.date).getTime();

      const matchesCustomer = customerFilter === 'All Customers' || cName === customerFilter;
      const isBeforeStart = tTime < start;
      const isAfterEnd = tTime > (end + 86400000); // include the end date day fully

      if (matchesCustomer) {
        if (isBeforeStart) {
          if (customerFilter !== 'All Customers') {
            specificCustomerOpening += (debit - credit);
          }
        } else if (!isAfterEnd) {
          processed.push({
            ...t,
            customerName: cName,
            debit,
            credit,
            runningBalance: balances[cId]
          });
        }
      }
    }

    if (customerFilter !== 'All Customers' && startDate) {
      processed.unshift({
        date: startDate,
        customerName: customerFilter,
        referenceId: '-',
        remarks: 'Opening Balance',
        debit: 0,
        credit: 0,
        runningBalance: specificCustomerOpening,
        isOpening: true
      });
    }

    return processed.reverse();
  }, [rawTransactions, startDate, endDate, customerFilter]);

  const columns: ColDef[] = [
    { field: 'date', headerName: 'Date', valueFormatter: p => new Date(p.value).toLocaleDateString(), width: 120 },
    { field: 'customerName', headerName: 'Customer', flex: 1.5, minWidth: 160, filter: true },
    { field: 'referenceId', headerName: 'Bill / Ref', width: 130, filter: true, cellRenderer: (p: any) => <span style={{ color: '#0284c7', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>{p.value || '-'}</span> },
    { field: 'remarks', headerName: 'Remarks', flex: 2, minWidth: 180, cellStyle: p => p.data.isOpening ? { fontWeight: 'bold', fontStyle: 'italic' } : null },
    { field: 'debit', headerName: 'Debit (Dr)', width: 130, cellStyle: { textAlign: 'right' }, cellRenderer: (params: any) => params.value ? <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Rs. {params.value.toLocaleString()}</span> : '-' },
    { field: 'credit', headerName: 'Credit (Cr)', width: 130, cellStyle: { textAlign: 'right' }, cellRenderer: (params: any) => params.value ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Rs. {params.value.toLocaleString()}</span> : '-' },
    { field: 'runningBalance', headerName: 'Current Balance', width: 140, cellStyle: { textAlign: 'right', fontWeight: 'bold' }, cellRenderer: (params: any) => <span style={{ fontWeight: 'bold' }}>Rs. {(params.value || 0).toLocaleString()}</span> },
    {
      headerName: 'Action',
      width: 80,
      cellStyle: { textAlign: 'center' },
      cellRenderer: (params: any) => {
        if (params.data?.isOpening) return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const t = params.data;
              const isSale = t.debit > 0;
              setReceiptModal({
                isOpen: true,
                type: isSale ? 'sale' : 'payment',
                data: {
                  id: t.referenceId || t.id,
                  storeName: settings?.storeName || 'Wholesale ERP',
                  storeAddress: settings?.storeAddress || '',
                  receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
                  date: t.date,
                  customerName: t.customerName || 'Customer',
                  paymentMode: 'Ledger Entry',
                  remarks: t.remarks,
                  amountPaid: t.credit || t.debit,
                  accountName: t.customerName,
                  remainingBalance: t.runningBalance
                }
              });
            }}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
            title="Print Receipt"
          >
            <Printer size={12} /> Print
          </button>
        );
      }
    }
  ];

  const handleRowClick = async (e: any) => {
    const t = e.data;
    if (t.isOpening) return;

    if (t.referenceId && (t.referenceId.startsWith('INV-') || t.referenceId.startsWith('SALE-') || !isNaN(Number(t.referenceId.replace(/\D/g, ''))))) {
      const cleanId = t.referenceId.replace(/\D/g, '');
      if (cleanId) {
        setSelectedInvoiceId(cleanId);
        setShowInvoiceModal(true);
        return;
      }
    }

    setSelectedRowData(t);
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      <div className="page-header" style={{ marginBottom: '0' }}>
        <h1 className="page-title">Master Sales Ledger</h1>
        <p className="page-subtitle">Chronological ledger journal & bill register for all customer accounts.</p>
      </div>

      <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label className="desktop-label">Customer</label>
          <select 
            value={customerFilter} 
            onChange={e => setCustomerFilter(e.target.value)}
            className="desktop-input"
            style={{ height: '32px' }}
          >
            {uniqueCustomers.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label className="desktop-label">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="desktop-input"
            style={{ height: '32px' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label className="desktop-label">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="desktop-input"
            style={{ height: '32px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); setCustomerFilter('All Customers'); }}
            style={{ padding: '6px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, height: '32px', fontSize: '12px' }}>
            Clear Filters
          </button>
          <button 
            onClick={handlePrintMasterLedger}
            className="btn-primary"
            style={{ padding: '6px 16px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <Printer size={15} /> Print Ledger
          </button>
        </div>
      </div>

      <div className="ag-theme-alpine" style={{ flex: 1, width: '100%' }}>
        <AgGridReact
          rowData={filteredLedger}
          columnDefs={columns}
          onRowClicked={handleRowClick}
          rowSelection="single"
        />
      </div>

      {selectedRowData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '1000px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Transaction Voucher Preview</h3>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Ledger Record Summary</div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handlePrintVoucher} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  <Printer size={16} /> 🖨️ Print Transaction Voucher
                </button>
                <button onClick={() => setSelectedRowData(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Customer</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Bill / Ref</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Remarks</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Debit (Dr)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Credit (Cr)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '16px', color: '#0f172a' }}>{new Date(selectedRowData.date).toLocaleDateString()}</td>
                      <td style={{ padding: '16px', color: '#0f172a' }}>{selectedRowData.customerName || 'Walk-in'}</td>
                      <td style={{ padding: '16px', color: '#0f172a' }}>{selectedRowData.referenceId || '-'}</td>
                      <td style={{ padding: '16px', color: '#0f172a' }}>{selectedRowData.remarks || '-'}</td>
                      <td style={{ padding: '16px', color: '#be123c', fontWeight: 600, textAlign: 'right' }}>{selectedRowData.debit > 0 ? `Rs. ${selectedRowData.debit.toLocaleString()}` : '-'}</td>
                      <td style={{ padding: '16px', color: '#15803d', fontWeight: 600, textAlign: 'right' }}>{selectedRowData.credit > 0 ? `Rs. ${selectedRowData.credit.toLocaleString()}` : '-'}</td>
                      <td style={{ padding: '16px', color: '#1e3a8a', fontWeight: 700, textAlign: 'right' }}>Rs. ${(selectedRowData.runningBalance || 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Containers */}
      <div style={{ display: 'none' }}>
        {selectedRowData && (
          <PrintableLedger
            ref={voucherPrintRef}
            title="TRANSACTION VOUCHER"
            entity={{
              name: selectedRowData.customerName || 'Walk-in',
              phone: null,
              address: null,
              type: 'Customer'
            }}
            transactions={[{
              date: selectedRowData.date,
              entityName: selectedRowData.customerName || 'Walk-in',
              referenceId: selectedRowData.referenceId,
              remarks: selectedRowData.remarks,
              debit: selectedRowData.debit,
              credit: selectedRowData.credit,
              runningBalance: selectedRowData.runningBalance
            }]}
          />
        )}

        {settings && (
          <PrintableMasterLedger 
            ref={masterLedgerPrintRef}
            storeName={settings.storeName || 'HBN Tech POS'}
            filters={{ startDate, endDate, customerName: customerFilter }}
            transactions={filteredLedger.slice().reverse()}
          />
        )}
      </div>

      <InvoiceDetailsModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        invoiceId={selectedInvoiceId}
        onReturnSuccess={fetchTransactions}
      />
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />

    </div>
  );
};

export default BillLedger;
