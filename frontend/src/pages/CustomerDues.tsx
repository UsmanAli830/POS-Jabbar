import React, { useState, useEffect } from 'react';
import { UserCheck, Banknote, CreditCard, History, CheckCircle, ArrowDownLeft, CalendarDays, Printer } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';

type Customer = {
  id: number;
  custName?: string;
  name?: string;
  phone?: string;
  CurrentBalance?: number;
  liveBalance?: number;
};

type PaymentHistoryItem = {
  id: number;
  date: string | Date;
  description: string;
  amount: number;
  remarks: string;
};

const CustomerDues: React.FC = () => {
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [finHeads, setFinHeads] = useState<any[]>([]);

  // Payment Form Fields
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [finHeadId, setFinHeadId] = useState<number | ''>('');
  const [remarks, setRemarks] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'payment', data: {} });

  useEffect(() => {
    fetchCustomers();
    fetchFinHeads();
  }, []);

  useEffect(() => {
    if (selectedCustomerId !== '') {
      fetchCustomerHistory(Number(selectedCustomerId));
    } else {
      setLiveBalance(null);
      setHistory([]);
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFinHeads = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/finance/heads');
      if (res.ok) {
        const data = await res.json();
        setFinHeads(data);
        if (data.length > 0 && !finHeadId) setFinHeadId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomerHistory = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dues/customer/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setLiveBalance(data.liveBalance);
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !amount || Number(amount) <= 0) {
      alert('Please select a customer and enter a valid payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:3000/api/dues/customer/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(selectedCustomerId),
          amount: Number(amount),
          paymentMethod,
          finHeadId: finHeadId || undefined,
          remarks,
          paymentDate
        })
      });

      if (res.ok) {
        const result = await res.json();
        alert('🎉 Payment successfully received! Dues balance updated.');
        setAmount('');
        setRemarks('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        
        // Instant UI Reactivity: Refresh balance & history list without F5
        setLiveBalance(result.newLiveBalance);
        fetchCustomerHistory(Number(selectedCustomerId));
        fetchCustomers();
      } else {
        const err = await res.json();
        alert('Payment error: ' + (err.error || 'Failed'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error while processing payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full p-4">
      
      {/* HEADER TITLE */}
      <div className="mt-6 pt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1 flex items-center gap-2">
          <UserCheck size={26} className="text-blue-600" /> Customer Dues & Recovery Management
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Receive payments, clear customer receivables, and track permanent payment history.
        </p>
      </div>

      {/* TOP HALF: PAYMENT FORM & LIVE BALANCE BADGE */}
      <div className="glass-panel p-6" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        
        <form onSubmit={handleReceivePayment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>Select Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ width: '100%', height: '32px', padding: '4px 8px', fontSize: '12px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.custName || c.name} - Current Dues: Rs. {(c.CurrentBalance !== undefined ? c.CurrentBalance : (c.liveBalance || 0)).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                style={{ width: '100%', height: '32px', padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '3px' }}>Payment Amount Received (Rs) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', height: '32px', padding: '4px 8px', fontSize: '14px', fontWeight: 800, border: '1px solid #0284c7', borderRadius: '3px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>Financial Head (Account)</label>
              <select
                value={finHeadId}
                onChange={e => setFinHeadId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ width: '100%', height: '32px', padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
              >
                {finHeads.map(fh => (
                  <option key={fh.id} value={fh.id}>{fh.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>Remarks / Ref Note</label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Received via Bank Transfer Ref # 99281"
                style={{ width: '100%', height: '30px', padding: '4px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '3px' }}>
                <CalendarDays size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                style={{ width: '100%', height: '30px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, border: '2px solid #f59e0b', borderRadius: '3px', outline: 'none', background: '#fffbeb', color: '#92400e' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !selectedCustomerId}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 800, background: !selectedCustomerId || isSubmitting ? '#cbd5e1' : '#16a34a',
              color: '#ffffff', border: 'none', borderRadius: '3px', cursor: !selectedCustomerId || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px'
            }}
          >
            <ArrowDownLeft size={16} /> {isSubmitting ? 'Processing Payment...' : 'CLEAR DUE / RECEIVE PAYMENT'}
          </button>
        </form>

        {/* LIVE OUTSTANDING BALANCE DISPLAY BADGE */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Live Outstanding Dues
          </span>
          
          <div style={{ fontSize: '26px', fontWeight: 900, color: (liveBalance || 0) > 0 ? '#dc2626' : '#16a34a', margin: '8px 0' }}>
            {liveBalance !== null ? `Rs. ${liveBalance.toLocaleString()}` : 'Select Customer'}
          </div>

          {selectedCustomer && (
            <div style={{ fontSize: '11px', color: '#334155', fontWeight: 600 }}>
              {selectedCustomer.custName || selectedCustomer.name}
              {selectedCustomer.phone && <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Phone: {selectedCustomer.phone}</span>}
            </div>
          )}
        </div>

      </div>

      {/* BOTTOM HALF: PERMANENT PAYMENT HISTORY GRID */}
      <div style={{ flex: 1, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={16} style={{ color: '#0284c7' }} /> Payment History Record
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            {history.length} Payment Records Found
          </span>
        </div>

        <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm flex-1">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                <th className="min-w-[60px]" style={{ padding: '8px 12px' }}>#</th>
                <th className="min-w-[160px]" style={{ padding: '8px 12px' }}>Date & Time</th>
                <th className="min-w-[180px]" style={{ padding: '8px 12px' }}>Description / Method</th>
                <th className="min-w-[140px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Amount Received</th>
                <th className="min-w-[60px]" style={{ padding: '8px 12px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    {selectedCustomerId ? 'No payment history found for this customer.' : 'Select a customer to view payment history.'}
                  </td>
                </tr>
              ) : (
                history.map((h, idx) => (
                  <tr key={h.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {new Date(h.date).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{h.description}</div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                      Rs. {h.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          const selectedCustomer = customers.find(c => c.id === Number(selectedCustomerId));
                          setReceiptModal({
                            isOpen: true, type: 'payment',
                            data: {
                              storeName: settings?.storeName || 'Wholesale ERP',
                              storeAddress: settings?.storeAddress || '',
                              receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
                              accountName: selectedCustomer?.custName || selectedCustomer?.name || 'Customer',
                              paymentDate: h.date as string,
                              amountPaid: h.amount,
                              paymentMode: 'Cash',
                              remarks: h.remarks || h.description,
                              remainingBalance: liveBalance || 0,
                              voucherType: 'Payment Received (Customer)',
                            }
                          });
                        }}
                        title="Print Receipt"
                        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', color: '#475569', display: 'inline-flex' }}
                      >
                        <Printer size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

export default CustomerDues;
