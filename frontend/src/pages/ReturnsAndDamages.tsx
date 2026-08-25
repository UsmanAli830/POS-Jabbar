import React, { useState, useEffect } from 'react';
import { RefreshCcw, PackageOpen, RotateCcw, Trash2, DollarSign, Undo } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

const ReturnsAndDamages: React.FC = () => {
  const { products, refreshInventory } = useInventory();
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'QUARANTINE'>('CUSTOMER');

  // Common Master Data
  const [locations, setLocations] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Customer Return State
  const [crProduct, setCrProduct] = useState('');
  const [crLocation, setCrLocation] = useState('');
  const [crQuantity, setCrQuantity] = useState('');
  const [crCondition, setCrCondition] = useState('GOOD');
  const [crRefund, setCrRefund] = useState('');
  const [crLoading, setCrLoading] = useState(false);

  // Quarantine State
  const [damagedItems, setDamagedItems] = useState<any[]>([]);
  const [qProduct, setQProduct] = useState('');
  const [qLocation, setQLocation] = useState('');
  const [qVendor, setQVendor] = useState('');
  const [qQuantity, setQQuantity] = useState('');
  const [qDescription, setQDescription] = useState('');
  const [qLoading, setQLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState<{ id: number; status: string; maxQty: number, productName: string } | null>(null);
  const [resolveQty, setResolveQty] = useState('');
  const [resolvePrice, setResolvePrice] = useState('');

  useEffect(() => {
    fetchMasterData();
    fetchDamagedStock();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [mdRes, venRes] = await Promise.all([
        fetch('http://localhost:3000/api/master-data'),
        fetch('http://localhost:3000/api/vendors')
      ]);
      if (mdRes.ok) {
        const md = await mdRes.json();
        setLocations(md.locations || []);
      }
      if (venRes.ok) setVendors(await venRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDamagedStock = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/wastage');
      if (res.ok) setDamagedItems(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCustomerReturn = async () => {
    if (!crProduct || !crQuantity || !crLocation) return;
    setCrLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: crProduct,
          locationId: crLocation,
          quantity: parseFloat(crQuantity),
          condition: crCondition,
          refundAmount: parseFloat(crRefund || '0')
        })
      });

      if (res.ok) {
        alert('Return processed successfully! Financials and inventory updated.');
        setCrProduct('');
        setCrQuantity('');
        setCrRefund('');
        setCrCondition('GOOD');
        await refreshInventory();
        fetchDamagedStock();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setCrLoading(false);
    }
  };

  const handleQuarantine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qProduct || !qLocation || !qQuantity) return;
    setQLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/wastage/quarantine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: qProduct,
          locationId: qLocation,
          vendorId: qVendor || null,
          quantity: parseFloat(qQuantity),
          description: qDescription
        })
      });

      if (res.ok) {
        alert('Stock quarantined successfully! Inventory deducted.');
        setQProduct('');
        setQQuantity('');
        setQDescription('');
        await refreshInventory();
        fetchDamagedStock();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setQLoading(false);
    }
  };

  const openResolveModal = (item: any, status: string) => {
    setResolveModal({ id: item.id, status, maxQty: item.quantity, productName: item.product?.productName });
    setResolveQty(item.quantity.toString());
    setResolvePrice('');
  };

  const submitResolve = async () => {
    if (!resolveModal) return;
    const { id, status } = resolveModal;
    
    try {
      const res = await fetch(`http://localhost:3000/api/wastage/resolve/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          scrapSaleAmount: resolvePrice ? parseFloat(resolvePrice) : 0,
          quantity: parseFloat(resolveQty)
        })
      });

      if (res.ok) {
        alert('Item resolved successfully and Ledgers updated!');
        setResolveModal(null);
        fetchDamagedStock();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const handleRevert = async (id: number) => {
    if (!window.confirm("Are you sure you want to revert this item back to Quarantined? This will reverse all associated financial ledger entries.")) return;
    
    try {
      const res = await fetch(`http://localhost:3000/api/wastage/revert/${id}`, {
        method: 'PUT'
      });

      if (res.ok) {
        alert('Item reverted successfully and Ledgers reversed!');
        fetchDamagedStock();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">Returns & Damages Workflow</h1>
        <p className="page-subtitle">Unified module for Customer Returns, Quarantine, and Scrap Resolutions.</p>
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button 
            className={`btn ${activeTab === 'CUSTOMER' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('CUSTOMER')}
          >
            <RefreshCcw size={16} /> Customer Returns
          </button>
          <button 
            className={`btn ${activeTab === 'QUARANTINE' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('QUARANTINE')}
          >
            <PackageOpen size={16} /> Damaged Stock & Quarantines
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
        
        {activeTab === 'CUSTOMER' && (
          <div className="glass-panel" style={{ padding: '24px', maxWidth: '600px', width: '100%', overflowY: 'auto' }}>
            <div className="desktop-section-title">Process Customer Return</div>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Location (Where is it returned to?)</label>
              <select className="form-select" value={crLocation} onChange={e => setCrLocation(e.target.value)}>
                <option value="">Select Location</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Product Returned</label>
              <select className="form-select" value={crProduct} onChange={e => setCrProduct(e.target.value)}>
                <option value="">Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.productName} ({p.barCode})</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Quantity</label>
                <input type="number" className="form-input" value={crQuantity} onChange={e => setCrQuantity(e.target.value)} min="1" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Refund Amount (Rs.)</label>
                <input type="number" className="form-input" value={crRefund} onChange={e => setCrRefund(e.target.value)} min="0" step="0.01" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Item Condition</label>
              <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '12px', border: '1px solid #cbd5e1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="condition" value="GOOD" checked={crCondition === 'GOOD'} onChange={() => setCrCondition('GOOD')} />
                  <span style={{ color: crCondition === 'GOOD' ? '#10b981' : '', fontWeight: 'bold' }}>GOOD (Sellable)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="condition" value="DAMAGED" checked={crCondition === 'DAMAGED'} onChange={() => setCrCondition('DAMAGED')} />
                  <span style={{ color: crCondition === 'DAMAGED' ? '#ef4444' : '', fontWeight: 'bold' }}>DAMAGED (Quarantine)</span>
                </label>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px' }}
              onClick={handleCustomerReturn}
              disabled={crLoading || !crProduct || !crQuantity || !crLocation}
            >
              {crLoading ? 'Processing...' : 'Complete Return & Refund'}
            </button>
          </div>
        )}

        {activeTab === 'QUARANTINE' && (
          <>
            {/* Left Pane: Quarantine Form */}
            <div className="glass-panel" style={{ flex: '0 0 35%', padding: '24px', overflowY: 'auto' }}>
              <div className="desktop-section-title" style={{ color: '#f59e0b' }}>Report Internal Damages</div>
              
              <form onSubmit={handleQuarantine}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Product</label>
                  <select required className="form-select" value={qProduct} onChange={e => setQProduct(e.target.value)}>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.productCode} - {p.productName}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Location</label>
                  <select required className="form-select" value={qLocation} onChange={e => setQLocation(e.target.value)}>
                    <option value="">-- Select Location --</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Quantity Damaged</label>
                  <input required type="number" step="0.01" className="form-input" value={qQuantity} onChange={e => setQQuantity(e.target.value)} />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Vendor (Optional)</label>
                  <select className="form-select" value={qVendor} onChange={e => setQVendor(e.target.value)}>
                    <option value="">-- None --</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Reason</label>
                  <input required className="form-input" value={qDescription} onChange={e => setQDescription(e.target.value)} placeholder="e.g. Expired" />
                </div>
                
                <button type="submit" className="btn" style={{ width: '100%', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#b45309', fontWeight: 'bold' }} disabled={qLoading}>
                  Quarantine Stock
                </button>
              </form>
            </div>

            {/* Right Pane: Grid */}
            <div className="glass-panel" style={{ flex: '1', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              <div className="desktop-section-title">Action Required: Quarantined Stock</div>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '24px' }} className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Pending Qty</th>
                      <th>Status</th>
                      <th>Resolve Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {damagedItems.filter(i => i.status === 'QUARANTINED').map(item => (
                      <tr key={item.id}>
                        <td>{item.product?.productName}<br/><span style={{ fontSize:'10px', color:'#666' }}>{item.description}</span></td>
                        <td>{item.quantity}</td>
                        <td>
                          <span style={{ 
                            fontSize: '11px', 
                            background: '#fef3c7', 
                            color: '#b45309', 
                            padding: '2px 6px', 
                            border: '1px solid currentColor'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn" style={{ padding: '4px' }} title="Return to Vendor" onClick={() => openResolveModal(item, 'RETURNED')}>
                              <RotateCcw size={14} />
                            </button>
                            <button className="btn" style={{ padding: '4px', color: '#16a34a' }} title="Scrap Sale" onClick={() => openResolveModal(item, 'SCRAP_SALE')}>
                              <DollarSign size={14} />
                            </button>
                            <button className="btn" style={{ padding: '4px', color: '#dc2626' }} title="Write-Off (Destroy)" onClick={() => openResolveModal(item, 'WRITTEN_OFF')}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {damagedItems.filter(i => i.status === 'QUARANTINED').length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No pending quarantined stock</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="desktop-section-title">Resolution History</div>
              <div style={{ flex: 1, overflowY: 'auto' }} className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Resolved Qty</th>
                      <th>Resolution</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {damagedItems.filter(i => i.status !== 'QUARANTINED').map(item => (
                      <tr key={item.id} style={{ opacity: 0.7 }}>
                        <td>{item.product?.productName}<br/><span style={{ fontSize:'10px', color:'#666' }}>{item.description}</span></td>
                        <td>{item.quantity}</td>
                        <td>
                          <span style={{ 
                            fontSize: '11px', 
                            background: '#e0f2fe', 
                            color: '#0369a1', 
                            padding: '2px 6px', 
                            border: '1px solid currentColor'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <button className="btn" style={{ padding: '4px', color: '#f59e0b' }} title="Undo & Revert to Quarantined" onClick={() => handleRevert(item.id)}>
                            <Undo size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {damagedItems.filter(i => i.status !== 'QUARANTINED').length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No resolution history</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>

      {resolveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              Resolve Quarantined Stock
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Product: <strong>{resolveModal.productName}</strong><br/>
              Action: <strong>{resolveModal.status.replace('_', ' ')}</strong>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Quantity to Resolve (Max: {resolveModal.maxQty})</label>
              <input 
                type="number" 
                className="form-input" 
                value={resolveQty} 
                onChange={e => setResolveQty(e.target.value)} 
                min="0.01" 
                max={resolveModal.maxQty} 
                step="0.01"
              />
            </div>

            {resolveModal.status === 'SCRAP_SALE' && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Scrap Sale Amount (Rs.)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={resolvePrice} 
                  onChange={e => setResolvePrice(e.target.value)} 
                  min="0" 
                  step="0.01"
                  placeholder="e.g. 50.00"
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setResolveModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitResolve}>Confirm Resolution</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsAndDamages;
