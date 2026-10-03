import React, { forwardRef } from 'react';

export type ReceiptType = 'sale' | 'purchase' | 'sales-return' | 'purchase-return' | 'payment' | 'salary';

export type HistoryLogItem = {
  id?: number;
  modifiedAt?: string | Date;
  changeDetails?: string;
  modifiedBy?: { id?: number; name?: string; username?: string };
};

export type ReceiptData = {
  id?: string | number;
  // Common
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptFooter?: string;
  historyLogs?: HistoryLogItem[];

  // Sale
  invoiceNumber?: string;
  date?: string | Date;
  customerName?: string;
  locations?: string[];
  salesmanName?: string;
  bookerName?: string;
  paymentMethod?: string;
  refNumber?: string;
  items?: ReceiptItem[];
  grossAmount?: number;
  totalDiscount?: number;
  deliveryCharges?: number;
  labourCharges?: number;
  deliveryRemarks?: string;
  netPayable?: number;
  amountReceived?: number;
  changeReturn?: number;
  balanceDue?: number;
  remainingBalance?: number;

  // Purchase
  vendorName?: string;
  vendorLocation?: string;
  supplyDate?: string;
  purchaseInvoiceNumber?: string;
  invoiceNo?: string;
  paymentTerms?: string;

  // Returns
  originalInvoiceNumber?: string;
  originalInvoiceNo?: string;
  returnDate?: string | Date;
  returnItems?: ReturnReceiptItem[];
  totalRefund?: number;
  refundAmount?: number;
  cashRefunded?: number;
  cashReturned?: number;
  cashReceivedFromVendor?: number;
  balanceAdjusted?: number;
  amountCredited?: number;
  additionalCashReceived?: number;
  additionalCashPaid?: number;
  remarks?: string;

  // Payment Voucher
  accountName?: string;
  paymentDate?: string | Date;
  amountPaid?: number;
  paymentMode?: string;
  reference?: string;
  voucherType?: string;

  // Salary
  employeeName?: string;
  designation?: string;
  salaryMonth?: string;
  monthYear?: string;
  baseSalary?: number;
  allowances?: number;
  grossSalary?: number;
  deductions?: number;
  netSalary?: number;
  netPaid?: number;
};

export type ReceiptItem = {
  sr?: number;
  name: string;
  qty: number;
  unitType?: string;
  rate?: number;
  price?: number;
  discPercent?: number;
  cashDisc?: number;
  cashDiscount?: number;
  netAmount: number;
  isDamaged?: boolean;
};

export type ReturnReceiptItem = {
  sr?: number;
  name: string;
  returnQty: number;
  refundAmount: number;
  rate?: number;
};

type ReceiptDocumentProps = {
  type: ReceiptType;
  data: ReceiptData;
};

const RECEIPT_COLORS: Record<ReceiptType, { bg: string; accent: string; label: string }> = {
  'sale':            { bg: '#ecfdf5', accent: '#059669', label: 'Sales Invoice' },
  'purchase':        { bg: '#eff6ff', accent: '#2563eb', label: 'Goods Receive Note / Purchase Order' },
  'sales-return':    { bg: '#fef3c7', accent: '#d97706', label: 'Sales/Purchase Return Credit Note' },
  'purchase-return': { bg: '#fce7f3', accent: '#db2777', label: 'Purchase Return Credit Note' },
  'payment':         { bg: '#f0fdf4', accent: '#16a34a', label: 'Official Payment Voucher' },
  'salary':          { bg: '#eef2ff', accent: '#4f46e5', label: 'Employee Salary Slip' },
};

