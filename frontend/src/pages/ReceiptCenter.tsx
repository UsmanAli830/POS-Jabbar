import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Filter, Printer, Download, Eye, X, User, Truck, FileText, MapPin, DollarSign } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useReceiptActions } from '../hooks/useReceiptActions';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'sale', label: 'Sale' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sales-return', label: 'Sales Return' },
  { value: 'purchase-return', label: 'Purchase Return' },
  { value: 'payment', label: 'Payment' },
  { value: 'salary', label: 'Salary' },
];

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  'sale':            { bg: '#ecfdf5', color: '#059669', label: 'Sale' },
  'purchase':        { bg: '#eff6ff', color: '#2563eb', label: 'Purchase' },
  'sales-return':    { bg: '#fef3c7', color: '#d97706', label: 'Sales Return' },
  'purchase-return': { bg: '#fce7f3', color: '#db2777', label: 'Purchase Return' },
  'payment':         { bg: '#f0fdf4', color: '#16a34a', label: 'Payment' },
  'salary':          { bg: '#eef2ff', color: '#4f46e5', label: 'Salary' },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  'Paid':                 { bg: '#dcfce7', color: '#15803d' }, // Green
  'Partially Paid':       { bg: '#ffedd5', color: '#c2410c' }, // Orange
  'Adjusted in Balance': { bg: '#e0f2fe', color: '#0369a1' }, // Blue
  'Cash Refunded':       { bg: '#f3e8ff', color: '#7e22ce' }, // Purple
  'Pending':              { bg: '#fee2e2', color: '#b91c1c' }, // Red
  'Returned':             { bg: '#f1f5f9', color: '#475569' }, // Gray
  'Completed':            { bg: '#dcfce7', color: '#15803d' },
  'Received':             { bg: '#dcfce7', color: '#15803d' },
};

