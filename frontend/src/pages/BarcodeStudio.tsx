import React, { useState, useRef, useEffect } from 'react';
import { Printer, Settings2, Search, Trash2, Plus, ShoppingCart } from 'lucide-react';
import BarcodePrintLayout, { type PrintItem } from '../components/BarcodePrintLayout';
import { useInventory } from '../context/InventoryContext';

const BarcodeStudio: React.FC = () => {
  const { products, refreshInventory } = useInventory();
  const printRef = useRef<HTMLDivElement>(null);

  const [activeMode, setActiveMode] = useState<'GENERATE' | 'PRINT_EXISTING'>('GENERATE');
  const [printQueue, setPrintQueue] = useState<PrintItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [genData, setGenData] = useState({
    productName: '',
    categoryId: '',
    companyId: '',
    salePrice: '',
    costPrice: '',
    quantityToGenerate: '10',
    labelsPerProduct: '1'
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  // Print Existing Mode State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [labelQty, setLabelQty] = useState('1');
  
  // Per-row quantity tracking for the search results table
  const [rowQuantities, setRowQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/master-data');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        setCompanies(data.companies);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setGenData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genData.productName || !genData.quantityToGenerate) return;
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/products/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genData)
      });
      
      if (res.ok) {
        const newProducts = await res.json();
        const labelsQty = parseInt(genData.labelsPerProduct) || 1;
        const newPrintItems: PrintItem[] = newProducts.map((p: any) => ({
          barcodeString: p.barCode,
          productName: p.productName,
          price: p.salePrice,
          printQuantity: labelsQty
        }));
        setPrintQueue(prev => [...prev, ...newPrintItems]);
        await refreshInventory();
        alert(`Successfully generated ${newProducts.length} barcodes! They are now in the print queue.`);
        setGenData({ ...genData, productName: '' });
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Add from the top dropdown selector
  const handleAddFromDropdown = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    const numQty = parseInt(labelQty) || 1;
    if (numQty <= 0) return;

    setPrintQueue(prev => [
      ...prev,
      {
        barcodeString: product.barCode || product.productCode,
        productName: product.productName,
        price: product.salePrice,
        printQuantity: numQty
      }
    ]);
    setSelectedProductId('');
    setLabelQty('1');
  };

  // Add from the search results table row
  const handleAddFromRow = (product: any) => {
    const numQty = parseInt(rowQuantities[product.id] || '1') || 1;
    if (numQty <= 0) return;

    setPrintQueue(prev => [
      ...prev,
      {
        barcodeString: product.barCode || product.productCode,
        productName: product.productName,
        price: product.salePrice,
        printQuantity: numQty
      }
    ]);
    // Reset the row qty back to 1
    setRowQuantities(prev => ({ ...prev, [product.id]: '1' }));
  };

  const removeFromQueue = (index: number) => {
    setPrintQueue(prev => prev.filter((_, i) => i !== index));
  };

  const executePrint = () => {
    const printContent = printRef.current;
    if (!printContent || printQueue.length === 0) return;

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  const filteredProducts = products.filter(p =>
    searchQuery.length === 0 ? true :
    p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barCode && p.barCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.productCode && p.productCode.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 50);

  const totalLabels = printQueue.reduce((acc, item) => acc + item.printQuantity, 0);

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">Bulk Barcode Studio</h1>
        <p className="page-subtitle">Mass generate unique barcodes or print sticker sheets for existing inventory.</p>
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button 
            className={`btn ${activeMode === 'GENERATE' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('GENERATE')}
          >
            <Settings2 size={16} /> Generate New Stock
          </button>
          <button 
            className={`btn ${activeMode === 'PRINT_EXISTING' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('PRINT_EXISTING')}
          >
            <Search size={16} /> Print Existing
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
        
        {/* Left Pane: Actions */}
        {activeMode === 'GENERATE' ? (
          <div className="glass-panel" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            <div className="desktop-section-title">Bulk Generate Barcodes</div>
            <form onSubmit={handleGenerate} className="desktop-form">
              <div className="form-group">
                <label className="desktop-label">Base Product Name</label>
                <input required name="productName" value={genData.productName} onChange={handleGenChange} className="desktop-input" placeholder="e.g. Master T-Shirt" />
              </div>
              
              <div className="form-group">
                <label className="desktop-label">Category</label>
                <select name="categoryId" value={genData.categoryId} onChange={handleGenChange} className="desktop-input">
                  <option value="">-- Select --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="desktop-label">Company</label>
                <select name="companyId" value={genData.companyId} onChange={handleGenChange} className="desktop-input">
                  <option value="">-- Select --</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="desktop-label">Cost Price</label>
                <input type="number" step="0.01" name="costPrice" value={genData.costPrice} onChange={handleGenChange} className="desktop-input" />
              </div>

              <div className="form-group">
                <label className="desktop-label">Sale Price</label>
                <input type="number" step="0.01" name="salePrice" value={genData.salePrice} onChange={handleGenChange} className="desktop-input" />
              </div>

              <div className="desktop-section-title" style={{ gridColumn: '1 / -1', marginTop: '16px' }}>Generation Settings</div>

              <div className="form-group">
                <label className="desktop-label">Unique Products to Generate</label>
                <input required type="number" name="quantityToGenerate" value={genData.quantityToGenerate} onChange={handleGenChange} className="desktop-input" style={{ fontWeight: 'bold' }} />
              </div>

              <div className="form-group">
                <label className="desktop-label">Labels to Print per Product</label>
                <input required type="number" name="labelsPerProduct" value={genData.labelsPerProduct} onChange={handleGenChange} className="desktop-input" style={{ fontWeight: 'bold' }} />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                  {loading ? 'Generating...' : `Generate ${genData.quantityToGenerate} Unique Barcodes`}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Quick Add Section — Dropdown + Quantity */}
            <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', padding: '12px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', color: '#0369a1' }}>
                <ShoppingCart size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Quick Add to Print Queue
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Select Product</label>
                  <select 
                    className="desktop-input" 
                    value={selectedProductId} 
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Choose a Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.productName} {p.barCode ? `(${p.barCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 0, minWidth: '80px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Labels</label>
                  <input 
                    type="number" 
                    min="1" 
                    className="desktop-input" 
                    value={labelQty} 
                    onChange={(e) => setLabelQty(e.target.value)} 
                    style={{ width: '100%', fontWeight: 'bold', textAlign: 'center' }}
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleAddFromDropdown}
                  disabled={!selectedProductId}
                  style={{ padding: '4px 16px', whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Search & Browse Section */}
            <div className="desktop-section-title">Or Search & Browse</div>
            <input 
              className="desktop-input" 
              placeholder="Type to filter by name, barcode, or code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: '8px' }}
            />
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th style={{ width: '70px' }}>Labels</th>
                    <th style={{ width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '11px' }}>{p.productName}</td>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{p.barCode}</td>
                      <td>
                        <input 
                          type="number" 
                          min="1"
                          className="desktop-input"
                          value={rowQuantities[p.id] || '1'}
                          onChange={(e) => setRowQuantities(prev => ({ ...prev, [p.id]: e.target.value }))}
                          style={{ width: '60px', textAlign: 'center', fontWeight: 'bold' }}
                        />
                      </td>
                      <td>
                        <button className="btn btn-primary" style={{ padding: '2px 8px' }} onClick={() => handleAddFromRow(p)}>
                          <Plus size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No products found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Right Pane: Print Queue */}
        <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="desktop-section-title" style={{ margin: 0 }}>Print Queue</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1' }}>Total Labels: {totalLabels}</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #cbd5e1', background: '#fff' }}>
            {printQueue.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>Queue is empty.</div>
                <div style={{ fontSize: '11px' }}>Select a product and specify the number of labels to print.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Product</th><th>Barcode</th><th>Print Qty</th><th></th></tr></thead>
                <tbody>
                  {printQueue.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '11px' }}>{item.productName}</td>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{item.barcodeString}</td>
                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>{item.printQuantity}</td>
                      <td>
                        <button onClick={() => removeFromQueue(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '16px', marginTop: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: printQueue.length > 0 ? '#10b981' : '#cbd5e1', borderColor: printQueue.length > 0 ? '#059669' : '#cbd5e1' }}
            disabled={printQueue.length === 0}
            onClick={executePrint}
          >
            <Printer size={20} /> Print All Barcodes ({totalLabels} labels)
          </button>
        </div>

      </div>

      <BarcodePrintLayout printQueue={printQueue} ref={printRef} />
    </div>
  );
};

export default BarcodeStudio;