const s = {
  page: { 
    fontFamily: '"Segoe UI", "Inter", system-ui, sans-serif', 
    fontSize: '12px', 
    color: '#0f172a', 
    width: '100%', 
    boxSizing: 'border-box' as const, 
    background: '#ffffff',
    padding: '24px 20px',
  },
  header: { textAlign: 'center' as const, marginBottom: '14px' },
  storeName: { fontSize: '22px', fontWeight: 800 as const, margin: '0 0 2px 0', color: '#000000', letterSpacing: '0.5px' },
  storeAddr: { fontSize: '11px', color: '#334155', margin: '0' },
  badge: (color: string, bg: string) => ({ 
    display: 'inline-block', 
    padding: '4px 16px', 
    borderRadius: '100px', 
    fontWeight: 700 as const, 
    fontSize: '12px', 
    color, 
    background: bg, 
    marginTop: '8px', 
    letterSpacing: '0.4px',
    border: '1px solid currentColor'
  }),
  sep: { borderBottom: '1.5px dashed #64748b', margin: '10px 0' },
  metaRow: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: '4px', fontSize: '12px' },
  metaLabel: { fontWeight: 600 as const, color: '#334155' },
  metaValue: { fontWeight: 700 as const, color: '#000000', textAlign: 'right' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, border: '1px solid #475569', marginTop: '8px', marginBottom: '8px' },
  th: { padding: '6px 8px', border: '1px solid #475569', textAlign: 'left' as const, fontWeight: 700 as const, fontSize: '11px', color: '#0f172a', textTransform: 'uppercase' as const, letterSpacing: '0.4px', backgroundColor: '#f1f5f9' },
  thRight: { padding: '6px 8px', border: '1px solid #475569', textAlign: 'right' as const, fontWeight: 700 as const, fontSize: '11px', color: '#0f172a', textTransform: 'uppercase' as const, letterSpacing: '0.4px', backgroundColor: '#f1f5f9' },
  td: { padding: '6px 8px', border: '1px solid #64748b', fontSize: '11px', color: '#000000', textAlign: 'left' as const },
  tdRight: { padding: '6px 8px', border: '1px solid #64748b', fontSize: '11px', textAlign: 'right' as const, color: '#000000', fontWeight: 600 as const },
  totalRow: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: '4px 0', fontSize: '12px' },
  totalLabel: { fontWeight: 600 as const, color: '#334155' },
  totalValue: { fontWeight: 700 as const, color: '#000000' },
  grandTotal: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: '8px 0', fontSize: '15px', fontWeight: 800 as const, color: '#000000', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', margin: '6px 0' },
  footer: { textAlign: 'center' as const, marginTop: '16px', fontSize: '11px', color: '#475569', fontWeight: 600 as const },
};