function buildReceiptData(row: any, settings: any): { type: ReceiptType; data: ReceiptData } {
  const base: Partial<ReceiptData> = {
    storeName: settings?.storeName || 'Wholesale ERP',
    storeAddress: settings?.storeAddress || '',
    receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
  };

  const raw = row.rawData || {};
  const type = row.type as ReceiptType;

  switch (type) {
    case 'sale': {
      const locs = raw.saleLocations?.map((sl: any) => sl.customerLocation?.locationName).filter(Boolean) || [];
      return {
        type,
        data: {
          ...base,
          invoiceNumber: row.invoiceNumber,
          date: row.date,
          customerName: row.accountName,
          locations: locs,
          paymentMethod: raw.paymentMethod || (raw.customerRecId ? 'Credit' : 'Cash'),
          items: (raw.details || []).map((d: any, i: number) => ({
            sr: i + 1,
            name: d.productRec?.productName || 'Product',
            qty: d.qty,
            rate: d.price,
            discPercent: d.discPercent || 0,
            cashDisc: d.cashDiscount || 0,
            netAmount: d.netAmount || (d.qty * d.price),
          })),
          grossAmount: raw.grossAmount || raw.totalAmount || 0,
          totalDiscount: raw.discountAmount || 0,
          netPayable: raw.totalAmount || 0,
          amountReceived: raw.paymentReceived || 0,
          changeReturn: Math.max(0, (raw.paymentReceived || 0) - (raw.totalAmount || 0)),
          balanceDue: Math.max(0, (raw.totalAmount || 0) - (raw.paymentReceived || 0)),
        },
      };
    }
    case 'purchase':
      return {
        type,
        data: {
          ...base,
          purchaseInvoiceNumber: row.invoiceNumber,
          date: row.date,
          vendorName: row.accountName,
          vendorLocation: raw.vendorLocation?.locationName || '',
          items: (raw.details || []).map((d: any, i: number) => ({
            sr: i + 1,
            name: d.productRec?.productName || 'Product',
            qty: d.qty,
            rate: d.price,
            netAmount: d.qty * d.price,
          })),
          grossAmount: raw.totalAmount || 0,
          netPayable: raw.totalAmount || 0,
        },
      };
    case 'sales-return':
      return {
        type,
        data: {
          ...base,
          originalInvoiceNumber: row.invoiceNumber,
          returnDate: row.date,
          customerName: row.accountName,
          returnItems: (raw.details || []).map((d: any, i: number) => ({
            sr: i + 1,
            name: d.productRec?.productName || 'Product',
            returnQty: d.qty,
            refundAmount: d.qty * d.price,
          })),
          totalRefund: raw.totalAmount || 0,
        },
      };
    case 'purchase-return':
      return {
        type,
        data: {
          ...base,
          originalInvoiceNumber: row.invoiceNumber,
          returnDate: row.date,
          vendorName: row.accountName,
          returnItems: (raw.details || []).map((d: any, i: number) => ({
            sr: i + 1,
            name: d.productRec?.productName || 'Product',
            returnQty: d.qty,
            refundAmount: d.qty * d.price,
          })),
          totalRefund: raw.totalAmount || 0,
          amountCredited: raw.totalAmount || 0,
        },
      };
    case 'payment':
      return {
        type,
        data: {
          ...base,
          accountName: row.accountName,
          paymentDate: row.date,
          amountPaid: raw.amount || row.amount || 0,
          paymentMode: 'Cash',
          remarks: raw.remarks || '',
          voucherType: raw.voucherType || 'Payment Voucher',
        },
      };
    case 'salary':
      return {
        type,
        data: {
          ...base,
          employeeName: raw.employeeRec?.name || row.accountName,
          designation: raw.employeeRec?.postRec?.title || '-',
          salaryMonth: new Date(row.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          paymentDate: row.date,
          grossSalary: raw.salaryAmount || 0,
          deductions: raw.deduction || 0,
          netPaid: raw.netAmount || row.amount || 0,
        },
      };
    default:
      return { type: 'sale', data: base as ReceiptData };
  }
}

const ReceiptCenter: React.FC = () => {
  const { settings } = useSettings();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [customerName, setCustomerName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerLocationId, setCustomerLocationId] = useState('');

  // Dropdowns
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customerLocations, setCustomerLocations] = useState<any[]>([]);
  const [finHeads, setFinHeads] = useState<any[]>([]);
  const [finHeadId, setFinHeadId] = useState('');

  // Modal
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({
    isOpen: false, type: 'sale', data: {},
  });

  // Quick print ref
  const quickPrintRef = useRef<HTMLDivElement>(null);
  const { handlePrint: quickPrint, handleDownloadPDF: quickDownload } = useReceiptActions(quickPrintRef);
  const [quickPrintData, setQuickPrintData] = useState<{ type: ReceiptType; data: ReceiptData } | null>(null);

  useEffect(() => {
    fetchDropdowns();
    handleSearch();
  }, []);

  useEffect(() => {
    if (customerName) {
      const cust = customers.find(c => (c.custName || c.name) === customerName);
      if (cust) {
        fetchCustomerLocations(cust.id);
      }
    } else {
      setCustomerLocations([]);
      setCustomerLocationId('');
    }
  }, [customerName, customers]);

  const fetchDropdowns = async () => {
    try {
      const [custRes, vendRes, finRes] = await Promise.all([
        fetch('http://localhost:3000/api/customers'),
        fetch('http://localhost:3000/api/vendors'),
        fetch('http://localhost:3000/api/finance/heads'),
      ]);
      if (custRes.ok) setCustomers(await custRes.json());
      if (vendRes.ok) setVendors(await vendRes.json());
      if (finRes.ok) setFinHeads(await finRes.json());
    } catch (e) {
      console.error('Failed to fetch dropdowns', e);
    }
  };

  const fetchCustomerLocations = async (custId: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/customers/${custId}/locations`);
      if (res.ok) setCustomerLocations(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customerName) params.set('customerName', customerName);
      if (vendorName) params.set('vendorName', vendorName);
      if (invoiceNumber) params.set('invoiceNumber', invoiceNumber);
      if (transactionType) params.set('type', transactionType);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (customerLocationId) params.set('customerLocationId', customerLocationId);
      if (finHeadId) params.set('finHeadId', finHeadId);

      const res = await fetch(`http://localhost:3000/api/receipts/search?${params.toString()}`);
      if (res.ok) setResults(await res.json());
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setCustomerName('');
    setVendorName('');
    setInvoiceNumber('');
    setTransactionType('');
    setDateFrom('');
    setDateTo('');
    setCustomerLocationId('');
    setFinHeadId('');
  };

  const openReceiptModal = (row: any) => {
    const { type, data } = buildReceiptData(row, settings);
    setReceiptModal({ isOpen: true, type, data });
  };

  const handleQuickDownload = (row: any) => {
    const { type, data } = buildReceiptData(row, settings);
    setReceiptModal({ isOpen: true, type, data });
    // The modal itself has the download button
  };

  const fmt = (n: number) => `Rs. ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="page-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Receipt Center</h1>
          <p className="page-subtitle">Search, view, print, and download receipts across all transaction types.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px',
          marginBottom: '14px', flexShrink: 0,
          padding: '14px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
        }}>
          {/* Customer Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <User size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Customer
            </label>
            <select
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="form-select"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            >
              <option value="">All Customers</option>
              {customers.map(c => <option key={c.id} value={c.custName || c.name}>{c.custName || c.name}</option>)}
            </select>
          </div>

          {/* Vendor Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Truck size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Vendor
            </label>
            <select
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              className="form-select"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            >
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.companyName}>{v.companyName}</option>)}
            </select>
          </div>

          {/* Invoice # */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <FileText size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Invoice #
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-42"
              className="form-input"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            />
          </div>

          {/* Transaction Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Filter size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Type
            </label>
            <select
              value={transactionType}
              onChange={e => setTransactionType(e.target.value)}
              className="form-select"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Date From */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Calendar size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="form-input"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            />
          </div>

          {/* Date To */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Calendar size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="form-input"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            />
          </div>

          {/* Customer Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <MapPin size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Location
            </label>
            <select
              value={customerLocationId}
              onChange={e => setCustomerLocationId(e.target.value)}
              disabled={customerLocations.length === 0}
              className="form-select"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            >
              <option value="">All Locations</option>
              {customerLocations.map(l => <option key={l.id} value={l.id}>{l.locationName}</option>)}
            </select>
          </div>

          {/* Financial Head */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <DollarSign size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Fin. Head
            </label>
            <select
              value={finHeadId}
              onChange={e => setFinHeadId(e.target.value)}
              className="form-select"
              style={{ height: '30px', fontSize: '12px', borderRadius: '4px' }}
            >
              <option value="">All Heads</option>
              {finHeads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        {/* Search + Clear buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexShrink: 0 }}>
          <button
            onClick={handleSearch}
            className="btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 18px', height: '32px', borderRadius: '4px', border: 'none',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            }}
          >
            <Search size={14} /> Search Receipts
          </button>
          <button
            onClick={() => { handleClearFilters(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', height: '32px', borderRadius: '4px', border: '1px solid #e2e8f0',
              background: '#fff', color: '#64748b',
              fontWeight: 600, fontSize: '12px', cursor: 'pointer',
            }}
          >
            <X size={14} /> Clear Filters
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: '12px', color: '#64748b', alignSelf: 'center', fontWeight: 600, background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* ===== RESULTS GRID ===== */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 10 }}>
              <tr>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '110px' }}>Date</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '130px' }}>Receipt Type</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px' }}>Account Name</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '120px' }}>Invoice #</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'right', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '130px' }}>Amount</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'center', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '130px' }}>Status</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'center', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Searching...</td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No receipts found. Adjust your filters and search again.</td></tr>
              ) : (
                results.map((row, idx) => {
                  const badge = TYPE_BADGE[row.type] || TYPE_BADGE['sale'];
                  return (
                    <tr
                      key={`${row.type}-${row.id}-${idx}`}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {new Date(row.date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
                          fontWeight: 700, fontSize: '10px', background: badge.bg, color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: '#0f172a', fontWeight: 600 }}>
                        {row.accountName}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
                        {row.invoiceNumber}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                        {fmt(row.amount)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {(() => {
                          const statusStyle = STATUS_BADGE[row.status] || { bg: '#f1f5f9', color: '#475569' };
                          return (
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
                              fontWeight: 700, fontSize: '10px',
                              background: statusStyle.bg,
                              color: statusStyle.color,
                            }}>
                              {row.status}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            onClick={() => openReceiptModal(row)}
                            title="View Receipt"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #e2e8f0',
                              background: '#fff', cursor: 'pointer', color: '#0284c7', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => {
                              const { type, data } = buildReceiptData(row, settings);
                              setReceiptModal({ isOpen: true, type, data });
                            }}
                            title="Print Receipt"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #e2e8f0',
                              background: '#fff', cursor: 'pointer', color: '#475569', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            onClick={() => handleQuickDownload(row)}
                            title="Download PDF"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '4px', border: 'none',
                              background: '#0284c7', cursor: 'pointer', color: '#fff', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />
    </div>
  );
};

export default ReceiptCenter;
