import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Trash2, CheckCircle, AlertTriangle, User, Calendar, FileText, Printer, Package, ShoppingCart } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
type ReturnItem = {
  id: number;
  productRecId: number;
  barCode: string;
  productCode: string;
  productName: string;
  originalQty: number;
  qty: number; // Return Qty
  price: number;
  grossAmount: number;
  netAmount: number;
  discPercent: number;
  cashDiscount: number;
  discountOrder?: 'PERCENT_FIRST' | 'CASH_FIRST' | null;
  isDamaged: boolean;
};

function calculateLineNet(qty: number, price: number, discPercent: number, cashDiscount: number, discountOrder?: 'PERCENT_FIRST' | 'CASH_FIRST' | null) {
  if (qty <= 0) return 0;
  const gross = qty * price;
  const pct = Math.min(100, Math.max(0, discPercent || 0));
  const cash = Math.max(0, cashDiscount || 0);

  if (discountOrder === 'CASH_FIRST') {
    const subtotal = Math.max(0, gross - cash);
    return Math.max(0, subtotal - (subtotal * (pct / 100)));
  } else if (discountOrder === 'PERCENT_FIRST') {
    const subtotal = Math.max(0, gross - (gross * (pct / 100)));
    return Math.max(0, subtotal - cash);
  } else {
    if (pct > 0 && cash > 0) {
      const subtotal = Math.max(0, gross - (gross * (pct / 100)));
      return Math.max(0, subtotal - cash);
    }
    if (pct > 0) return Math.max(0, gross - (gross * (pct / 100)));
    if (cash > 0) return Math.max(0, gross - cash);
    return gross;
  }
}

