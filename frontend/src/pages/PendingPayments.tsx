import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle } from 'lucide-react';

const PendingPayments: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const fetchPending = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/payments/pending');
      if (res.ok) {
        setSales(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleReceivePayment = async () => {
    if (!selectedSale || !paymentAmount) return;

    try {
      const res = await fetch('http://localhost:3000/api/payments/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: selectedSale.id,
          amount: parseFloat(paymentAmount),
          paymentMethod
        })
      });

      if (res.ok) {
        alert('Payment processed successfully!');
        setSelectedSale(null);
        setPaymentAmount('');
        fetchPending();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full">
      <div className="mt-6 pt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1"><CreditCard size={26} className="inline mr-2 align-bottom text-blue-600" /> Pending Payments</h1>
        <p className="text-sm text-gray-500 mb-6">Clear outstanding balances and customer credit sales.</p>
      </div>

      <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th className="min-w-[120px]">Invoice #</th>
              <th className="min-w-[120px]">Date</th>
              <th className="min-w-[150px]">Customer</th>
              <th className="min-w-[130px] text-right">Total Amount</th>
              <th className="min-w-[130px] text-right">Amount Paid</th>
              <th className="min-w-[130px] text-right">Balance Due</th>
              <th className="min-w-[110px] text-center">Status</th>
              <th className="min-w-[100px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>No pending payments found.</td></tr>
            ) : (
              sales.map(sale => {
                const balance = sale.total - sale.amountPaid;
                return (
                  <tr key={sale.id}>
                    <td>{sale.invoiceNumber}</td>
                    <td>{new Date(sale.date).toLocaleDateString()}</td>
                    <td>{sale.customer ? sale.customer.name : 'Unknown'}</td>
                    <td>Rs. {sale.total.toLocaleString()}</td>
                    <td>Rs. {sale.amountPaid.toLocaleString()}</td>
                    <td style={{ color: '#ef4444', fontWeight: 'bold' }}>Rs. {balance.toLocaleString()}</td>
                    <td>
                      <span style={{ 
                        background: sale.paymentStatus === 'PARTIAL' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                        color: sale.paymentStatus === 'PARTIAL' ? '#f59e0b' : '#ef4444', 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px' 
                      }}>
                        {sale.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => { setSelectedSale(sale); setPaymentAmount(balance.toFixed(2)); }}
                      >
                        Receive Payment
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedSale && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2>Receive Payment</h2>
            <div>Invoice: <strong>{selectedSale.invoiceNumber}</strong></div>
            <div>Balance Due: <strong style={{ color: '#ef4444' }}>Rs. {(selectedSale.total - selectedSale.amountPaid).toLocaleString()}</strong></div>
            
            <div className="form-group">
              <label className="form-label">Amount to Receive</label>
              <input 
                type="number" 
                className="form-input" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)} 
                step="0.01" 
                max={(selectedSale.total - selectedSale.amountPaid).toFixed(2)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setSelectedSale(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleReceivePayment}>
                <CheckCircle size={18} style={{ marginRight: '8px' }} /> Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingPayments;
