import React, { useState, useEffect, useMemo } from 'react';
import { Search, RotateCcw, Trash2, Calendar, Truck, Printer } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

type ReturnItem = {
  id: number;
  productRecId: number;
  barCode: string;
  productCode: string;
  productName: string;
  originalQty: number;
  qty: number;
  price: number;
  discPercent: number;
  cashDiscount: number;
  discountOrder?: 'PERCENT_FIRST' | 'CASH_FIRST' | null;
};

function calculateLineNetDebit(item: { qty: number; price: number; discPercent: number; cashDiscount: number; discountOrder?: 'PERCENT_FIRST' | 'CASH_FIRST' | null }) {
  const gross = item.qty * item.price;
  const pct = Math.min(100, Math.max(0, item.discPercent || 0));
  const cash = Math.max(0, item.cashDiscount || 0);
  const order = item.discountOrder;

  if (order === 'CASH_FIRST') {
    const subtotal = Math.max(0, gross - cash);
    return Math.max(0, subtotal - (subtotal * (pct / 100)));
  } else if (order === 'PERCENT_FIRST') {
    const subtotal = Math.max(0, gross - (gross * (pct / 100)));
    return Math.max(0, subtotal - cash);
  } else {
    if (pct > 0) return Math.max(0, gross - (gross * (pct / 100)));
    if (cash > 0) return Math.max(0, gross - cash);
    return gross;
  }
}

