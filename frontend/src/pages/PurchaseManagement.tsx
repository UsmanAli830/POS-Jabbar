import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Save, Plus, Trash2, Printer, Search, X } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';

type CartItem = {
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
};

const PurchaseManagement: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canEditBills = Boolean(user?.isAdmin || user?.role === 'ADMIN' || user?.username === 'admin' || hasPermission('purchase:edit') || hasPermission('allow-bill-editing'));
  const { products, refreshInventory } = useInventory();
  const { settings } = useSettings();
  const [vendors, setVendors] = useState<any[]>([]);
  
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [vendorLocations, setVendorLocations] = useState<any[]>([]);
  const [vendorLocationId, setVendorLocationId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [searchPoId, setSearchPoId] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
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

  // Settlement state
  const [cashPaid, setCashPaid] = useState<string>('0');

  const total = cart.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);
  const cashPaidVal = Math.min(total, Math.max(0, parseFloat(cashPaid) || 0));
  const adjustedInBalance = Math.max(0, total - cashPaidVal);

  const handleSearchPurchase = async () => {
    if (!searchPoId.trim()) return;
    setIsSearching(true);
    try {
      const cleanId = searchPoId.trim().toUpperCase().replace('PO-', '').replace('PUR-', '');
      const res = await fetch(`http://localhost:3000/api/purchases/${cleanId}`);
      if (res.ok) {
        const pur = await res.json();
        setEditingPurchaseId(pur.id);
        setVendorId(pur.sellerRecId || '');
        setInvoiceNumber(`PUR-${pur.id}`);
        setCart((pur.details || []).map((d: any) => ({
          productId: d.productRecId,
          productName: d.productRec?.productName || `Product #${d.productRecId}`,
          quantity: d.qty,
          costPrice: d.costPrice || d.price || 0
        })));
      } else {
        alert(`Purchase bill #${searchPoId} not found`);
      }
    } catch (e) {
      alert('Error loading purchase bill');
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetPurchase = () => {
    setEditingPurchaseId(null);
    setSearchPoId('');
    setCart([]);
    setVendorId('');
    setInvoiceNumber('');
    setCashPaid('0');
  };

  const handleSavePurchase = async () => {
    if (!vendorId || cart.length === 0) {
      alert('Vendor and items are required');
      return;
    }

    if (editingPurchaseId && !canEditBills) {
      alert('Access Denied: You do not have permission to edit existing bills ("Allow Bill Editing / Update" permission required).');
      return;
    }

    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const payload = {
        vendorId,
        sellerRecId: vendorId,
        locationId: vendorLocationId || undefined,
        invoiceNumber,
        cashPaid: cashPaidVal,
        items: cart.map(c => ({
          productId: c.productId,
          productRecId: c.productId,
          quantity: c.quantity,
          qty: c.quantity,
          costPrice: c.costPrice,
          price: c.costPrice
        }))
      };

      const url = editingPurchaseId
        ? `http://localhost:3000/api/purchases/${editingPurchaseId}`
        : 'http://localhost:3000/api/purchases';

      const method = editingPurchaseId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
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
            paymentMode: cashPaidVal > 0 && adjustedInBalance > 0 
              ? 'Split (Cash + Credit)' 
              : (cashPaidVal > 0 ? 'Cash Payment' : 'On Account / Credit'),
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
            amountPaid: cashPaidVal,
            balanceDue: adjustedInBalance,
            remainingBalance: data.vendorBalance !== undefined ? data.vendorBalance : undefined
          }
        });
        handleResetPurchase();
        await refreshInventory(); // Global synchronization
      } else {
        const err = await res.json();
        alert('Failed: ' + (err.error || 'Failed to save purchase'));
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Vendor Purchases (Accounts Payable)</h1>
          <p className="page-subtitle">Receive stock from vendors, update inventory, and credit their ledger.</p>
        </div>

        {/* PO SEARCH & EDIT LOOKUP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', background: '#ffffff' }}>
            <input
              type="text"
              placeholder="Search PO / PUR # (e.g. 1)"
              value={searchPoId}
              onChange={e => setSearchPoId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchPurchase()}
              style={{ padding: '6px 10px', fontSize: '12px', border: 'none', outline: 'none', width: '180px' }}
            />
            <button
              onClick={handleSearchPurchase}
              disabled={isSearching}
              style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700 }}
            >
              <Search size={14} /> {isSearching ? 'Loading...' : 'Edit Bill'}
            </button>
          </div>
          {editingPurchaseId && (
            <button
              onClick={handleResetPurchase}
              style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700 }}
            >
              <X size={14} /> Cancel Edit
            </button>
          )}
        </div>
      </div>

      {editingPurchaseId && (
        <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>
            ✏️ Editing Loaded Purchase Bill #PUR-{editingPurchaseId}
          </span>
          {!canEditBills && (
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: '3px' }}>
              🔒 Read-Only Access: "Allow Bill Editing / Update" Permission Required
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane */}
        <div className="glass-panel" style={{ flex: '0 0 35%', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div className="desktop-section-title">Purchase Details</div>
          
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Select Vendor *</label>
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

          {/* Split Settlement Controls */}
          <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Total Invoice Value
                </label>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  Rs. {total.toLocaleString()}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#15803d', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Cash Paid to Vendor (Rs.)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  max={total}
                  value={cashPaid}
                  onChange={e => setCashPaid(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1.5px solid #16a34a',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#15803d',
                    outline: 'none',
                    background: '#f0fdf4'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#b91c1c', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Adjusted in Balance (Rs.)
                </label>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid #ef4444',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: '#b91c1c',
                  background: '#fef2f2'
                }}>
                  Rs. {adjustedInBalance.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginTop: '4px' }}>
              {editingPurchaseId && !canEditBills && (
                <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '4px', fontWeight: 700 }}>
                  🔒 Read-Only Access: "Allow Bill Editing / Update" Permission Required
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSavePurchase}
                disabled={cart.length === 0 || !vendorId || (!!editingPurchaseId && !canEditBills)}
                style={{
                  padding: '10px 24px', fontSize: '14px', fontWeight: 800,
                  background: (editingPurchaseId && !canEditBills) ? '#cbd5e1' : undefined,
                  cursor: (editingPurchaseId && !canEditBills) ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={16} /> {editingPurchaseId ? 'UPDATE PURCHASE & SYNC LEDGER' : 'Complete Purchase & Print Receipt'}
              </button>
            </div>
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