const fmt = (n?: number) => n !== undefined && n !== null ? `Rs. ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs. 0.00';

const formatDateTimeWithSeconds = (d?: string | Date | null) => {
  if (!d) return '-';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return String(d);
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const MetaRow: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div style={s.metaRow}>
      <span style={s.metaLabel}>{label}:</span>
      <span style={s.metaValue}>{value}</span>
    </div>
  );
};

/* ======== SALE RECEIPT ======== */
const SaleReceipt: React.FC<{ d: ReceiptData }> = ({ d }) => (
  <>
    <MetaRow label="Invoice #" value={d.invoiceNumber} />
    <MetaRow label="Date & Time" value={formatDateTimeWithSeconds(d.date)} />
    <MetaRow label="Customer" value={d.customerName || 'Walk-in Customer'} />
    {d.locations && d.locations.length > 0 && <MetaRow label="Route / Delivery Location" value={d.locations.join(', ')} />}
    <MetaRow label="Salesman" value={d.salesmanName || 'Direct / Admin'} />
    {d.bookerName && <MetaRow label="Order Booker" value={d.bookerName} />}
    <MetaRow label="Payment Method" value={d.paymentMethod || 'Cash'} />
    {d.refNumber && <MetaRow label="Reference #" value={d.refNumber} />}
    {d.deliveryRemarks && <MetaRow label="Delivery Notes" value={d.deliveryRemarks} />}
    <div style={s.sep} />
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Sr#</th>
          <th style={s.th}>Item Description</th>
          <th style={s.thRight}>Qty</th>
          <th style={s.thRight}>Rate</th>
          <th style={s.thRight}>Disc%</th>
          <th style={s.thRight}>Cash Disc</th>
          <th style={s.thRight}>Net Amt</th>
        </tr>
      </thead>
      <tbody>
        {(d.items || []).map((item, i) => (
          <tr key={i} style={{ pageBreakInside: 'avoid' }}>
            <td style={s.td}>{item.sr || i + 1}</td>
            <td style={s.td}>{item.name} {item.unitType === 'CARTON' ? '(Carton)' : ''}</td>
            <td style={s.tdRight}>{item.qty} {item.unitType === 'CARTON' ? 'Ctn' : 'Pcs'}</td>
            <td style={s.tdRight}>{fmt(item.rate ?? item.price)}</td>
            <td style={s.tdRight}>{item.discPercent ?? 0}%</td>
            <td style={s.tdRight}>{fmt(item.cashDisc ?? item.cashDiscount ?? 0)}</td>
            <td style={s.tdRight}>{fmt(item.netAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={s.sep} />
    <div style={s.totalRow}><span style={s.totalLabel}>Gross Amount (Subtotal)</span><span style={s.totalValue}>{fmt(d.grossAmount)}</span></div>
    {(d.totalDiscount ?? 0) > 0 && (
      <div style={s.totalRow}><span style={s.totalLabel}>Total Discounts (Item + Bill Level)</span><span style={{ ...s.totalValue, color: '#dc2626' }}>-{fmt(d.totalDiscount)}</span></div>
    )}
    {(d.deliveryCharges ?? 0) > 0 && (
      <div style={s.totalRow}><span style={s.totalLabel}>Freight / Delivery Charges</span><span style={{ ...s.totalValue, color: '#0284c7' }}>+{fmt(d.deliveryCharges)}</span></div>
    )}
    {(d.labourCharges ?? 0) > 0 && (
      <div style={s.totalRow}><span style={s.totalLabel}>Labour / Handling Charges</span><span style={{ ...s.totalValue, color: '#0284c7' }}>+{fmt(d.labourCharges)}</span></div>
    )}
    <div style={s.grandTotal}><span>Net Payable</span><span>{fmt(d.netPayable)}</span></div>
    {d.amountReceived !== undefined && <div style={s.totalRow}><span style={s.totalLabel}>Cash Received</span><span style={s.totalValue}>{fmt(d.amountReceived)}</span></div>}
    {(d.changeReturn ?? 0) > 0 && <div style={s.totalRow}><span style={s.totalLabel}>Change Returned</span><span style={{ ...s.totalValue, color: '#16a34a' }}>{fmt(d.changeReturn)}</span></div>}
    {(d.balanceDue ?? 0) > 0 && <div style={s.totalRow}><span style={s.totalLabel}>Current Bill Balance Due</span><span style={{ ...s.totalValue, color: '#dc2626' }}>{fmt(d.balanceDue)}</span></div>}
    {d.remainingBalance !== undefined && (
      <div style={{ ...s.totalRow, borderTop: '1.5px dashed #475569', marginTop: '6px', paddingTop: '6px' }}>
        <span style={{ ...s.totalLabel, fontWeight: 700 }}>Client's Live Remaining Balance</span>
        <span style={{ ...s.totalValue, fontWeight: 800, fontSize: '13px' }}>{fmt(d.remainingBalance)}</span>
      </div>
    )}
  </>
);

/* ======== PURCHASE RECEIPT ======== */
const PurchaseReceipt: React.FC<{ d: ReceiptData }> = ({ d }) => (
  <>
    <MetaRow label="PO / GRN #" value={d.purchaseInvoiceNumber || d.invoiceNumber} />
    <MetaRow label="Date & Time" value={formatDateTimeWithSeconds(d.date)} />
    <MetaRow label="Supplier / Vendor" value={d.vendorName} />
    {d.vendorLocation && <MetaRow label="Supplier Location" value={d.vendorLocation} />}
    {d.supplyDate && <MetaRow label="Supply Date" value={formatDateTimeWithSeconds(d.supplyDate)} />}
    <MetaRow label="Payment Terms" value={d.paymentTerms || d.paymentMethod || 'Credit Account'} />
    <div style={s.sep} />
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Sr#</th>
          <th style={s.th}>Product / Item</th>
          <th style={s.thRight}>Received Qty</th>
          <th style={s.thRight}>Cost Price</th>
          <th style={s.thRight}>Line Total</th>
        </tr>
      </thead>
      <tbody>
        {(d.items || []).map((item, i) => (
          <tr key={i} style={{ pageBreakInside: 'avoid' }}>
            <td style={s.td}>{item.sr || i + 1}</td>
            <td style={s.td}>{item.name}</td>
            <td style={s.tdRight}>{item.qty}</td>
            <td style={s.tdRight}>{fmt(item.rate ?? item.price)}</td>
            <td style={s.tdRight}>{fmt(item.netAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={s.sep} />
    <div style={s.grandTotal}><span>Total Order Value</span><span>{fmt(d.netPayable || d.grossAmount)}</span></div>
    {d.amountPaid !== undefined && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Cash Paid to Vendor</span>
        <span style={{ ...s.totalValue, color: '#16a34a' }}>{fmt(d.amountPaid)}</span>
      </div>
    )}
    {d.balanceDue !== undefined && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Adjusted in Vendor Balance</span>
        <span style={{ ...s.totalValue, color: '#dc2626' }}>{fmt(d.balanceDue)}</span>
      </div>
    )}
    {d.remainingBalance !== undefined && (
      <div style={{ ...s.totalRow, borderTop: '1.5px dashed #475569', marginTop: '6px', paddingTop: '6px' }}>
        <span style={{ ...s.totalLabel, fontWeight: 700 }}>Vendor Live Outstanding Payable</span>
        <span style={{ ...s.totalValue, fontWeight: 800, fontSize: '13px' }}>{fmt(d.remainingBalance)}</span>
      </div>
    )}
  </>
);

/* ======== SALES RETURN RECEIPT ======== */
const SalesReturnReceipt: React.FC<{ d: ReceiptData }> = ({ d }) => (
  <>
    <MetaRow label="Return Ref #" value={d.id ? (String(d.id).startsWith('SRTN-') ? String(d.id) : `SRTN-${d.id}`) : '-'} />
    <MetaRow label="Original Sales Invoice #" value={d.originalInvoiceNumber || d.originalInvoiceNo || '-'} />
    <MetaRow label="Return Date & Time" value={formatDateTimeWithSeconds(d.returnDate || d.date)} />
    <MetaRow label="Customer" value={d.customerName || 'Walk-in'} />
    {d.remarks && <MetaRow label="Remarks / Reasons" value={d.remarks} />}
    <div style={s.sep} />
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Sr#</th>
          <th style={s.th}>Returned Item</th>
          <th style={s.thRight}>Return Qty</th>
          <th style={s.thRight}>Refund Value</th>
        </tr>
      </thead>
      <tbody>
        {(d.returnItems || []).map((item, i) => (
          <tr key={i} style={{ pageBreakInside: 'avoid' }}>
            <td style={s.td}>{item.sr || i + 1}</td>
            <td style={s.td}>{item.name}</td>
            <td style={s.tdRight}>{item.returnQty}</td>
            <td style={s.tdRight}>{fmt(item.refundAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={s.sep} />
    <div style={s.totalRow}><span style={s.totalLabel}>Total Refund Value</span><span style={{ ...s.totalValue, fontSize: '14px', color: '#dc2626' }}>{fmt(d.totalRefund || d.refundAmount)}</span></div>
    {(d.cashReturned !== undefined || d.cashRefunded !== undefined) && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Cash Refunded to Customer</span>
        <span style={{ ...s.totalValue, color: '#16a34a' }}>{fmt(d.cashReturned ?? d.cashRefunded ?? 0)}</span>
      </div>
    )}
    {d.balanceAdjusted !== undefined && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Customer Balance Adjusted</span>
        <span style={{ ...s.totalValue, color: '#0284c7' }}>{fmt(d.balanceAdjusted)}</span>
      </div>
    )}
    {(d.additionalCashReceived || 0) > 0 && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Additional Cash Received</span>
        <span style={{ ...s.totalValue, color: '#16a34a' }}>{fmt(d.additionalCashReceived)}</span>
      </div>
    )}
    {d.remainingBalance !== undefined && (
      <div style={{ ...s.totalRow, borderTop: '1.5px dashed #475569', marginTop: '6px', paddingTop: '6px' }}>
        <span style={{ ...s.totalLabel, fontWeight: 700 }}>Client's Live Remaining Balance</span>
        <span style={{ ...s.totalValue, fontWeight: 800, fontSize: '13px' }}>{fmt(d.remainingBalance)}</span>
      </div>
    )}
  </>
);

/* ======== PURCHASE RETURN RECEIPT ======== */
const PurchaseReturnReceipt: React.FC<{ d: ReceiptData }> = ({ d }) => (
  <>
    <MetaRow label="Return Ref #" value={d.id ? (String(d.id).startsWith('PRTN-') ? String(d.id) : `PRTN-${d.id}`) : '-'} />
    <MetaRow label="Original Purchase Invoice #" value={d.originalInvoiceNumber || d.purchaseInvoiceNumber || '-'} />
    <MetaRow label="Return Date & Time" value={formatDateTimeWithSeconds(d.returnDate || d.date)} />
    <MetaRow label="Vendor" value={d.vendorName} />
    {d.remarks && <MetaRow label="Remarks" value={d.remarks} />}
    <div style={s.sep} />
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Sr#</th>
          <th style={s.th}>Returned Item</th>
          <th style={s.thRight}>Return Qty</th>
          <th style={s.thRight}>Cost Rate</th>
          <th style={s.thRight}>Refund Value</th>
        </tr>
      </thead>
      <tbody>
        {(d.returnItems || []).map((item, i) => (
          <tr key={i} style={{ pageBreakInside: 'avoid' }}>
            <td style={s.td}>{item.sr || i + 1}</td>
            <td style={s.td}>{item.name}</td>
            <td style={s.tdRight}>{item.returnQty}</td>
            <td style={s.tdRight}>{fmt(item.rate)}</td>
            <td style={s.tdRight}>{fmt(item.refundAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={s.sep} />
    <div style={s.totalRow}><span style={s.totalLabel}>Total Refund Value</span><span style={{ ...s.totalValue, fontSize: '14px', color: '#db2777' }}>{fmt(d.amountCredited || d.totalRefund)}</span></div>
    {d.cashReceivedFromVendor !== undefined && d.cashReceivedFromVendor > 0 && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Cash Refund Received from Vendor</span>
        <span style={{ ...s.totalValue, color: '#16a34a' }}>{fmt(d.cashReceivedFromVendor)}</span>
      </div>
    )}
    {d.balanceAdjusted !== undefined && d.balanceAdjusted > 0 && (
      <div style={s.totalRow}>
        <span style={s.totalLabel}>Vendor Balance Adjusted</span>
        <span style={{ ...s.totalValue, color: '#0284c7' }}>{fmt(d.balanceAdjusted)}</span>
      </div>
    )}
    {d.remainingBalance !== undefined && (
      <div style={{ ...s.totalRow, borderTop: '1.5px dashed #475569', marginTop: '6px', paddingTop: '6px' }}>
        <span style={{ ...s.totalLabel, fontWeight: 700 }}>Vendor Live Outstanding Balance</span>
        <span style={{ ...s.totalValue, fontWeight: 800, fontSize: '13px' }}>{fmt(d.remainingBalance)}</span>
      </div>
    )}
  </>
);

/* ======== PAYMENT VOUCHER ======== */
const PaymentReceipt: React.FC<{ d: ReceiptData }> = ({ d }) => (
  <>
    <MetaRow label="Voucher Type" value={d.voucherType || 'Receipt / Payment Voucher'} />
    <MetaRow label="Client / Account Name" value={d.accountName} />
    <MetaRow label="Payment Date & Time" value={formatDateTimeWithSeconds(d.paymentDate || d.date)} />
    <div style={s.sep} />
    <div style={{ ...s.grandTotal, borderTop: 'none', marginTop: 0 }}>
      <span>Amount Transacted</span>
      <span>{fmt(d.amountPaid)}</span>
    </div>
    <MetaRow label="Payment Mode" value={d.paymentMode || 'Cash'} />
    {d.reference && <MetaRow label="Reference Notes" value={d.reference} />}
    <div style={s.sep} />
    {d.remainingBalance !== undefined && (
      <div style={s.totalRow}>
        <span style={{ ...s.totalLabel, fontWeight: 700 }}>Live Outstanding Balance Remaining</span>
        <span style={{ ...s.totalValue, fontWeight: 800, color: d.remainingBalance > 0 ? '#dc2626' : '#16a34a' }}>
          {fmt(Math.abs(d.remainingBalance))} {d.remainingBalance > 0 ? '(Due)' : d.remainingBalance < 0 ? '(Advance/Overpaid)' : '(Fully Settled)'}
        </span>
      </div>
    )}
  </>
);

/* ======== SALARY SLIP ======== */
const SalaryReceipt: React.FC<{ d: ReceiptData }> = ({ d }) => (
  <>
    <MetaRow label="Employee Name" value={d.employeeName} />
    <MetaRow label="Designation / Role" value={d.designation || 'Staff'} />
    <MetaRow label="Salary Month & Year" value={d.salaryMonth || d.monthYear} />
    <MetaRow label="Disbursal Date & Time" value={formatDateTimeWithSeconds(d.paymentDate || d.date)} />
    <div style={s.sep} />
    <div style={s.totalRow}><span style={s.totalLabel}>Base Salary / Wage</span><span style={s.totalValue}>{fmt(d.baseSalary)}</span></div>
    {(d.allowances ?? 0) > 0 && <div style={s.totalRow}><span style={s.totalLabel}>Commission & Allowances</span><span style={{ ...s.totalValue, color: '#16a34a' }}>+{fmt(d.allowances)}</span></div>}
    {(d.deductions ?? 0) > 0 && <div style={s.totalRow}><span style={s.totalLabel}>Deductions (Absents & Advances)</span><span style={{ ...s.totalValue, color: '#dc2626' }}>-{fmt(d.deductions)}</span></div>}
    <div style={s.grandTotal}><span>Net Salary Paid</span><span>{fmt(d.netPaid || d.netSalary)}</span></div>
    <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#334155' }}>
      <div>
        <div style={{ borderBottom: '1px solid #475569', width: '150px', marginBottom: '4px' }}></div>
        <span>Employee Signature</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ borderBottom: '1px solid #475569', width: '150px', marginBottom: '4px', marginLeft: 'auto' }}></div>
        <span>Authorized Signature</span>
      </div>
    </div>
  </>
);

/* ======== MAIN DOCUMENT ======== */
const ReceiptDocument = forwardRef<HTMLDivElement, ReceiptDocumentProps>(({ type, data }, ref) => {
  const config = RECEIPT_COLORS[type];

  const renderBody = () => {
    switch (type) {
      case 'sale': return <SaleReceipt d={data} />;
      case 'purchase': return <PurchaseReceipt d={data} />;
      case 'sales-return': return <SalesReturnReceipt d={data} />;
      case 'purchase-return': return <PurchaseReturnReceipt d={data} />;
      case 'payment': return <PaymentReceipt d={data} />;
      case 'salary': return <SalaryReceipt d={data} />;
      default: return null;
    }
  };

  return (
    <div ref={ref} style={s.page} className="receipt-print-wrapper">
      <style>{`
        @media print {
          @page {
            margin: 8mm;
            size: auto;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, nav, header, sidebar, footer, button, .filter-container {
            display: none !important;
          }
          .receipt-print-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          table {
            border-collapse: collapse !important;
          }
          th, td {
            color: #000000 !important;
            border-color: #000000 !important;
          }
        }
      `}</style>
      
      {/* Centered Dynamic Header */}
      <div style={s.header}>
        <h2 style={s.storeName}>{data.storeName || 'Store ERP'}</h2>
        {data.storeAddress && <p style={s.storeAddr}>{data.storeAddress}</p>}
        {data.storePhone && <p style={{ ...s.storeAddr, marginTop: '2px' }}>Tel: {data.storePhone}</p>}
        <div style={s.badge(config.accent, config.bg)}>{config.label}</div>
      </div>

      <div style={s.sep} />

      {/* Body */}
      {renderBody()}

      {/* Invoice Modification History (if available) */}
      {data.historyLogs && data.historyLogs.length > 0 && (
        <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1.5px dashed #64748b' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
            📜 Invoice Modification History ({data.historyLogs.length} Edits)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.historyLogs.map((log, idx) => (
              <div key={log.id || idx} style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0284c7', marginBottom: '2px' }}>
                  <span>Modified By: {log.modifiedBy?.name || log.modifiedBy?.username || 'Staff'}</span>
                  <span>{log.modifiedAt ? new Date(log.modifiedAt).toLocaleString() : ''}</span>
                </div>
                <div style={{ color: '#334155', lineHeight: 1.3 }}>
                  {log.changeDetails}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={s.footer}>
        {data.receiptFooter || `Thank you for your business! — ${data.storeName || 'Store ERP'}`}
      </div>
    </div>
  );
});

ReceiptDocument.displayName = 'ReceiptDocument';

export default ReceiptDocument;

