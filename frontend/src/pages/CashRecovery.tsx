import React, { useState, useEffect } from 'react';
import { Save, User, Banknote, Printer } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';

const CashRecovery: React.FC = () => {
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  
  const [amount, setAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'payment', data: {} });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (customerId !== '') {
      fetchBalance(Number(customerId));
    } else {
      setCustomerBalance(null);
    }
  }, [customerId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBalance = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/customers/${id}/balance`);
      if (res.ok) {
        const data = await res.json();
        setCustomerBalance(data.balance);
      } else {
        setCustomerBalance(0);
      }
    } catch (e) {
      setCustomerBalance(0);
    }
  };

  const handleSave = async () => {
    if (!customerId || !amount || Number(amount) <= 0) {
      alert('Please select a customer and enter a valid amount.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/payments/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(customerId),
          amount: Number(amount),
          remarks
        })
      });

      if (res.ok) {
        const data = await res.json();
        const cust = customers.find(c => c.id === Number(customerId));
        const paidAmt = Number(amount);
        const remBal = (customerBalance || 0) - paidAmt;
        setReceiptModal({
          isOpen: true,
          type: 'payment',
          data: {
            id: data.id || 'REC',
            storeName: settings?.storeName || 'Wholesale ERP',
            storeAddress: settings?.storeAddress || '',
            receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
            accountName: cust?.name || cust?.custName || 'Customer',
            paymentDate: new Date().toISOString(),
            amountPaid: paidAmt,
            paymentMode: 'Cash Recovery',
            remarks: remarks || 'Cash Recovery Received',
            remainingBalance: remBal,
            voucherType: 'Payment Received (Cash Recovery)',
          }
        });
        setAmount('');
        setRemarks('');
        fetchBalance(Number(customerId));
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full items-center">
      <div className="mt-6 pt-4 mb-6 w-full max-w-[600px]">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Cash Recovery</h1>
        <p className="text-sm text-gray-500 mb-6">Receive payments from customers to settle accounts receivable.</p>
      </div>

      <div className="glass-panel p-6 w-full max-w-[600px] flex flex-col gap-5">
        <div className="form-group">
          <label className="desktop-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} /> Select Customer
          </label>
          <select 
            className="desktop-input" 
            value={customerId} 
            onChange={e => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ fontSize: '16px', padding: '12px' }}
          >
            <option value="">-- Select Customer --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name || c.custName} - Balance: Rs. {(c.CurrentBalance !== undefined ? c.CurrentBalance : (c.liveBalance || 0)).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {customerBalance !== null && (
          <div style={{ background: customerBalance > 0 ? '#fee2e2' : '#f1f5f9', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>Current Balance</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: customerBalance > 0 ? '#ef4444' : '#10b981' }}>
              Rs {Math.abs(customerBalance).toFixed(2)} {customerBalance > 0 ? '(Dr - They Owe You)' : (customerBalance < 0 ? '(Cr - You Owe Them)' : '')}
            </span>
          </div>
        )}

        <div className="form-group">
          <label className="desktop-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Banknote size={16} /> Amount Received
          </label>
          <input 
            type="number" 
            className="desktop-input" 
            value={amount} 
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            style={{ fontSize: '24px', padding: '16px', fontWeight: 'bold', color: '#0f172a' }}
          />
        </div>

        <div className="form-group">
          <label className="desktop-label">Remarks / Description</label>
          <input 
            type="text" 
            className="desktop-input" 
            value={remarks} 
            onChange={e => setRemarks(e.target.value)}
            placeholder="e.g. Cash handed over by John..."
          />
        </div>

        <button 
          className="btn-primary" 
          onClick={handleSave}
          style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}
        >
          <Save size={20} /> Record Payment
        </button>
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

export default CashRecovery;
