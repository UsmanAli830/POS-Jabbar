import React, { useState, useEffect } from 'react';
import { Save, Truck, Banknote } from 'lucide-react';

const VendorPayments: React.FC = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [vendorBalance, setVendorBalance] = useState<number | null>(null);
  
  const [amount, setAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (vendorId !== '') {
      fetchBalance(Number(vendorId));
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

  const fetchBalance = async (id: number) => {
    try {
      // Re-using the finance API we built for balances (if not specific to vendor by ID, we can fetch all and find)
      const res = await fetch('http://localhost:3000/api/finance/balances/vendors');
      if (res.ok) {
        const data = await res.json();
        const v = data.find((x: any) => x.id === id);
        setVendorBalance(v ? v.balance : 0);
      } else {
        setVendorBalance(0);
      }
    } catch (e) {
      setVendorBalance(0);
    }
  };

  const handleSave = async () => {
    if (!vendorId || !amount || Number(amount) <= 0) {
      alert('Please select a vendor and enter a valid amount.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/payments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: Number(vendorId),
          amount: Number(amount),
          remarks
        })
      });

      if (res.ok) {
        alert('Payment successfully made! General Ledger updated.');
        setAmount('');
        setRemarks('');
        fetchBalance(Number(vendorId));
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
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Vendor Payments</h1>
        <p className="text-sm text-gray-500 mb-6">Make payments to suppliers to settle accounts payable.</p>
      </div>

      <div className="glass-panel p-6 w-full max-w-[600px] flex flex-col gap-5">
        <div className="form-group">
          <label className="desktop-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={16} /> Select Vendor
          </label>
          <select 
            className="desktop-input" 
            value={vendorId} 
            onChange={e => setVendorId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ fontSize: '16px', padding: '12px' }}
          >
            <option value="">-- Select Vendor --</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
          </select>
        </div>

        {vendorBalance !== null && (
          <div style={{ background: vendorBalance > 0 ? '#fee2e2' : '#f1f5f9', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>Current Payable Balance</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: vendorBalance > 0 ? '#ef4444' : '#10b981' }}>
              Rs {Math.abs(vendorBalance).toFixed(2)} {vendorBalance > 0 ? '(Cr - You Owe Them)' : (vendorBalance < 0 ? '(Dr - They Owe You)' : '')}
            </span>
          </div>
        )}

        <div className="form-group">
          <label className="desktop-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Banknote size={16} /> Payment Amount
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
            placeholder="e.g. Paid via Bank Transfer Check 123..."
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
    </div>
  );
};

export default VendorPayments;
