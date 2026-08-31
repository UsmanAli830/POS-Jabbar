import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, Minus, Save, RefreshCw, Search, PackageCheck } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';

type Location = { id: number; name: string };
type StockItem = { id: number; productCode: string; productName: string; salePrice: number; costPrice?: number; stock: number; categoryName?: string };

const InventoryControl: React.FC = () => {
  const { products: contextProducts, refreshInventory } = useInventory();
  const { token } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | 'ALL'>('ALL');
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [referenceNotes, setReferenceNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [targetLedger, setTargetLedger] = useState<'SELLABLE' | 'DAMAGED'>('SELLABLE');

  useEffect(() => {
    if (selectedProduct) {
      setProductSearchText(`[${selectedProduct.productCode || 'NO-CODE'}] - ${selectedProduct.productName}`);
    } else {
      setProductSearchText('');
    }
  }, [selectedProduct]);

  const filteredStock = useMemo(() => {
    if (!searchQuery) return stockList;
    const q = searchQuery.toLowerCase();
    return stockList.filter(item => 
      (item.productName && item.productName.toLowerCase().includes(q)) || 
      (item.productCode && item.productCode.toLowerCase().includes(q))
    );
  }, [stockList, searchQuery]);

  const fetchStock = async (locationId: number | 'ALL' = selectedLocationId) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const url = locationId === 'ALL' || !locationId
        ? `http://localhost:3000/api/inventory?t=${Date.now()}`
        : `http://localhost:3000/api/inventory/stock/${locationId}?t=${Date.now()}`;
        
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setStockList(data);
      }
    } catch (err) {
      console.error('Failed to fetch stock list', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('http://localhost:3000/api/master-data', { headers });
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
      }
    } catch (err) {
      console.error('Failed to fetch locations', err);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchStock('ALL');
  }, [token]);

  useEffect(() => {
    fetchStock(selectedLocationId);
    setSelectedProduct(null);
  }, [selectedLocationId]);

  // Sync when global inventory updates
  useEffect(() => {
    if (contextProducts && contextProducts.length > 0 && selectedLocationId === 'ALL') {
      const mapped = contextProducts.map(p => ({
        id: p.id,
        productCode: p.productCode || '',
        productName: p.productName,
        salePrice: p.retailPrice ?? p.salePrice ?? 0,
        costPrice: p.costPrice ?? 0,
        stock: p.currentStock ?? 0,
        categoryName: p.pCat?.name || 'General'
      }));
      setStockList(mapped);
    }
  }, [contextProducts]);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || adjustmentQty === 0) {
      alert('Please select a product and enter a non-zero quantity.');
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('http://localhost:3000/api/inventory/adjust', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: selectedProduct.id,
          locationId: selectedLocationId === 'ALL' ? (locations[0]?.id || 1) : selectedLocationId,
          quantity: adjustmentQty,
          referenceNotes,
          targetLedger
        })
      });

      if (res.ok) {
        alert('Stock adjusted successfully!');
        setAdjustmentQty(0);
        setReferenceNotes('');
        await fetchStock(selectedLocationId);
        await refreshInventory();
      } else {
        const err = await res.json();
        alert('Error adjusting stock: ' + (err.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Adjustment failed', err);
      alert('Adjustment failed. See console.');
    }
  };

  const totalValuation = useMemo(() => {
    return filteredStock.reduce((acc, item) => {
      const stock = item.stock || 0;
      const cost = item.costPrice || 0;
      return acc + (stock * cost);
    }, 0);
  }, [filteredStock]);

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-heading-banner">
        <div>
          <h1 className="page-heading-title">
            <PackageCheck size={22} className="text-blue-600" /> Inventory Control
          </h1>
          <p className="page-heading-desc">Real-time stock monitoring, multi-location visibility, and instant inventory adjustments.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ color: '#475569', fontWeight: 600, fontSize: '13px' }}>Location / Warehouse:</label>
          <select 
            className="form-select" 
            style={{ width: '220px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
          >
            <option value="ALL">🏢 All Store / Main Stock</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
            ))}
          </select>
          <button 
            onClick={() => fetchStock(selectedLocationId)} 
            disabled={loading}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 14px', 
              borderRadius: '6px', 
              border: '1px solid #cbd5e1', 
              background: '#fff', 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      
      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Stock Data Grid */}
        <div className="glass-panel" style={{ flex: '1', overflowY: 'auto', padding: '16px' }}>
          
          {/* Prominent Inventory Valuation Header Card */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            borderRadius: '10px',
            padding: '14px 20px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
            border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PackageCheck size={22} color="#38bdf8" />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Total Inventory Valuation
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Aggregated sum of (Current Stock × Cost Price) for filtered items
                </div>
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.5px' }}>
              Rs. {totalValuation.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

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
                  <th>Sale Price</th>
                  <th>Cost Price</th>
                  <th>Current Stock</th>
                  <th>Total Cost Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No products found</td></tr>
                ) : (
                  filteredStock.map(item => {
                    const rowValuation = (item.stock || 0) * (item.costPrice || 0);
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedProduct(item)}
                        style={{ background: selectedProduct?.id === item.id ? 'rgba(59, 130, 246, 0.15)' : '' }}
                      >
                        <td>{item.productCode}</td>
                        <td style={{ fontWeight: 600 }}>{item.productName}</td>
                        <td>Rs. {item.salePrice.toLocaleString()}</td>
                        <td>Rs. {(item.costPrice || 0).toLocaleString()}</td>
                        <td>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: item.stock < 0 ? '#ef4444' : (item.stock > 0 ? '#22c55e' : 'inherit')
                          }}>
                            {item.stock}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: rowValuation < 0 ? '#ef4444' : '#0f172a' }}>
                          Rs. {rowValuation.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
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
