import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Printer, RotateCcw, CheckCircle, AlertTriangle, FileText, ShoppingBag } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

type InvoiceDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  invoiceId?: number | string | null;
  onReturnSuccess?: () => void;
};

type InvoiceItem = {
  id: number;
  productRecId: number;
  productName: string;
  productCode: string;
  barCode: string;
  qty: number;
  price: number;
  discPercent: number;
  cashDiscount: number;
  totalPrice: number;
};

type ReturnRowState = {
  returnQty: number;
  condition: 'Good' | 'Damaged';
};

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  invoiceId,
  onReturnSuccess
}) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [returnState, setReturnState] = useState<Record<number, ReturnRowState>>({});
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnStatusMsg, setReturnStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const receiptPaperRef = useRef<HTMLDivElement>(null);
  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptPaperRef
  });

  useEffect(() => {
    if (isOpen && invoiceId) {
      fetchInvoiceDetails(invoiceId);
    } else {
      setInvoiceData(null);
      setReturnState({});
      setReturnStatusMsg(null);
    }
  }, [isOpen, invoiceId]);

  const fetchInvoiceDetails = async (id: number | string) => {
    setLoading(true);
    setReturnStatusMsg(null);
    try {
      const res = await fetch(`http://localhost:3000/api/sales/lookup/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoiceData(data);

        // Initialize return input states per item row
        const initialReturnState: Record<number, ReturnRowState> = {};
        (data.details || []).forEach((item: InvoiceItem, idx: number) => {
          initialReturnState[item.id || idx] = {
            returnQty: 0,
            condition: 'Good'
          };
        });
        setReturnState(initialReturnState);
      } else {
        const err = await res.json();
        setReturnStatusMsg({ text: err.error || 'Failed to load invoice details.', type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setReturnStatusMsg({ text: 'Network error fetching invoice details.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReturnQtyChange = (itemId: number, maxQty: number, val: string) => {
    const num = parseFloat(val);
    const qty = isNaN(num) ? 0 : Math.max(0, Math.min(maxQty, num));
    setReturnState(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { condition: 'Good' }),
        returnQty: qty
      }
    }));
  };

  const handleConditionChange = (itemId: number, cond: 'Good' | 'Damaged') => {
    setReturnState(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { returnQty: 0 }),
        condition: cond
      }
    }));
  };

  // Calculate Net Rate per unit after sequential row discounts
  const getLineNetUnitPrice = (item: InvoiceItem) => {
    const gross = item.qty * item.price;
    const discPct = item.discPercent || 0;
    const cashDisc = item.cashDiscount || 0;

    let net = gross;
    if (discPct > 0 && cashDisc > 0) {
      const subtotal = Math.max(0, gross - (gross * (discPct / 100)));
      net = Math.max(0, subtotal - cashDisc);
    } else if (discPct > 0) {
      net = Math.max(0, gross - (gross * (discPct / 100)));
    } else if (cashDisc > 0) {
      net = Math.max(0, gross - cashDisc);
    }

    return item.qty > 0 ? net / item.qty : item.price;
  };

  // Summary calculations for selected inline returns
  const totalReturnRefund = useMemo(() => {
    if (!invoiceData || !invoiceData.details) return 0;
    return invoiceData.details.reduce((sum: number, item: InvoiceItem, idx: number) => {
      const rState = returnState[item.id || idx];
      const rQty = rState?.returnQty || 0;
      const unitNet = getLineNetUnitPrice(item);
      return sum + (rQty * unitNet);
    }, 0);
  }, [invoiceData, returnState]);

  const totalReturnItemsCount = useMemo(() => {
    if (!invoiceData || !invoiceData.details) return 0;
    return invoiceData.details.reduce((sum: number, item: InvoiceItem, idx: number) => {
      const rState = returnState[item.id || idx];
      return sum + (rState?.returnQty || 0);
    }, 0);
  }, [invoiceData, returnState]);

  // Gross Amount sum
  const detailsGrossTotal = useMemo(() => {
    if (!invoiceData || !invoiceData.details) return 0;
    return invoiceData.details.reduce((sum: number, item: InvoiceItem) => sum + (item.qty * item.price), 0);
  }, [invoiceData]);

  // Combined Total Discount (% and cash discounts)
  const detailsTotalDiscount = useMemo(() => {
    if (!invoiceData || !invoiceData.details) return 0;
    return invoiceData.details.reduce((sum: number, item: InvoiceItem) => {
      const gross = item.qty * item.price;
      const unitNet = getLineNetUnitPrice(item);
      const lineNet = item.qty * unitNet;
      return sum + (gross - lineNet);
    }, 0);
  }, [invoiceData]);

  // Submit inline return to backend
  const handleSubmitInlineReturn = async (singleItemId?: number) => {
    if (!invoiceData) return;

    let itemsToReturn = invoiceData.details.filter((item: InvoiceItem, idx: number) => {
      const key = item.id || idx;
      if (singleItemId !== undefined) return key === singleItemId && (returnState[key]?.returnQty || 0) > 0;
      return (returnState[key]?.returnQty || 0) > 0;
    });

    if (itemsToReturn.length === 0) {
      alert('Please enter a Return Qty > 0 before submitting.');
      return;
    }

    const calculatedRefund = itemsToReturn.reduce((sum: number, item: InvoiceItem) => {
      const key = item.id || invoiceData.details.indexOf(item);
      const rQty = returnState[key]?.returnQty || 0;
      return sum + (rQty * getLineNetUnitPrice(item));
    }, 0);

    if (!window.confirm(`Confirm processing return for Rs. ${calculatedRefund.toLocaleString()}?`)) {
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const returnItemsPayload = itemsToReturn.map((item: InvoiceItem) => {
        const key = item.id || invoiceData.details.indexOf(item);
        const rState = returnState[key];
        return {
          productRecId: item.productRecId,
          qty: rState.returnQty,
          price: item.price,
          discPercent: item.discPercent,
          cashDiscount: item.cashDiscount,
          isDamaged: rState.condition === 'Damaged'
        };
      });

      const payload = {
        saleMainId: invoiceData.id,
        customerRecId: invoiceData.customerRecId || undefined,
        returnDate: new Date().toISOString().split('T')[0],
        remarks: `Inline Return from Receipt ${invoiceData.invoiceNumber}`,
        items: returnItemsPayload
      };

      const res = await fetch('http://localhost:3000/api/returns/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setReturnStatusMsg({ text: `🎉 Return #${result.id} processed successfully! Ledger & inventory updated.`, type: 'success' });
        alert(`🎉 Return #${result.id} Processed Successfully!`);

        if (onReturnSuccess) onReturnSuccess();
        // Refresh modal data
        fetchInvoiceDetails(invoiceData.id);
      } else {
        const err = await res.json();
        setReturnStatusMsg({ text: 'Return error: ' + (err.error || 'Failed'), type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setReturnStatusMsg({ text: 'Network error submitting return.', type: 'error' });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  if (!isOpen) return null;

  const storeTitle = user?.companyName || settings?.storeName || 'Retail ERP';
  const storeAddress = user?.companyAddress || settings?.storeAddress || '';
  const storePhone = user?.companyPhone || (settings as any)?.phone || '';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      
      <div style={{
        background: '#0f172a', borderRadius: '10px', border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        width: '950px', maxWidth: '98vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* MODAL TOP TOOLBAR */}
        <div style={{
          background: '#1e293b', color: '#ffffff', padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Official Tax Invoice / Receipt & Return Portal
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handlePrintReceipt()}
              disabled={!invoiceData}
              style={{
                background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px',
                padding: '6px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              <Printer size={14} /> Print Receipt Sheet
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODAL BODY: SCROLLABLE PAPER RECEIPT SHEET */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#334155', display: 'flex', justifyContent: 'center' }}>
          
          {loading && (
            <div style={{ padding: '60px', color: '#f8fafc', fontSize: '14px', fontWeight: 600 }}>
              Loading paper receipt sheet...
            </div>
          )}

          {!loading && invoiceData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '850px' }}>
              
              {returnStatusMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  background: returnStatusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: returnStatusMsg.type === 'success' ? '#15803d' : '#b91c1c',
                  border: `1px solid ${returnStatusMsg.type === 'success' ? '#86efac' : '#fca5a5'}`,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  {returnStatusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {returnStatusMsg.text}
                </div>
              )}

              {/* VISUAL PAPER RECEIPT DOCUMENT CONTAINER (PRINTABLE REF) */}
              <div
                ref={receiptPaperRef}
                style={{
                  background: '#ffffff', color: '#0f172a', padding: '28px 32px', borderRadius: '2px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1',
                  fontFamily: '"Segoe UI", Roboto, -apple-system, sans-serif'
                }}
              >
                {/* 1. HEADER SECTION (AMMAD SANITARY & STORE INFO) */}
                <div style={{ textAlign: 'center', borderBottom: '2px double #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 900, letterSpacing: '1px', color: '#0f172a', textTransform: 'uppercase' }}>
                    {storeTitle}
                  </h1>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                    {storeAddress}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                    Phone: {storePhone} | GST/NTN Registered
                  </div>
                  <div style={{ display: 'inline-block', marginTop: '6px', padding: '2px 10px', background: '#0f172a', color: '#ffffff', fontSize: '11px', fontWeight: 800, borderRadius: '2px', letterSpacing: '0.5px' }}>
                    SALES INVOICE & CASH RECEIPT
                  </div>
                </div>

                {/* RECEIPT METADATA GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '12px' }}>
                  <div>
                    <div style={{ marginBottom: '3px' }}><strong>Invoice #:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>{invoiceData.invoiceNumber}</span></div>
                    <div style={{ marginBottom: '3px' }}><strong>Date & Time:</strong> {new Date(invoiceData.date).toLocaleString()}</div>
                    <div><strong>Customer Name:</strong> <span style={{ fontWeight: 800, color: '#0f172a' }}>{invoiceData.customerName}</span></div>
                  </div>
                  <div>
                    <div style={{ marginBottom: '3px' }}><strong>Salesman:</strong> {invoiceData.salesman || 'System Admin'}</div>
                    <div style={{ marginBottom: '3px' }}><strong>Booker / Counter:</strong> {invoiceData.booker || 'Main Counter'}</div>
                    <div><strong>Payment Mode:</strong> <span style={{ fontWeight: 800, color: invoiceData.customerRecId ? '#d97706' : '#16a34a' }}>{invoiceData.paymentMode}</span></div>
                  </div>
                </div>

                {/* 2. RECEIPT BODY & INLINE RETURNS GRID */}
                <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', background: '#f1f5f9', color: '#0f172a' }}>
                        <th style={{ padding: '6px 4px', width: '30px', textAlign: 'center' }}>Sr#</th>
                        <th style={{ padding: '6px 6px', width: '90px' }}>Bar Code</th>
                        <th style={{ padding: '6px 6px' }}>Item Name</th>
                        <th style={{ padding: '6px 4px', width: '45px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '6px 6px', width: '65px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '6px 4px', width: '50px', textAlign: 'center' }}>Disc%</th>
                        <th style={{ padding: '6px 6px', width: '60px', textAlign: 'right' }}>Cash Disc</th>
                        <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right' }}>Net Amt</th>

                        {/* INLINE RETURN COLUMNS */}
                        <th style={{ padding: '6px 6px', width: '65px', textAlign: 'center', background: '#fee2e2', color: '#991b1b', borderLeft: '1px solid #fca5a5' }} className="no-print">
                          Return Qty
                        </th>
                        <th style={{ padding: '6px 6px', width: '75px', textAlign: 'center', background: '#fee2e2', color: '#991b1b' }} className="no-print">
                          Condition
                        </th>
                        <th style={{ padding: '6px 6px', width: '60px', textAlign: 'center', background: '#fee2e2', color: '#991b1b' }} className="no-print">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoiceData.details || []).map((item: InvoiceItem, idx: number) => {
                        const unitNet = getLineNetUnitPrice(item);
                        const lineNet = item.qty * unitNet;
                        const key = item.id || idx;
                        const rState = returnState[key] || { returnQty: 0, condition: 'Good' };

                        return (
                          <tr key={key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 6px', fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>{item.barCode || item.productCode || '-'}</td>
                            <td style={{ padding: '6px 6px', fontWeight: 700, color: '#0f172a' }}>{item.productName}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{item.qty}</td>
                            <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>{item.price.toLocaleString()}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center', color: item.discPercent > 0 ? '#0284c7' : '#94a3b8' }}>
                              {item.discPercent > 0 ? `${item.discPercent}%` : '-'}
                            </td>
                            <td style={{ padding: '6px 6px', textAlign: 'right', color: item.cashDiscount > 0 ? '#0284c7' : '#94a3b8' }}>
                              {item.cashDiscount > 0 ? `${item.cashDiscount}` : '-'}
                            </td>
                            <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                              Rs. {lineNet.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </td>

                            {/* DOCUMENT INLINE RETURN CONTROLS */}
                            <td style={{ padding: '3px 4px', background: '#fff5f5', borderLeft: '1px solid #fca5a5' }} className="no-print">
                              <input
                                type="number"
                                min="0"
                                max={item.qty}
                                step="1"
                                value={rState.returnQty}
                                onChange={e => handleReturnQtyChange(key, item.qty, e.target.value)}
                                style={{
                                  width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 800,
                                  border: '1px solid #fca5a5', borderRadius: '3px', outline: 'none',
                                  background: rState.returnQty > 0 ? '#fef2f2' : '#ffffff',
                                  color: rState.returnQty > 0 ? '#dc2626' : '#64748b'
                                }}
                              />
                            </td>

                            <td style={{ padding: '3px 4px', background: '#fff5f5' }} className="no-print">
                              <select
                                value={rState.condition}
                                onChange={e => handleConditionChange(key, e.target.value as 'Good' | 'Damaged')}
                                style={{
                                  width: '100%', height: '24px', fontSize: '10px', fontWeight: 700,
                                  border: '1px solid #cbd5e1', borderRadius: '3px', padding: '0 2px',
                                  color: rState.condition === 'Good' ? '#16a34a' : '#dc2626'
                                }}
                              >
                                <option value="Good">Good</option>
                                <option value="Damaged">Damaged</option>
                              </select>
                            </td>

                            <td style={{ padding: '3px 4px', textAlign: 'center', background: '#fff5f5' }} className="no-print">
                              <button
                                onClick={() => handleSubmitInlineReturn(key)}
                                disabled={rState.returnQty <= 0 || isSubmittingReturn}
                                title="Process return for this line item"
                                style={{
                                  padding: '2px 6px', fontSize: '10px', fontWeight: 800,
                                  background: rState.returnQty > 0 ? '#dc2626' : '#cbd5e1',
                                  color: '#ffffff', border: 'none', borderRadius: '3px',
                                  cursor: rState.returnQty > 0 ? 'pointer' : 'not-allowed'
                                }}
                              >
                                Return
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 3. RECEIPT FOOTER FINANCIAL SUMMARY */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px', borderTop: '2px solid #0f172a', paddingTop: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>Terms & Warranty Conditions:</strong>
                      <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
                        1. Goods once sold can be returned within 7 days with original receipt.<br />
                        2. Returned items in damaged condition are subject to inspection and write-off processing.<br />
                        3. Thank you for doing business with <strong>{storeTitle}</strong>!
                      </p>
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '32px' }}>
                      <div style={{ borderTop: '1px solid #0f172a', width: '120px', textAlign: 'center', paddingTop: '2px', fontWeight: 700 }}>
                        Customer Sign
                      </div>
                      <div style={{ borderTop: '1px solid #0f172a', width: '120px', textAlign: 'center', paddingTop: '2px', fontWeight: 700 }}>
                        Authorized Stamp
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Gross Amount:</span>
                      <strong style={{ color: '#0f172a' }}>Rs. {detailsGrossTotal.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0284c7' }}>
                      <span>Total Discount:</span>
                      <strong>-Rs. {detailsTotalDiscount.toLocaleString()}</strong>
                    </div>

                    <div style={{ borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900 }}>
                      <span>Net Value:</span>
                      <span style={{ color: '#0284c7' }}>Rs. {(invoiceData.totalAmount || 0).toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 700 }}>
                      <span>Payment Received:</span>
                      <span>Rs. {(invoiceData.paymentReceived || 0).toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: invoiceData.remainingDues > 0 ? '#dc2626' : '#64748b', fontWeight: 800 }}>
                      <span>Remaining Dues:</span>
                      <span>Rs. {(invoiceData.remainingDues || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BATCH SUBMIT RETURNS BAR AT BOTTOM OF MODAL */}
              {totalReturnItemsCount > 0 && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                  <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 800 }}>
                    Selected Return Items: <span style={{ color: '#dc2626' }}>{totalReturnItemsCount} Pcs</span> — Total Refund: <span style={{ fontSize: '16px', color: '#dc2626' }}>Rs. {totalReturnRefund.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>
                  <button
                    onClick={() => handleSubmitInlineReturn()}
                    disabled={isSubmittingReturn}
                    style={{
                      padding: '8px 18px', background: '#dc2626', color: '#ffffff',
                      border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 800,
                      cursor: isSubmittingReturn ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    <RotateCcw size={15} /> {isSubmittingReturn ? 'Processing Returns...' : 'SUBMIT ALL RETURNS'}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* PRINT MEDIA STYLES TO ENSURE CLEAN PRINT OUTPUT */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
};

export default InvoiceDetailsModal;
