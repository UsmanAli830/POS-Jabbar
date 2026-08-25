import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Save, Plus, Trash2, Printer } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';

type CartItem = {
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
};

const PurchaseManagement: React.FC = () => {
  const { products, refreshInventory } = useInventory();
  const { settings } = useSettings();
  const [vendors, setVendors] = useState<any[]>([]);
  
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [vendorLocations, setVendorLocations] = useState<any[]>([]);
  const [vendorLocationId, setVendorLocationId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [qty, setQty] = useState<string>('1');
  const [cost, setCost] = useState<string>('0');
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'purchase', data: {} });

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (vendorId) {
      fetchVendorLocations(Number(vendorId));
    } else {
      setVendorLocations([]);
      setVendorLocationId('');
    }
  }, [vendorId]);

  const fetchVendorLocations = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/vendors/${id}/locations`);
      if (res.ok) {
        const data = await res.json();
        setVendorLocations(data);
        if (data.length > 0) setVendorLocationId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch vendor locations', e);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/vendors');
      if (res.ok) {
        setVendors(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch vendors', e);
    }
  };

  const handleAddToCart = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    setCart(prev => [...prev, {
      productId: prod.id,
      productName: prod.productName,
      quantity: parseFloat(qty) || 1,
      costPrice: parseFloat(cost) || 0
    }]);

    setSelectedProductId('');
    setQty('1');
    setCost('0');
  };

  const handleRemove = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePurchase = async () => {
    if (!vendorId || cart.length === 0) {
      alert('Vendor and items are required');
      return;
    }

    try {
      const payload = {
        vendorId,
        locationId: vendorLocationId || undefined,
        invoiceNumber,
        items: cart
      };

      const res = await fetch('http://localhost:3000/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const selectedVendor = vendors.find(v => v.id === Number(vendorId));
        setReceiptModal({
          isOpen: true,
          type: 'purchase',
          data: {
            id: data.id || invoiceNumber || 'PO',
            storeName: settings?.storeName || 'Wholesale ERP',
            storeAddress: settings?.storeAddress || '',
            receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
            date: new Date().toISOString(),
            vendorName: selectedVendor?.companyName || 'Vendor',
            invoiceNo: invoiceNumber || `PUR-${data.id || Date.now()}`,
            paymentMode: 'On Account / Credit',
            items: cart.map((c, i) => ({
              sr: i + 1,
              name: c.productName,
              qty: c.quantity,
              rate: c.costPrice,
              netAmount: c.quantity * c.costPrice
            })),
            grossAmount: total,
            totalDiscount: 0,
            netPayable: total,
          }
        });
        setCart([]);
        setVendorId('');
        setInvoiceNumber('');
        await refreshInventory(); // Global synchronization
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const total = cart.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">Vendor Purchases (Accounts Payable)</h1>
        <p className="page-subtitle">Receive stock from vendors, update inventory, and credit their ledger.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane */}
        <div className="glass-panel" style={{ flex: '0 0 35%', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div className="desktop-section-title">Purchase Details</div>
          
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Select Vendor</label>
            <select className="form-select" value={vendorId} onChange={e => setVendorId(e.target.value === '' ? '' : parseInt(e.target.value))}>
              <option value="">-- Vendor --</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Supply From Location</label>
            <select 
              className="form-select" 
              value={vendorLocationId} 
              onChange={e => setVendorLocationId(e.target.value === '' ? '' : parseInt(e.target.value))}
              disabled={!vendorId || vendorLocations.length === 0}
            >
              <option value="">Default Location</option>
              {vendorLocations.map(l => <option key={l.id} value={l.id}>{l.locationName}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Vendor Invoice No.</label>
            <input className="form-input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2024-99" />
          </div>

          <div className="desktop-section-title">Add Item</div>
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">Product</label>
            <select className="form-select" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value === '' ? '' : parseInt(e.target.value))}>
              <option value="">-- Select Product --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.productName} ({p.currentStock} in stock)</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Cost Price</label>
              <input type="number" className="form-input" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-secondary" onClick={handleAddToCart} style={{ width: '100%', marginBottom: '24px' }}>
            <Plus size={16} /> Add to Purchase List
          </button>
        </div>

        {/* Right Pane */}
        <div className="glass-panel" style={{ flex: '1', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="desktop-section-title">Purchase Cart</div>
          
          <div style={{ flex: 1, overflowY: 'auto' }} className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Cost Price</th>
                  <th>Line Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No items added</td></tr>
                ) : (
                  cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>Rs. {item.costPrice.toLocaleString()}</td>
                      <td>Rs. {(item.quantity * item.costPrice).toLocaleString()}</td>
                      <td>
                        <button onClick={() => handleRemove(idx)} style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#e2e8f0', border: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
              Total: Rs. {total.toLocaleString()}
            </div>
            <button className="btn btn-primary" onClick={handleSavePurchase}>
              <Save size={16} /> Complete Purchase
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

export default PurchaseManagement;