const PurchaseReturn: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [vendorBalance, setVendorBalance] = useState<number | null>(null);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'purchase-return', data: {} });

  // Split Settlement State (Phase 46)
  const [cashReceivedFromVendor, setCashReceivedFromVendor] = useState<number>(0);
  const [additionalCashPaid, setAdditionalCashPaid] = useState<number>(0);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (vendorId) {
      fetchVendorBalance(Number(vendorId));
    } else {
      setVendorBalance(null);
    }
  }, [vendorId]);

  const fetchVendors = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/vendors');
      if (res.ok) setVendors(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVendorBalance = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/vendors/${id}/balance`);
      if (res.ok) {
        const data = await res.json();
        setVendorBalance(data.balance);
      }
    } catch (e) {
      setVendorBalance(null);
    }
  };

  const updateReturnItem = (index: number, field: keyof ReturnItem, val: any) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: val };

      if (field === 'qty') {
        const num = parseFloat(val);
        const qty = isNaN(num) ? 0 : Math.max(0, Math.min(item.originalQty, num));
        return { ...item, qty };
      }

      let discPct = Number(updated.discPercent);
      if (isNaN(discPct) || discPct < 0) discPct = 0;
      if (discPct > 100) discPct = 100;

      let cashDisc = Number(updated.cashDiscount);
      if (isNaN(cashDisc) || cashDisc < 0) cashDisc = 0;

      let newOrder = item.discountOrder || null;
      if (field === 'discPercent') {
        if (discPct > 0 && !newOrder) newOrder = 'PERCENT_FIRST';
        else if (discPct === 0) newOrder = cashDisc > 0 ? 'CASH_FIRST' : null;
      } else if (field === 'cashDiscount') {
        if (cashDisc > 0 && !newOrder) newOrder = 'CASH_FIRST';
        else if (cashDisc === 0) newOrder = discPct > 0 ? 'PERCENT_FIRST' : null;
      }

      return {
        ...updated,
        discPercent: discPct,
        cashDiscount: cashDisc,
        discountOrder: newOrder
      };
    }));
  };

  const removeReturnItem = (index: number) => {
    setReturnItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalRefundAmount = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + calculateLineNetDebit(item), 0);
  }, [returnItems]);

  const handleLoadPurchase = async () => {
    if (!purchaseSearchQuery) return;
    try {
      const res = await fetch(`http://localhost:3000/api/purchases/${purchaseSearchQuery}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPurchase(data);
        if (data.sellerRecId) setVendorId(data.sellerRecId);
        
        const mappedItems = data.details.map((d: any) => ({
          id: d.id,
          productRecId: d.productRecId,
          barCode: d.productRec?.barCode || '',
          productCode: d.productRec?.productCode || '',
          productName: d.productRec?.productName || 'Unknown',
          originalQty: d.qty,
          qty: 0,
          price: d.price,
          discPercent: 0,
          cashDiscount: 0,
          discountOrder: null
        }));
        setReturnItems(mappedItems);
      } else {
        alert('Purchase order not found.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error loading purchase order.');
    }
  };

  // Process Return (Phase 46 — Split Settlement)
  const handleProcessReturn = async () => {
    const activeItems = returnItems.filter(i => i.qty > 0);
    if (activeItems.length === 0 || totalRefundAmount <= 0) {
      alert('Cannot process purchase return: No items with valid return quantities!');
      return;
    }

    const balanceAdj = totalRefundAmount - cashReceivedFromVendor;
    const confirmMsg = `Confirm vendor return for Rs. ${totalRefundAmount.toLocaleString()}?\n\nSettlement Breakdown:\n• Cash Received from Vendor: Rs. ${cashReceivedFromVendor.toLocaleString()}\n• Adjusted in Vendor Balance: Rs. ${balanceAdj.toLocaleString()}${additionalCashPaid > 0 ? `\n• Additional Cash Paid: Rs. ${additionalCashPaid.toLocaleString()}` : ''}`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setIsProcessing(true);
    try {
      const payload = {
        sellerRecId: vendorId || null,
        returnDate,
        remarks,
        cashReceivedFromVendor,
        additionalCashPaid,
        items: activeItems.map(i => ({
          productRecId: i.productRecId,
          qty: i.qty,
          price: i.price
        }))
      };

      const res = await fetch('http://localhost:3000/api/returns/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        const s = data.settlement || {};
        const vendorObj = vendors.find(v => v.id === Number(vendorId));

        setReceiptModal({
          isOpen: true,
          type: 'purchase-return',
          data: {
            id: data.id || 'PR',
            storeName: user?.companyName || settings?.storeName || 'Store ERP',
            storeAddress: user?.companyAddress || settings?.storeAddress || '',
            storePhone: user?.companyPhone || '',
            receiptFooter: settings?.receiptFooter || `Thank you for your business! — ${user?.companyName || 'Store ERP'}`,
            date: returnDate,
            vendorName: vendorObj?.companyName || 'Vendor',
            originalInvoiceNo: selectedPurchase?.id ? `PO-${selectedPurchase.id}` : undefined,
            refundAmount: totalRefundAmount,
            cashReceivedFromVendor: s.cashReceived || cashReceivedFromVendor,
            balanceAdjusted: s.balanceAdjustment || (totalRefundAmount - cashReceivedFromVendor),
            additionalCashPaid: s.additionalCashPaid || additionalCashPaid,
            remarks: remarks || 'Purchase Return Processed',
            items: activeItems.map((item, idx) => ({
              sr: idx + 1,
              name: item.productName,
              qty: item.qty,
              price: item.price,
              discPercent: item.discPercent,
              cashDiscount: item.cashDiscount,
              netAmount: calculateLineNetDebit(item)
            }))
          }
        });

        setReturnItems([]);
        setSelectedPurchase(null);
        setRemarks('');
        setPurchaseSearchQuery('');
        setCashReceivedFromVendor(0);
        setAdditionalCashPaid(0);
        if (vendorId) fetchVendorBalance(Number(vendorId));
      } else {
        const err = await res.json();
        alert('Failed: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Network error processing return.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 42px)', background: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden', padding: '4px' }}>
      
      {/* HEADER BAR */}
      <div style={{ background: '#1e293b', color: '#ffffff', padding: '6px 10px', borderRadius: '4px 4px 0 0', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 280px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>PO / Bill #:</label>
          <div style={{ display: 'flex', flex: 1 }}>
            <input
              type="text"
              placeholder="e.g. PO-1001"
              value={purchaseSearchQuery}
              onChange={e => setPurchaseSearchQuery(e.target.value)}
              style={{ width: '100%', height: '26px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, border: '1px solid #3b82f6', borderRadius: '3px 0 0 3px', outline: 'none', background: '#ffffff', color: '#0f172a' }}
            />
            <button 
              onClick={handleLoadPurchase}
              style={{ height: '26px', padding: '0 10px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '0 3px 3px 0', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}
            >
              <Search size={12} /> Search
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#cbd5e1' }}>Vendor:</label>
          <select
            value={vendorId}
            onChange={e => setVendorId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 600, border: '1px solid #475569', borderRadius: '3px', outline: 'none', background: '#ffffff', color: '#0f172a', maxWidth: '200px' }}
          >
            <option value="">-- Select Vendor --</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Calendar size={12} /> Return Date:
          </label>
          <input
            type="date"
            value={returnDate}
            onChange={e => setReturnDate(e.target.value)}
            style={{ height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 700, border: '1px solid #f59e0b', borderRadius: '3px', outline: 'none', background: '#fffbe6', color: '#78350f' }}
          />
        </div>
      </div>

      {/* 3-PANE LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: '4px', flex: 1, marginTop: '4px', overflow: 'hidden' }}>
        
        {/* CENTER DATA GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>
            Purchase Return Items (Vendor Restock / Debit Note)
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0f172a', color: '#ffffff', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '6px 6px', width: '30px', textAlign: 'center' }}>Sr#</th>
                  <th style={{ padding: '6px 6px', width: '110px' }}>Code / Bar Code</th>
                  <th style={{ padding: '6px 6px' }}>Item Name</th>
                  <th style={{ padding: '6px 6px', width: '65px', textAlign: 'center' }}>Orig Qty</th>
                  <th style={{ padding: '6px 6px', width: '70px', textAlign: 'center' }}>Return Qty</th>
                  <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right' }}>Cost Price</th>
                  <th style={{ padding: '6px 6px', width: '60px', textAlign: 'center' }}>Disc %</th>
                  <th style={{ padding: '6px 6px', width: '75px', textAlign: 'center' }}>Cash Disc</th>
                  <th style={{ padding: '6px 6px', width: '90px', textAlign: 'right' }}>Debit Amt</th>
                  <th style={{ padding: '6px 6px', width: '35px', textAlign: 'center' }}>Act</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px 10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                      <RotateCcw size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                      No purchase order loaded. Search PO # above to load items for vendor return.
                    </td>
                  </tr>
                ) : (
                  returnItems.map((item, idx) => {
                    const debitAmt = calculateLineNetDebit(item);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{item.barCode}</td>
                        <td style={{ padding: '4px 6px', fontWeight: 700 }}>{item.productName}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{item.originalQty}</td>
                        <td style={{ padding: '2px 4px' }}>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={e => updateReturnItem(idx, 'qty', e.target.value)}
                            style={{ width: '100%', height: '24px', textAlign: 'center', fontWeight: 800, border: '1px solid #dc2626', borderRadius: '2px' }}
                          />
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>Rs. {item.price.toLocaleString()}</td>
                        <td style={{ padding: '2px 4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discPercent || 0}
                            onChange={e => updateReturnItem(idx, 'discPercent', e.target.value)}
                            style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                          />
                        </td>
                        <td style={{ padding: '2px 4px' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.cashDiscount || ''}
                            onChange={e => updateReturnItem(idx, 'cashDiscount', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                          />
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>Rs. {debitAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                          <button onClick={() => removeReturnItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT SUMMARY PANE WITH SPLIT SETTLEMENT */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '6px 8px', background: '#991b1b', color: '#ffffff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
            Vendor Return Summary
          </div>

          <div style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', overflowY: 'auto' }}>
            
            {/* Total Debit Display */}
            <div style={{ background: '#fef2f2', padding: '8px', border: '1px solid #fca5a5', borderRadius: '3px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#991b1b' }}>Total Debit Amount</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#dc2626' }}>Rs. {totalRefundAmount.toLocaleString()}</div>
            </div>

            {/* Vendor Account Info */}
            {vendorId && (
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block' }}>Vendor Account</span>
                <strong style={{ fontSize: '11px', color: '#0f172a' }}>
                  {vendors.find(v => v.id === vendorId)?.companyName || 'Unknown Vendor'}
                </strong>
                {vendorBalance !== null && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: vendorBalance > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                    Current AP: Rs. {vendorBalance.toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* SPLIT SETTLEMENT FORM (Phase 46) */}
            <div style={{ background: '#ffffff', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                💰 Split Settlement
              </div>

              {/* Total Refund (Read-only) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Total Vendor Refund</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#dc2626' }}>Rs. {totalRefundAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>

              {/* Cash Received from Vendor */}
              <div style={{ marginTop: '6px' }}>
                <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>
                  Cash Received from Vendor (Rs)
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalRefundAmount}
                  step="0.01"
                  value={cashReceivedFromVendor || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setCashReceivedFromVendor(Math.max(0, Math.min(totalRefundAmount, val)));
                  }}
                  placeholder="0"
                  style={{
                    width: '100%', height: '28px', padding: '2px 6px', fontSize: '12px', fontWeight: 800,
                    border: '2px solid #16a34a', borderRadius: '3px', outline: 'none',
                    background: '#f0fdf4', color: '#15803d', textAlign: 'right'
                  }}
                />
              </div>

              {/* Balance Adjustment (Auto-calculated) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', padding: '5px 6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e40af' }}>Adjusted in Vendor Balance</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1d4ed8' }}>
                  Rs. {Math.max(0, totalRefundAmount - cashReceivedFromVendor).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Additional Cash Paid to Vendor */}
              {vendorId && (
                <div style={{ marginTop: '6px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '2px' }}>
                    Additional Cash Paid to Vendor (Rs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={additionalCashPaid || ''}
                    onChange={e => setAdditionalCashPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    style={{
                      width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 700,
                      border: '1px solid #f59e0b', borderRadius: '3px', outline: 'none',
                      background: '#fffbeb', color: '#92400e', textAlign: 'right'
                    }}
                  />
                  <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                    Return fee or extra payment to vendor (logged as separate entry)
                  </div>
                </div>
              )}

              {/* Visual Summary Bar */}
              {totalRefundAmount > 0 && (
                <div style={{ marginTop: '8px', background: '#f8fafc', padding: '6px', borderRadius: '3px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Settlement Breakdown</div>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0' }}>
                    {cashReceivedFromVendor > 0 && (
                      <div style={{ width: `${(cashReceivedFromVendor / totalRefundAmount) * 100}%`, background: '#16a34a', transition: 'width 0.3s ease' }} />
                    )}
                    {(totalRefundAmount - cashReceivedFromVendor) > 0 && (
                      <div style={{ width: `${((totalRefundAmount - cashReceivedFromVendor) / totalRefundAmount) * 100}%`, background: '#2563eb', transition: 'width 0.3s ease' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '8px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>💵 Cash: {cashReceivedFromVendor > 0 ? `${((cashReceivedFromVendor / totalRefundAmount) * 100).toFixed(0)}%` : '0%'}</span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>📒 Balance: {totalRefundAmount > 0 ? `${(((totalRefundAmount - cashReceivedFromVendor) / totalRefundAmount) * 100).toFixed(0)}%` : '0%'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Remarks / Reason</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Reason for vendor return..."
                style={{ width: '100%', padding: '4px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none', resize: 'none' }}
              />
            </div>
          </div>

          <div style={{ padding: '6px', background: '#f1f5f9', borderTop: '1px solid #cbd5e1' }}>
            <button
              onClick={handleProcessReturn}
              disabled={isProcessing || returnItems.length === 0}
              style={{
                width: '100%', padding: '8px', fontSize: '12px', fontWeight: 900,
                background: returnItems.length === 0 ? '#cbd5e1' : '#dc2626',
                color: '#ffffff', border: 'none', borderRadius: '3px', cursor: returnItems.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              PROCESS RETURN
            </button>
          </div>
        </div>

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

export default PurchaseReturn;
