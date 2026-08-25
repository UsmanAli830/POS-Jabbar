import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, Minus, Save, RefreshCw, Search } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

type Location = { id: number; name: string };
type StockItem = { id: number; productCode: string; productName: string; salePrice: number; stock: number };

const InventoryControl: React.FC = () => {
  const { refreshInventory } = useInventory();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [stockList, setStockList] = useState<StockItem[]>([]);
  
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [referenceNotes, setReferenceNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [targetLedger, setTargetLedger] = useState<'SELLABLE' | 'DAMAGED'>('SELLABLE');

  useEffect(() => {
    if (selectedProduct) {
      setProductSearchText(`[${selectedProduct.productCode}] - ${selectedProduct.productName}`);
    } else {
      setProductSearchText('');
    }
  }, [selectedProduct]);

  const filteredStock = useMemo(() => {
    if (!searchQuery) return stockList;
    const q = searchQuery.toLowerCase();
    return stockList.filter(item => 
      item.productName.toLowerCase().includes(q) || 
      item.productCode.toLowerCase().includes(q)
    );
  }, [stockList, searchQuery]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      fetchStock(selectedLocationId);
    } else {
      setStockList([]);
    }
    setSelectedProduct(null);
  }, [selectedLocationId]);

  const fetchLocations = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/master-data');
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
        if (data.locations && data.locations.length > 0) {
          setSelectedLocationId(data.locations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch locations', err);
    }
  };

  const fetchStock = async (locationId: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/inventory/stock/${locationId}`);
      if (res.ok) {
        const data = await res.json();
        setStockList(data);
      }
    } catch (err) {
      console.error('Failed to fetch stock list', err);
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedLocationId || adjustmentQty === 0) {
      alert('Please select a product and enter a non-zero quantity.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          locationId: selectedLocationId,
          quantity: adjustmentQty,
          referenceNotes,
          targetLedger
        })
      });

      if (res.ok) {
        alert('Stock adjusted successfully!');
        setAdjustmentQty(0);
        setReferenceNotes('');
        fetchStock(selectedLocationId as number);
        refreshInventory();
      } else {
        const err = await res.json();
        alert('Error adjusting stock: ' + (err.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Adjustment failed', err);
      alert('Adjustment failed. See console.');
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Inventory Control</h1>
          <p className="page-subtitle">Track multi-location stock movements and make real-time adjustments.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Active Warehouse:</label>
          <select 
            className="form-select" 
            style={{ width: '250px', background: 'rgba(15,23,42,0.8)' }}
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(Number(e.target.value))}
          >
            {locations.length === 0 && <option value="">Loading locations...</option>}
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Stock Data Grid */}
        <div className="glass-panel" style={{ flex: '1', overflowY: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Current Stock Level</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '32px', width: '100%', height: '32px', fontSize: '13px' }}
                />
              </div>
              {selectedLocationId && (
                <button className="btn" onClick={() => fetchStock(selectedLocationId as number)} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', height: '32px' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
              )}
            </div>
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th>Price</th>
                  <th>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.5 }}>No products found</td></tr>
                ) : (
                  filteredStock.map(item => (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedProduct(item)}
                      style={{ background: selectedProduct?.id === item.id ? 'rgba(59, 130, 246, 0.15)' : '' }}
                    >
                      <td>{item.productCode}</td>
                      <td style={{ fontWeight: 600 }}>{item.productName}</td>
                      <td>Rs. {item.salePrice.toLocaleString()}</td>
                      <td>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: item.stock < 0 ? '#ef4444' : (item.stock > 0 ? '#22c55e' : 'inherit')
                        }}>
                          {item.stock}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane: Adjustment Panel */}
        <div className="glass-panel" style={{ width: '380px', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '24px', fontSize: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Settings size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Stock Adjustment
          </div>
          
          <form onSubmit={handleAdjustmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Search & Select Product</label>
              <input 
                type="text" 
                className="form-input" 
                list="product-search-list" 
                placeholder="Search by code or name..." 
                value={productSearchText}
                onChange={(e) => {
                  const val = e.target.value;
                  setProductSearchText(val);
                  const match = stockList.find(p => `[${p.productCode}] - ${p.productName}` === val);
                  if (match) {
                    setSelectedProduct(match);
                  } else {
                    setSelectedProduct(null);
                  }
                }}
                required
              />
              <datalist id="product-search-list">
                {stockList.map(item => (
                  <option key={item.id} value={`[${item.productCode}] - ${item.productName}`} />
                ))}
              </datalist>
            </div>
            
            <div className="form-group">
              <label className="form-label">Inventory Target</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="targetLedger" 
                    value="SELLABLE" 
                    checked={targetLedger === 'SELLABLE'} 
                    onChange={() => setTargetLedger('SELLABLE')}
                    disabled={!selectedProduct}
                  /> 
                  Sellable Stock
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="targetLedger" 
                    value="DAMAGED" 
                    checked={targetLedger === 'DAMAGED'} 
                    onChange={() => setTargetLedger('DAMAGED')}
                    disabled={!selectedProduct}
                  /> 
                  Damaged / Quarantined Stock
                </label>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Adjustment Quantity</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }} onClick={() => setAdjustmentQty(qty => qty - 1)} disabled={!selectedProduct}>
                  <Minus size={18} />
                </button>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }} 
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                  disabled={!selectedProduct}
                />
                <button type="button" className="btn" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }} onClick={() => setAdjustmentQty(qty => qty + 1)} disabled={!selectedProduct}>
                  <Plus size={18} />
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Use positive numbers to add stock, negative to reduce.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reference / Remarks</label>
              <select 
                className="form-select" 
                style={{ width: '100%' }}
                value={referenceNotes}
                onChange={(e) => setReferenceNotes(e.target.value)}
                required
                disabled={!selectedProduct}
              >
                <option value="">-- Select Reason --</option>
                <option value="New Shipment">New Shipment</option>
                <option value="Damaged Goods">Damaged Goods</option>
                <option value="Loss / Theft">Loss / Theft</option>
                <option value="Audit / Reconciliation">Audit / Reconciliation</option>
                <option value="Internal Use">Internal Use</option>
                <option value="Expiration">Expiration</option>
              </select>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={!selectedProduct}>
                <Save size={18} /> Apply Adjustment
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default InventoryControl;