const SalesReturn: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Header State
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customers, setCustomers] = useState<{ id: number; custName: string; name?: string; liveBalance?: number }[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [selectedCustomerInvoiceId, setSelectedCustomerInvoiceId] = useState<string>('');
  
  // Manual Backdate State
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);

  // Split Settlement State (Phase 46)
  const [cashReturned, setCashReturned] = useState<number>(0);
  const [additionalCashReceived, setAdditionalCashReceived] = useState<number>(0);

  // Return Grid Items
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Invoice Details Modal State
  const [viewingReceiptInvoice, setViewingReceiptInvoice] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'sales-return', data: {} });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (customerId) {
      fetchCustomerBalance(Number(customerId));
      fetchCustomerInvoices(Number(customerId));
    } else {
      setCustomerBalance(null);
      setCustomerInvoices([]);
      setSelectedCustomerInvoiceId('');
    }
  }, [customerId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error('Failed to fetch customers', e);
    }
  };

  const fetchCustomerBalance = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/customers/${id}/balance`);
      if (res.ok) {
        const data = await res.json();
        setCustomerBalance(data.balance);
      }
    } catch (e) {
      setCustomerBalance(null);
    }
  };

  const fetchCustomerInvoices = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/sales/customer-invoices/${id}`);
      if (res.ok) {
        setCustomerInvoices(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch customer invoices', e);
    }
  };

  // Invoice Lookup Handler
  const handleLookupInvoice = async (invNumToSearch?: string) => {
    const q = (invNumToSearch || invoiceSearchQuery).trim();
    if (!q) {
      setStatusMessage({ text: 'Please enter an Invoice # to search.', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/sales/lookup/${encodeURIComponent(q)}`);
      if (res.ok) {
        const inv = await res.json();
        setSelectedInvoice(inv);
        if (inv.customerRecId) {
          setCustomerId(inv.customerRecId);
        }
        
        // Map details into editable Return items (default return qty = 0)
        const mapped: ReturnItem[] = (inv.details || []).map((d: any, idx: number) => {
          const origQty = Number(d.qty || 0);
          const price = Number(d.price || 0);
          const discPct = Number(d.discPercent || 0);
          const cashDisc = Number(d.cashDiscount || 0);
          const order = d.discountOrder || (discPct && cashDisc ? 'PERCENT_FIRST' : (cashDisc ? 'CASH_FIRST' : (discPct ? 'PERCENT_FIRST' : null)));
          
          let calcNet = Number(d.netAmount || 0);
          if (calcNet <= 0 && origQty > 0) {
            calcNet = calculateLineNet(origQty, price, discPct, cashDisc, order);
          }

          return {
            id: idx + 1,
            productRecId: d.productRecId,
            barCode: d.barCode || d.productCode || '',
            productCode: d.productCode || '',
            productName: d.productName || 'Product Item',
            originalQty: origQty,
            qty: 0, // Default Return Qty = 0
            price: price,
            grossAmount: d.grossAmount || (origQty * price),
            netAmount: calcNet,
            discPercent: discPct,
            cashDiscount: cashDisc,
            discountOrder: order,
            isDamaged: false
          };
        });

        setReturnItems(mapped);
        setStatusMessage({ text: `Invoice ${inv.invoiceNumber} loaded! Items ready for return.`, type: 'success' });
      } else {
        const err = await res.json();
        setStatusMessage({ text: err.error || `Invoice '${q}' not found.`, type: 'error' });
      }
    } catch (e) {
      setStatusMessage({ text: 'Network error looking up invoice.', type: 'error' });
    }
  };

  const handleSelectCustomerInvoice = (invId: string) => {
    setSelectedCustomerInvoiceId(invId);
    if (invId) {
      handleLookupInvoice(invId);
    }
  };

  // Update return item properties
  const updateReturnItem = (index: number, field: keyof ReturnItem, val: any) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: val };

      if (field === 'qty') {
        const num = parseFloat(val);
        const qty = isNaN(num) ? 0 : Math.max(0, Math.min(item.originalQty, num));
        return { ...item, qty };
      }

      return updated;
    }));
  };

  // Dynamic Return Refund Math (Proportional refund based on line net total)
  const totalRefundAmount = useMemo(() => {
    return returnItems.reduce((sum, item) => {
      if (item.originalQty === 0 || item.qty === 0) return sum;
      const origNet = item.netAmount > 0
        ? item.netAmount
        : calculateLineNet(item.originalQty, item.price, item.discPercent, item.cashDiscount, item.discountOrder);
      const proportion = item.qty / item.originalQty;
      return sum + (proportion * origNet);
    }, 0);
  }, [returnItems]);

  const summaryGross = useMemo(() => {
    if (!selectedInvoice) return 0;
    if (selectedInvoice.grossAmount && selectedInvoice.grossAmount > 0) return selectedInvoice.grossAmount;
    const itemGross = returnItems.reduce((sum, i) => sum + (i.originalQty * i.price), 0);
    return itemGross > 0 ? itemGross : (selectedInvoice.totalAmount || 0);
  }, [selectedInvoice, returnItems]);

  const summaryNet = useMemo(() => {
    if (!selectedInvoice) return 0;
    return selectedInvoice.totalAmount || 0;
  }, [selectedInvoice]);

  const summaryDiscount = useMemo(() => {
    if (!selectedInvoice) return 0;
    if (selectedInvoice.totalDiscount !== undefined && selectedInvoice.totalDiscount !== null && selectedInvoice.totalDiscount > 0) {
      return selectedInvoice.totalDiscount;
    }
    const diff = summaryGross - summaryNet;
    if (diff > 0) return diff;
    return returnItems.reduce((sum, i) => {
      const origNet = i.netAmount > 0 ? i.netAmount : calculateLineNet(i.originalQty, i.price, i.discPercent, i.cashDiscount, i.discountOrder);
      return sum + Math.max(0, (i.originalQty * i.price) - origNet);
    }, 0);
  }, [selectedInvoice, summaryGross, summaryNet, returnItems]);

  const returnItemsCount = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + item.qty, 0);
  }, [returnItems]);

  // Process Return Submission (Phase 46 — Split Settlement)
  const handleProcessReturn = async () => {
    const activeReturns = returnItems.filter(i => i.qty > 0);
    if (activeReturns.length === 0 || totalRefundAmount <= 0) {
      alert('Please specify a Return Qty > 0 for at least one item.');
      return;
    }

    const balanceAdj = totalRefundAmount - cashReturned;
    const confirmMsg = `Confirm processing return for Rs. ${totalRefundAmount.toLocaleString()}?\n\nSettlement Breakdown:\n• Cash Returned: Rs. ${cashReturned.toLocaleString()}\n• Balance Adjustment: Rs. ${balanceAdj.toLocaleString()}${additionalCashReceived > 0 ? `\n• Additional Cash Received: Rs. ${additionalCashReceived.toLocaleString()}` : ''}\n\nDate: ${returnDate}`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        saleMainId: selectedInvoice?.id || undefined,
        customerRecId: customerId || undefined,
        returnDate,
        remarks,
        cashReturned,
        additionalCashReceived,
        items: activeReturns.map(i => ({
          productRecId: i.productRecId,
          qty: i.qty,
          price: i.price,
          discPercent: i.discPercent || 0,
          cashDiscount: i.cashDiscount || 0,
          isDamaged: i.isDamaged
        }))
      };

      const res = await fetch('http://localhost:3000/api/returns/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const s = data.settlement || {};
        const custName = customers.find(c => c.id === Number(customerId))?.custName || selectedInvoice?.customerName || 'Customer';
        
        setReceiptModal({
          isOpen: true,
          type: 'sales-return',
          data: {
            id: data.id || 'SR',
            storeName: settings?.storeName || 'Wholesale ERP',
            storeAddress: settings?.storeAddress || '',
            receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
            date: returnDate,
            returnDate: returnDate,
            customerName: custName,
            originalInvoiceNumber: selectedInvoice?.invoiceNumber || (selectedInvoice?.id ? `INV-${selectedInvoice.id}` : undefined),
            originalInvoiceNo: selectedInvoice?.invoiceNumber || (selectedInvoice?.id ? `INV-${selectedInvoice.id}` : undefined),
            totalRefund: totalRefundAmount,
            refundAmount: totalRefundAmount,
            cashReturned: s.cashReturned || cashReturned,
            balanceAdjusted: s.balanceAdjustment || (totalRefundAmount - cashReturned),
            additionalCashReceived: s.additionalCashReceived || additionalCashReceived,
            remainingBalance: customerBalance !== null ? customerBalance - (s.balanceAdjustment || (totalRefundAmount - cashReturned)) : undefined,
            remarks: remarks || 'Sales Return Processed',
            returnItems: activeReturns.map((item, idx) => ({
              sr: idx + 1,
              name: item.productName,
              returnQty: item.qty,
              refundAmount: calculateLineNet(item.qty, item.price, item.discPercent, item.cashDiscount, item.discountOrder),
            }))
          }
        });

        // Reset form
        setReturnItems([]);
        setSelectedInvoice(null);
        setInvoiceSearchQuery('');
        setRemarks('');
        setCashReturned(0);
        setAdditionalCashReceived(0);
        if (customerId) fetchCustomerBalance(Number(customerId));
      } else {
        const err = await res.json();
        alert('Return error: ' + (err.error || 'Failed'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error while processing return.');
    } finally {
      setIsProcessing(false);
    }
  };

  const storeTitle = user?.companyName || settings?.storeName || 'Retail ERP';
  const storeAddress = user?.companyAddress || settings?.storeAddress || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 42px)', background: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden', padding: '4px' }}>
      
      {/* STATUS TOAST */}
      {statusMessage && (
        <div style={{
          position: 'fixed', top: '12px', right: '12px', zIndex: 9999,
          background: statusMessage.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff', padding: '6px 14px', borderRadius: '4px', fontSize: '11px',
          fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <RotateCcw size={14} /> {statusMessage.text}
        </div>
      )}

      {/* HEADER TOOLBAR: SEARCH & CUSTOMER SELECTION */}
      <div style={{ background: '#1e293b', color: '#ffffff', padding: '6px 10px', borderRadius: '4px 4px 0 0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* INVOICE SEARCH BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 320px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>Invoice #:</label>
          <div style={{ display: 'flex', flex: 1 }}>
            <input
              type="text"
              placeholder="Enter Invoice # (e.g. INV-65 or 65)"
              value={invoiceSearchQuery}
              onChange={e => setInvoiceSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookupInvoice()}
              style={{ width: '100%', height: '26px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, border: '1px solid #3b82f6', borderRadius: '3px 0 0 3px', outline: 'none', background: '#ffffff', color: '#0f172a' }}
            />
            <button
              onClick={() => handleLookupInvoice()}
              style={{ height: '26px', padding: '0 10px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '0 3px 3px 0', cursor: 'pointer', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Search size={12} /> Search
            </button>
          </div>
        </div>

        {/* CUSTOMER SELECTOR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#cbd5e1', whiteSpace: 'nowrap' }}>Customer:</label>
          <select
            value={customerId}
            onChange={e => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 600, border: '1px solid #475569', borderRadius: '3px', outline: 'none', background: '#ffffff', color: '#0f172a', maxWidth: '200px' }}
          >
            <option value="">-- Walk-in / Select Customer --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.custName || c.name}
              </option>
            ))}
          </select>

          {/* RECENT INVOICES DROPDOWN */}
          {customerId && customerInvoices.length > 0 && (
            <select
              value={selectedCustomerInvoiceId}
              onChange={e => handleSelectCustomerInvoice(e.target.value)}
              style={{ height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 600, border: '1px solid #0284c7', borderRadius: '3px', outline: 'none', background: '#e0f2fe', color: '#0369a1', maxWidth: '220px' }}
            >
              <option value="">-- Recent Customer Invoices --</option>
              {customerInvoices.map(inv => (
                <option key={inv.id} value={inv.invoiceNumber}>
                  {inv.invoiceNumber} ({new Date(inv.date).toLocaleDateString()} - Rs. {(inv.totalAmount || 0).toLocaleString()})
                </option>
              ))}
            </select>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PHASE 37 REDESIGNED LAYOUT: VISUAL INVOICE RECEIPT (LEFT) | SUMMARY & FORM (RIGHT) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '6px', flex: 1, marginTop: '4px', overflow: 'hidden' }}>
        
        {/* LEFT / CENTER: VISUAL INVOICE RECEIPT SHEET */}
        <div style={{
          background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          
          {/* RECEIPT DOCUMENT HEADER */}
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '2px double #0f172a', textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {storeTitle}
            </h2>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              {storeAddress} | Sales Return & Audit Sheet
            </div>

            {selectedInvoice ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '6px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '11px' }}>
                <div 
                  onClick={() => setViewingReceiptInvoice(selectedInvoice.invoiceNumber)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                  <strong>Invoice ID:</strong> 
                  <span style={{ color: '#0284c7', fontWeight: 800, textDecoration: 'underline' }}>{selectedInvoice.invoiceNumber}</span>
                  <Printer size={12} style={{ color: '#0284c7' }} />
                </div>
                <div><strong>Date:</strong> {new Date(selectedInvoice.date).toLocaleDateString()}</div>
                <div><strong>Customer:</strong> <span style={{ fontWeight: 700 }}>{selectedInvoice.customerName}</span></div>
                <div><strong>Salesman:</strong> {selectedInvoice.salesman || 'System Admin'}</div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '6px' }}>
                Please enter an Invoice # above to display the purchase receipt and itemized return controls.
              </div>
            )}
          </div>

          {/* RECEIPT ITEMS & INLINE RETURN CONTROLS TABLE */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0f172a', color: '#ffffff', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '6px 4px', width: '30px', textAlign: 'center' }}>Sr#</th>
                  <th style={{ padding: '6px 6px', width: '100px' }}>Bar Code / Code</th>
                  <th style={{ padding: '6px 6px' }}>Item Name</th>
                  <th style={{ padding: '6px 4px', width: '55px', textAlign: 'center' }}>Orig Qty</th>
                  <th style={{ padding: '6px 6px', width: '65px', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '6px 4px', width: '50px', textAlign: 'center' }}>Disc %</th>
                  <th style={{ padding: '6px 6px', width: '60px', textAlign: 'right' }}>Cash Disc</th>
                  <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right' }}>Net Line Total</th>
                  <th style={{ padding: '6px 6px', width: '70px', textAlign: 'center', background: '#fef2f2', color: '#991b1b' }}>Return Qty</th>
                  <th style={{ padding: '6px 6px', width: '80px', textAlign: 'center', background: '#fef2f2', color: '#991b1b' }}>Condition</th>
                  <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right', background: '#fef2f2', color: '#991b1b' }}>Refund Amt</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '50px 10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                      <Package size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                      No invoice items loaded. Search an Invoice # to view original receipt line items.
                    </td>
                  </tr>
                ) : (
                  returnItems.map((item, idx) => {
                    const origNetLine = item.netAmount > 0 
                      ? item.netAmount 
                      : calculateLineNet(item.originalQty, item.price, item.discPercent, item.cashDiscount, item.discountOrder);
                    const returnRefundLine = item.originalQty > 0 ? (item.qty / item.originalQty) * origNetLine : 0;

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>{item.barCode || item.productCode || '-'}</td>
                        <td style={{ padding: '5px 6px', fontWeight: 700, color: '#0f172a' }}>{item.productName}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>{item.originalQty}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>Rs. {item.price.toLocaleString()}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', color: item.discPercent > 0 ? '#0284c7' : '#94a3b8' }}>
                          {item.discPercent > 0 ? `${item.discPercent}%` : '-'}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: item.cashDiscount > 0 ? '#0284c7' : '#94a3b8' }}>
                          {item.cashDiscount > 0 ? `Rs. ${item.cashDiscount}` : '-'}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          Rs. {origNetLine.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>

                        {/* INTERACTIVE INLINE RETURN CONTROLS */}
                        <td style={{ padding: '3px 4px', background: '#fff5f5' }}>
                          <input
                            type="number"
                            min="0"
                            max={item.originalQty}
                            step="1"
                            value={item.qty}
                            onChange={e => updateReturnItem(idx, 'qty', e.target.value)}
                            style={{
                              width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 800,
                              border: '1px solid #fca5a5', borderRadius: '2px', outline: 'none',
                              background: item.qty > 0 ? '#fef2f2' : '#ffffff',
                              color: item.qty > 0 ? '#dc2626' : '#64748b'
                            }}
                          />
                        </td>

                        <td style={{ padding: '3px 4px', background: '#fff5f5' }}>
                          <select
                            value={item.isDamaged ? 'Damaged' : 'Good'}
                            onChange={e => updateReturnItem(idx, 'isDamaged', e.target.value === 'Damaged')}
                            style={{
                              width: '100%', height: '24px', fontSize: '10px', fontWeight: 700,
                              border: '1px solid #cbd5e1', borderRadius: '2px', padding: '0 2px',
                              color: item.isDamaged ? '#dc2626' : '#16a34a'
                            }}
                          >
                            <option value="Good">Good</option>
                            <option value="Damaged">Damaged</option>
                          </select>
                        </td>

                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: '#dc2626', background: '#fff5f5' }}>
                          {returnRefundLine > 0 ? `Rs. ${returnRefundLine.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: BILL SUMMARY (TOP) & RETURN ACTION FORM (BOTTOM) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
          
          {/* 1. TOP CARD: ORIGINAL INVOICE BILL SUMMARY */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={13} style={{ color: '#0284c7' }} /> Original Invoice Bill Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
              <span>Gross Amount:</span>
              <strong style={{ color: '#0f172a' }}>Rs. {summaryGross.toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: summaryDiscount > 0 ? '#0284c7' : '#64748b' }}>
              <span>Total Invoice Discounts:</span>
              <strong>-Rs. {summaryDiscount.toLocaleString()}</strong>
            </div>

            {(selectedInvoice?.expenseAmount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#b45309' }}>
                <span>Expenses (Freight/Delivery):</span>
                <strong>+Rs. {(selectedInvoice?.expenseAmount || 0).toLocaleString()}</strong>
              </div>
            )}

            <div style={{ borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
              <span>Original Net Total:</span>
              <span style={{ color: '#0284c7' }}>Rs. {summaryNet.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
              <span>Amount Paid:</span>
              <strong>Rs. {(selectedInvoice?.paymentReceived || 0).toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#ef4444' }}>
              <span>Remaining Balance:</span>
              <strong>Rs. {((selectedInvoice?.totalAmount || 0) - (selectedInvoice?.paymentReceived || 0)).toLocaleString()}</strong>
            </div>
          </div>

          {/* 2. BOTTOM CARD: RETURN EXECUTION ACTION FORM */}
          <div style={{ flex: 1, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '6px 10px', background: '#991b1b', color: '#ffffff', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={14} /> Return Execution Form
            </div>

            <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', background: '#f8fafc' }}>
              
              {/* TOTAL REFUND DISPLAY */}
              <div style={{ background: '#fef2f2', padding: '10px', border: '1px solid #fca5a5', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 800, color: '#991b1b' }}>Total Refund Amount</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#dc2626' }}>Rs. {totalRefundAmount.toLocaleString()}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Selected Return: <strong>{returnItemsCount} Pcs</strong></div>
              </div>

              {/* CUSTOMER DEBT / ACCOUNT */}
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block' }}>Customer Account</span>
                <strong style={{ fontSize: '11px', color: '#0f172a' }}>
                  {customers.find(c => c.id === customerId)?.custName || customers.find(c => c.id === customerId)?.name || 'Walk-in Customer'}
                </strong>
                {customerBalance !== null && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: customerBalance > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                    Current Debt: Rs. {customerBalance.toLocaleString()}
                  </div>
                )}
              </div>

              {/* SPLIT SETTLEMENT FORM (Phase 46) */}
              <div style={{ background: '#ffffff', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                  💰 Split Settlement
                </div>

                {/* Total Refund (Read-only) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Total Refund Amount</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#dc2626' }}>Rs. {totalRefundAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>

                {/* Cash Returned to Customer */}
                <div style={{ marginTop: '6px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>
                    Cash Returned to Customer (Rs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalRefundAmount}
                    step="0.01"
                    value={cashReturned || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setCashReturned(Math.max(0, Math.min(totalRefundAmount, val)));
                    }}
                    placeholder="0"
                    style={{
                      width: '100%', height: '28px', padding: '2px 6px', fontSize: '12px', fontWeight: 800,
                      border: '2px solid #16a34a', borderRadius: '3px', outline: 'none',
                      background: '#f0fdf4', color: '#15803d', textAlign: 'right'
                    }}
                  />
                </div>

                {/* Balance Adjustment (Auto-calculated, read-only) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', padding: '5px 6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e40af' }}>Adjusted in Balance</span>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#1d4ed8' }}>
                    Rs. {Math.max(0, totalRefundAmount - cashReturned).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Additional Cash Received from Customer */}
                {customerId && (
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '2px' }}>
                      Additional Cash Received from Customer (Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={additionalCashReceived || ''}
                      onChange={e => setAdditionalCashReceived(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      style={{
                        width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 700,
                        border: '1px solid #f59e0b', borderRadius: '3px', outline: 'none',
                        background: '#fffbeb', color: '#92400e', textAlign: 'right'
                      }}
                    />
                    <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                      Extra cash the customer wants to pay (logged as separate Credit entry)
                    </div>
                  </div>
                )}

                {/* Visual Summary Bar */}
                {totalRefundAmount > 0 && (
                  <div style={{ marginTop: '8px', background: '#f8fafc', padding: '6px', borderRadius: '3px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Settlement Breakdown</div>
                    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0' }}>
                      {cashReturned > 0 && (
                        <div style={{ width: `${(cashReturned / totalRefundAmount) * 100}%`, background: '#16a34a', transition: 'width 0.3s ease' }} />
                      )}
                      {(totalRefundAmount - cashReturned) > 0 && (
                        <div style={{ width: `${((totalRefundAmount - cashReturned) / totalRefundAmount) * 100}%`, background: '#2563eb', transition: 'width 0.3s ease' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '8px' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>💵 Cash: {cashReturned > 0 ? `${((cashReturned / totalRefundAmount) * 100).toFixed(0)}%` : '0%'}</span>
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>📒 Balance: {totalRefundAmount > 0 ? `${(((totalRefundAmount - cashReturned) / totalRefundAmount) * 100).toFixed(0)}%` : '0%'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* EFFECTIVE RETURN DATE PICKER (MANUAL BACKDATING) */}
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <label style={{ fontSize: '9px', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <Calendar size={12} /> Effective Return Date (Backdate)
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontWeight: 700, border: '1px solid #f59e0b', borderRadius: '2px', outline: 'none', background: '#fffbe6', color: '#78350f' }}
                />
              </div>

              {/* REMARKS / REASON */}
              <div>
                <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>Return Remarks / Reason</label>
                <textarea
                  rows={2}
                  placeholder="Enter reason for return..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none', resize: 'none' }}
                />
              </div>

            </div>

            {/* PROCESS RETURN RED BUTTON */}
            <div style={{ padding: '8px', background: '#ffffff', borderTop: '1px solid #cbd5e1' }}>
              {(() => {
                const canProcess = returnItems.some(i => i.qty > 0) && totalRefundAmount > 0;
                return (
                  <button
                    onClick={handleProcessReturn}
                    disabled={isProcessing || !canProcess}
                    style={{
                      width: '100%', padding: '10px', fontSize: '13px', fontWeight: 900,
                      background: !canProcess || isProcessing ? '#cbd5e1' : '#dc2626',
                      color: '#ffffff', border: 'none', borderRadius: '4px',
                      cursor: !canProcess || isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                      boxShadow: !canProcess ? 'none' : '0 4px 10px rgba(220, 38, 38, 0.4)'
                    }}
                  >
                    <RotateCcw size={16} /> {isProcessing ? 'Processing Return...' : 'PROCESS RETURN'}
                  </button>
                );
              })()}

              <button
                onClick={() => {
                  if (customerId) {
                    navigate(`/pos?customerId=${customerId}`);
                  } else {
                    navigate('/pos');
                  }
                }}
                style={{
                  width: '100%', padding: '8px', fontSize: '12px', fontWeight: 800, marginTop: '8px',
                  background: '#ffffff', color: '#0369a1', border: '1px solid #0284c7', borderRadius: '4px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px'
                }}
              >
                <ShoppingCart size={14} /> Convert to New Sale
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* INVOICE DETAILS PRINT MODAL */}
      {viewingReceiptInvoice && (
        <InvoiceDetailsModal
          isOpen={true}
          invoiceId={viewingReceiptInvoice.replace('INV-', '')}
          onClose={() => setViewingReceiptInvoice(null)}
        />
      )}

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />

    </div>
  );
};

export default SalesReturn;
