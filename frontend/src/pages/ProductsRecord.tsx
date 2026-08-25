import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import BarcodeGenerator from '../components/BarcodeGenerator';
import { List, Barcode as BarcodeIcon, Search, Maximize2, Minimize2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

const ProductsRecord: React.FC = () => {
  const { refreshInventory } = useInventory();
  const [products, setProducts] = useState<any[]>([]);
  const [pCats, setPCats] = useState<any[]>([]);
  const [subCats, setSubCats] = useState<any[]>([]);
  const [pTypes, setPTypes] = useState<any[]>([]);
  const [weightUnits, setWeightUnits] = useState<any[]>([]);
  const [activeTypes, setActiveTypes] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [formulas, setFormulas] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    productCode: '',
    barCode: '',
    productName: '',
    retailPrice: '',
    costPrice: '',
    currentStock: '',
    minLevel: '',
    pCatId: '',
    subCatId: '',
    pTypeId: '',
    weightUnitId: '',
    formulaId: '',
    companyId: '',
    activeTypeId: ''
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'category' | 'company' | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [formMode, setFormMode] = useState<'CREATE' | 'VIEW' | 'EDIT'>('CREATE');
  
  const [activeRightTab, setActiveRightTab] = useState<'LIST' | 'BARCODE' | 'BULK_UPDATE'>('LIST');
  const [selectedProductData, setSelectedProductData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPane, setExpandedPane] = useState<'NONE' | 'FORM' | 'GRID'>('NONE');
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [selectedRowsData, setSelectedRowsData] = useState<any[]>([]);

  const toggleFormExpand = () => setExpandedPane(prev => prev === 'FORM' ? 'NONE' : 'FORM');
  const toggleGridExpand = () => setExpandedPane(prev => prev === 'GRID' ? 'NONE' : 'GRID');

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      (p.productName && p.productName.toLowerCase().includes(q)) ||
      (p.productCode && p.productCode.toLowerCase().includes(q)) ||
      (p.barCode && p.barCode.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  useEffect(() => {
    fetchMasterData();
    fetchFormulas();
    fetchProducts();
  }, []);

  // Global Barcode Scanner Listener
  useEffect(() => {
    let buffer = '';
    let lastTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      if (currentTime - lastTime > 50) {
        buffer = '';
      }
      
      if (e.key === 'Enter' && buffer.length > 3) {
        const scannedCode = buffer;
        const matchedProduct = products.find(p => p.barCode === scannedCode || p.productCode === scannedCode);
        
        if (matchedProduct) {
          e.preventDefault();
          
          setEditingId(matchedProduct.id);
          setFormMode('VIEW');
          setSelectedProductData(matchedProduct);
          setFormData({
            productCode: matchedProduct.productCode || '',
            barCode: matchedProduct.barCode || '',
            productName: matchedProduct.productName || '',
            retailPrice: matchedProduct.retailPrice?.toString() || '',
            costPrice: matchedProduct.costPrice?.toString() || '',
            currentStock: matchedProduct.currentStock?.toString() || '',
            minLevel: matchedProduct.minLevel?.toString() || '',
            pCatId: matchedProduct.pCatId?.toString() || '',
            subCatId: matchedProduct.subCatId?.toString() || '',
            pTypeId: matchedProduct.pTypeId?.toString() || '',
            weightUnitId: matchedProduct.weightUnitId?.toString() || '',
            formulaId: matchedProduct.formulaId?.toString() || '',
            companyId: matchedProduct.companyId?.toString() || '',
            activeTypeId: matchedProduct.activeTypeId?.toString() || ''
          });
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
      lastTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const fetchFormulas = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/formulas');
      if (res.ok) setFormulas(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMasterData = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/master-data');
      if (res.ok) {
        const data = await res.json();
        setPCats(data.pCats || []);
        setSubCats(data.newSubCats || []);
        setPTypes(data.pTypes || []);
        setWeightUnits(data.weightUnits || []);
        setActiveTypes(data.activeTypes || []);
        setCompanies(data.companies || []);
      }
    } catch (e) {
      console.error('Failed to fetch master data', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/products?t=${Date.now()}`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        retailPrice: parseFloat(formData.retailPrice as string) || 0,
        costPrice: parseFloat(formData.costPrice as string) || 0,
        currentStock: parseFloat(formData.currentStock as string) || 0,
        minLevel: parseFloat(formData.minLevel as string) || 0,
        pCatId: formData.pCatId ? parseInt(formData.pCatId as string) : null,
        subCatId: formData.subCatId ? parseInt(formData.subCatId as string) : null,
        pTypeId: formData.pTypeId ? parseInt(formData.pTypeId as string) : null,
        weightUnitId: formData.weightUnitId ? parseInt(formData.weightUnitId as string) : null,
        activeTypeId: formData.activeTypeId ? parseInt(formData.activeTypeId as string) : null,
        companyId: formData.companyId ? parseInt(formData.companyId as string) : null,
        formulaId: formData.formulaId ? parseInt(formData.formulaId as string) : null
      };

      const url = editingId ? `http://localhost:3000/api/products/${editingId}` : 'http://localhost:3000/api/products';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert(`Product ${editingId ? 'Updated' : 'Saved'} successfully!`);
        fetchProducts();
        refreshInventory();
        setFormData({
          productCode: '', barCode: '', productName: '',
          retailPrice: '', costPrice: '', currentStock: '', minLevel: '',
          pCatId: '', subCatId: '', pTypeId: '', weightUnitId: '', formulaId: '', companyId: '', activeTypeId: ''
        });
        setEditingId(null);
        setFormMode('CREATE');
      } else {
        const err = await res.json();
        alert('SQL Reject: ' + err.error + '\nDetails: ' + JSON.stringify(err.details));
      }
    } catch (e) {
      alert('Network error while saving');
    }
  };

  const handleCreateMaster = async () => {
    if (!modalValue || !modalType) return;
    try {
      const res = await fetch('http://localhost:3000/api/master-data-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: modalType, name: modalValue })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMasterData(); // Refresh dropdowns
        setFormData(prev => ({ ...prev, [modalType === 'category' ? 'pCatId' : 'companyId']: data.id.toString() }));
        setModalType(null);
        setModalValue('');
      } else {
        alert('Failed to create master data');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const handleExcelSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        alert('File seems empty or missing headers.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      if (!headers.includes('productName')) {
        alert('Error: Your CSV must contain a header named exactly "productName".');
        e.target.value = '';
        return;
      }

      const productsToUpload = [];
      let skippedRows = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const productObj: any = {};
        headers.forEach((header, index) => {
          if (values[index] !== undefined && values[index] !== '') {
            productObj[header] = values[index];
          }
        });
        
        if (productObj.productName) {
          productsToUpload.push(productObj);
        } else {
          skippedRows++;
        }
      }

      if (productsToUpload.length === 0) {
        alert(`No valid products found to upload. Skipped ${skippedRows} rows.`);
        e.target.value = '';
        return;
      }

      try {
        const res = await fetch('http://localhost:3000/api/products/bulk-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: productsToUpload })
        });
        if (res.ok) {
          const result = await res.json();
          alert(`Successfully synced ${result.createdCount} products from CSV!${skippedRows > 0 ? ` (Skipped ${skippedRows} rows without names)` : ''}`);
          fetchProducts();
          refreshInventory();
        } else {
          const err = await res.json();
          alert('Failed to sync: ' + err.error);
        }
      } catch (e) {
        alert('Network error during sync');
      }
      
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // AG Grid Config
  const [colDefs] = useState<any[]>([
    { headerCheckboxSelection: true, checkboxSelection: true, width: 45, pinned: 'left' },
    { field: 'productCode', headerName: 'Product Code', width: 120 },
    { field: 'barCode', headerName: 'Barcode', width: 140 },
    { field: 'productName', headerName: 'Product Name', width: 220, flex: 1 },
    { field: 'currentStock', headerName: 'Stock Qty', width: 100, cellStyle: { textAlign: 'right' } },
    { field: 'minLevel', headerName: 'Min Level', width: 95, cellStyle: { textAlign: 'right' } },
    { 
      field: 'costPrice', 
      headerName: 'Cost Price', 
      width: 120, 
      cellStyle: { textAlign: 'right' },
      valueFormatter: (params: any) => `Rs. ${(Number(params.value) || 0).toLocaleString()}` 
    },
    { 
      field: 'retailPrice', 
      headerName: 'Retail Price', 
      width: 120, 
      cellStyle: { textAlign: 'right' },
      valueFormatter: (params: any) => `Rs. ${(Number(params.value) || 0).toLocaleString()}` 
    },
    { 
      field: 'totalValue', 
      headerName: 'Total Value', 
      width: 130, 
      cellStyle: { textAlign: 'right', fontWeight: 'bold' },
      valueGetter: (params: any) => (Number(params.data?.currentStock) || 0) * (Number(params.data?.costPrice) || 0), 
      valueFormatter: (params: any) => `Rs. ${(params.value || 0).toLocaleString()}` 
    }
  ]);

  const defaultColDef = useMemo(() => {
    return {
      sortable: true,
      filter: true,
      resizable: true,
    };
  }, []);

  const onRowClicked = useCallback((params: any) => {
    setSelectedProductData(params.data);
    const pd = params.data;
    setEditingId(pd.id);
    setFormMode('VIEW');
    setFormData({
      productCode: pd.productCode || '',
      barCode: pd.barCode || '',
      productName: pd.productName || '',
      retailPrice: pd.retailPrice?.toString() || '',
      costPrice: pd.costPrice?.toString() || '',
      currentStock: pd.currentStock?.toString() || '',
      minLevel: pd.minLevel?.toString() || '',
      pCatId: pd.pCatId?.toString() || '',
      subCatId: pd.subCatId?.toString() || '',
      pTypeId: pd.pTypeId?.toString() || '',
      weightUnitId: pd.weightUnitId?.toString() || '',
      formulaId: pd.formulaId?.toString() || '',
      companyId: pd.companyId?.toString() || '',
      activeTypeId: pd.activeTypeId?.toString() || ''
    });
  }, []);

  const onSelectionChanged = useCallback((event: any) => {
    const selectedRows = event.api.getSelectedRows();
    setSelectedRowIds(selectedRows.map((r: any) => r.id));
    setSelectedRowsData(selectedRows);
  }, []);

  const handleDeleteSelected = async () => {
    if (selectedRowIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedRowIds.length} products?`)) return;

    try {
      const res = await fetch('http://localhost:3000/api/products/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRowIds })
      });
      if (res.ok) {
        alert('Products deleted successfully!');
        setSelectedRowIds([]);
        fetchProducts();
        refreshInventory();
      } else {
        const err = await res.json();
        alert('Failed to delete: ' + err.error);
      }
    } catch (e) {
      alert('Network error during deletion');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', height: '100%', position: 'relative' }}>
      
      {/* Inline Creation Modal */}
      {modalType && (
        <div style={{ position: 'absolute', top: '20px', left: '20px', background: '#e2e8f0', border: '1px solid #94a3b8', padding: '12px', zIndex: 100, boxShadow: '2px 2px 5px rgba(0,0,0,0.2)' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Create New {modalType === 'category' ? 'Category' : 'Company'}</div>
          <input 
            className="desktop-input" 
            autoFocus 
            value={modalValue} 
            onChange={e => setModalValue(e.target.value)} 
            placeholder="Enter Name..."
            style={{ marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setModalType(null); setModalValue(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateMaster}>Save</button>
          </div>
        </div>
      )}

      {/* Left Pane: Data Entry */}
      <div className="glass-panel" style={{ width: expandedPane === 'FORM' ? '100%' : '400px', display: expandedPane === 'GRID' ? 'none' : 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#cbd5e1', padding: '4px 8px', fontWeight: 'bold', borderBottom: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Products Entry Panel</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {formMode === 'EDIT' ? (
              <button onClick={() => {
                setFormMode('VIEW');
                if (selectedProductData) {
                  const pd = selectedProductData;
                  setFormData({
                    productCode: pd.productCode || '',
                    barCode: pd.barCode || '',
                    productName: pd.productName || '',
                    retailPrice: pd.retailPrice?.toString() || '',
                    costPrice: pd.costPrice?.toString() || '',
                    currentStock: pd.currentStock?.toString() || '',
                    minLevel: pd.minLevel?.toString() || '',
                    pCatId: pd.pCatId?.toString() || '',
                    subCatId: pd.subCatId?.toString() || '',
                    pTypeId: pd.pTypeId?.toString() || '',
                    weightUnitId: pd.weightUnitId?.toString() || '',
                    formulaId: pd.formulaId?.toString() || '',
                    companyId: pd.companyId?.toString() || '',
                    activeTypeId: pd.activeTypeId?.toString() || ''
                  });
                }
              }} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            ) : (
              <button onClick={() => {
                setEditingId(null);
                setFormMode('CREATE');
                setSelectedProductData(null);
                setFormData({
                  productCode: '', barCode: '', productName: '',
                  retailPrice: '', costPrice: '', currentStock: '', minLevel: '',
                  pCatId: '', subCatId: '', pTypeId: '', weightUnitId: '', formulaId: '', companyId: '', activeTypeId: ''
                });
              }} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Clear</button>
            )}

            {formMode === 'VIEW' ? (
              <button className="btn-primary" style={{ fontSize: '12px', padding: '4px 8px', fontWeight: 'bold' }} onClick={() => setFormMode('EDIT')}>
                Edit
              </button>
            ) : (
              <button className="btn-primary" style={{ fontSize: '12px', padding: '4px 8px', fontWeight: 'bold' }} onClick={handleSave}>
                {formMode === 'EDIT' ? 'Update' : 'Save'}
              </button>
            )}
            <button onClick={toggleFormExpand} style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', marginLeft: '4px' }} title={expandedPane === 'FORM' ? "Compress" : "Expand"}>
              {expandedPane === 'FORM' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
        
        <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
          <div className="desktop-form">
            <div className="desktop-section-title">Basic Info</div>
            <div className="form-group">
              <label className="desktop-label">Product Code</label>
              <input name="productCode" value={formData.productCode} onChange={handleChange} className="desktop-input" autoFocus disabled={formMode === 'VIEW'} />
            </div>

            <div className="form-group">
              <label className="desktop-label">Barcode</label>
              <input name="barCode" value={formData.barCode} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'} />
            </div>

            <div className="form-group">
              <label className="desktop-label">Product Name</label>
              <input name="productName" value={formData.productName} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'} />
            </div>
            
            <div className="desktop-section-title">Classification</div>
            
            <div className="form-group">
              <label className="desktop-label">PCat (Category)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select name="pCatId" value={formData.pCatId} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'}>
                  <option value="">-- Select --</option>
                  {pCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => { setModalType('category'); setModalValue(''); }} disabled={formMode === 'VIEW'}>+</button>
              </div>
            </div>

            <div className="form-group">
              <label className="desktop-label">SubCat</label>
              <select name="subCatId" value={formData.subCatId} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'}>
                <option value="">-- Select --</option>
                {subCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="desktop-label">Company</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select name="companyId" value={formData.companyId} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'}>
                  <option value="">-- Select --</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => { setModalType('company'); setModalValue(''); }} disabled={formMode === 'VIEW'}>+</button>
              </div>
            </div>
            
            <div className="form-group">
              <label className="desktop-label">PType (Product Type)</label>
              <select name="pTypeId" value={formData.pTypeId} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'}>
                <option value="">-- Select --</option>
                {pTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="desktop-section-title">Attributes & Pricing</div>

            <div className="form-group">
              <label className="desktop-label">Weight Unit</label>
              <select name="weightUnitId" value={formData.weightUnitId} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'}>
                <option value="">-- Select --</option>
                {weightUnits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="desktop-label">Active Type</label>
              <select name="activeTypeId" value={formData.activeTypeId} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'}>
                <option value="">-- Select --</option>
                {activeTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="desktop-label">Cost Price</label>
              <input name="costPrice" type="number" step="0.01" value={formData.costPrice} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'} />
            </div>

            <div className="form-group">
              <label className="desktop-label">Retail Price</label>
              <input name="retailPrice" type="number" step="0.01" value={formData.retailPrice} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'} />
            </div>

            <div className="desktop-section-title">Inventory Setup</div>

            <div className="form-group">
              <label className="desktop-label">Current Stock</label>
              <input name="currentStock" type="number" value={formData.currentStock} onChange={handleChange} className="desktop-input" disabled={formMode !== 'CREATE'} />
              {formMode !== 'CREATE' && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Cannot manually edit existing stock here</div>}
            </div>

            <div className="form-group">
              <label className="desktop-label">Min Level</label>
              <input name="minLevel" type="number" value={formData.minLevel} onChange={handleChange} className="desktop-input" disabled={formMode === 'VIEW'} />
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Grid & Barcode */}
      <div className="glass-panel" style={{ flex: expandedPane === 'FORM' ? 0 : 1, display: expandedPane === 'FORM' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0' }}>
        
        <div style={{ display: 'flex', background: '#cbd5e1', borderBottom: '1px solid #94a3b8', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            <button 
              className="btn" 
              style={{ background: activeRightTab === 'LIST' ? '#fff' : 'transparent', border: 'none', borderRight: '1px solid #94a3b8', padding: '8px 16px', fontWeight: activeRightTab === 'LIST' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveRightTab('LIST')}
            >
              <List size={16} /> Product List
            </button>
            <button 
              className="btn" 
              style={{ background: activeRightTab === 'BARCODE' ? '#fff' : 'transparent', border: 'none', borderRight: '1px solid #94a3b8', padding: '8px 16px', fontWeight: activeRightTab === 'BARCODE' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveRightTab('BARCODE')}
            >
              <BarcodeIcon size={16} /> Barcode Image
            </button>
            <button 
              className="btn" 
              style={{ background: activeRightTab === 'BULK_UPDATE' ? '#fff' : 'transparent', border: 'none', padding: '8px 16px', fontWeight: activeRightTab === 'BULK_UPDATE' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveRightTab('BULK_UPDATE')}
            >
              Bulk Updates
            </button>
          </div>
          <button onClick={toggleGridExpand} style={{ background: 'transparent', border: 'none', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={expandedPane === 'GRID' ? "Compress" : "Expand"}>
            {expandedPane === 'GRID' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {activeRightTab === 'LIST' && (
            <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      placeholder="Search products by code, name..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '6px 12px 6px 32px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
                    />
                  </div>
                  {selectedRowIds.length > 0 && (
                    <button onClick={handleDeleteSelected} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Delete Selected ({selectedRowIds.length})
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', background: '#e2e8f0', padding: '4px 12px', borderRadius: '4px', display: 'flex', gap: '16px' }}>
                  <span>Total Stock: {filteredProducts.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0).toLocaleString()} pcs</span>
                  <span>Grand Total Val: Rs. {filteredProducts.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.costPrice) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {selectedRowIds.length > 0 && (
                    <span style={{ color: '#0369a1' }}>
                      Selected Value: Rs. {selectedRowsData.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.costPrice) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
              <div className="ag-theme-alpine" style={{ flex: 1, width: '100%' }}>
                <AgGridReact
                  rowData={filteredProducts}
                  columnDefs={colDefs}
                  defaultColDef={defaultColDef}
                  onRowClicked={onRowClicked}
                  rowSelection="multiple"
                  onSelectionChanged={onSelectionChanged}
                  animateRows={true}
                  suppressRowClickSelection={true}
                  getRowId={(params) => String(params.data.id)}
                />
              </div>
          </div>
          )}

          {activeRightTab === 'BARCODE' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <BarcodeGenerator 
                  selectedProduct={selectedProductData}
                  allProducts={products}
                  onSelectProduct={setSelectedProductData}
                />
              </div>
            </div>
          )}

          {activeRightTab === 'BULK_UPDATE' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
               <div style={{ color: '#64748b', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '8px' }}>Bulk Update Module</h3>
                  <p style={{ marginBottom: '16px' }}>Upload a CSV file containing your product records.</p>
                  <p style={{ fontSize: '12px', marginBottom: '24px', opacity: 0.8 }}>
                    Headers should match standard fields like: <br/>
                    <code>productCode, barCode, productName, costPrice, retailPrice, currentStock</code>
                  </p>
                  
                  <label className="btn-primary" style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer', borderRadius: '4px', display: 'inline-block' }}>
                    Sync from CSV
                    <input 
                      type="file" 
                      accept=".csv" 
                      style={{ display: 'none' }} 
                      onChange={handleExcelSync}
                    />
                  </label>
               </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProductsRecord;
