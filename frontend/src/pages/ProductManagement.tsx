import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import BarcodeGenerator from '../components/BarcodeGenerator';
import { List, Barcode as BarcodeIcon, Search, Maximize2, Minimize2, Package, Tag, Layers, PackagePlus, Plus } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

import { useAuth } from '../context/AuthContext';

const ProductManagement: React.FC = () => {
  const { refreshInventory } = useInventory();
  const { token } = useAuth();
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
    wholeSalePrice: '',
    tradePrice: '',
    costPrice: '',
    currentStock: '',
    minLevel: '',
    dangerLevel: '',
    pCatId: '',
    subCatId: '',
    pTypeId: '',
    weightUnitId: '',
    formulaId: '',
    companyId: '',
    activeTypeId: ''
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<'DISABLED' | 'CREATE' | 'VIEW' | 'EDIT'>('DISABLED');
  const [activeFormTab, setActiveFormTab] = useState<'BASIC' | 'PRICING' | 'STOCK'>('BASIC');
  
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
  }, [token]);

  const fetchFormulas = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('http://localhost:3000/api/formulas', { headers });
      if (res.ok) setFormulas(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMasterData = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('http://localhost:3000/api/master-data', { headers });
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
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:3000/api/products?t=${Date.now()}`, { headers });
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
        wholeSalePrice: parseFloat(formData.wholeSalePrice as string) || 0,
        tradePrice: parseFloat(formData.tradePrice as string) || 0,
        costPrice: parseFloat(formData.costPrice as string) || 0,
        currentStock: parseFloat(formData.currentStock as string) || 0,
        minLevel: parseFloat(formData.minLevel as string) || 0,
        dangerLevel: parseFloat(formData.dangerLevel as string) || 0,
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

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: method,
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert(`Product ${editingId ? 'Updated' : 'Saved'} successfully!`);
        fetchProducts();
        refreshInventory();
        resetForm();
      } else {
        const err = await res.json();
        alert('API Reject: ' + err.error);
      }
    } catch (e) {
      alert('Network error while saving');
    }

  };

  const resetForm = () => {
    setFormData({
      productCode: '', barCode: '', productName: '',
      retailPrice: '', wholeSalePrice: '', tradePrice: '', costPrice: '', 
      currentStock: '', minLevel: '', dangerLevel: '',
      pCatId: '', subCatId: '', pTypeId: '', weightUnitId: '', formulaId: '', companyId: '', activeTypeId: ''
    });
    setEditingId(null);
    setFormMode('DISABLED');
    setSelectedProductData(null);
    setActiveFormTab('BASIC');
  };

  const handleExcelSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      if (lines.length < 2) return alert('File seems empty or missing headers.');
      const headers = lines[0].split(',').map(h => h.trim());
      if (!headers.includes('productName')) return alert('Error: Your CSV must contain a header named exactly "productName".');

      const productsToUpload = [];
      let skippedRows = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const productObj: any = {};
        headers.forEach((header, index) => {
          if (values[index] !== undefined && values[index] !== '') productObj[header] = values[index];
        });
        if (productObj.productName) productsToUpload.push(productObj);
        else skippedRows++;
      }
      if (productsToUpload.length === 0) return alert('No valid products found.');
      try {
        const res = await fetch('http://localhost:3000/api/products/bulk-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: productsToUpload })
        });
        if (res.ok) {
          const result = await res.json();
          alert(`Successfully synced ${result.createdCount} products!`);
          fetchProducts();
          refreshInventory();
        } else {
          alert('Failed to sync');
        }
      } catch (e) { alert('Network error during sync'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const [colDefs] = useState<any[]>([
    { headerCheckboxSelection: true, checkboxSelection: true, width: 50, pinned: 'left' },
    { field: 'productCode', headerName: 'PCode', width: 110 },
    { field: 'barCode', headerName: 'BarCode', width: 130 },
    { field: 'productName', headerName: 'Product Name', width: 220, flex: 1 },
    { field: 'pCat.name', headerName: 'Category', width: 130 },
    { field: 'currentStock', headerName: 'Current Stock', width: 130 },
    { field: 'costPrice', headerName: 'Cost Price', width: 120, cellRenderer: (p: any) => `Rs. ${(p.value||0).toLocaleString()}` },
    { field: 'retailPrice', headerName: 'Retail Price', width: 120, cellRenderer: (p: any) => `Rs. ${(p.value||0).toLocaleString()}` },
    { field: 'wholeSalePrice', headerName: 'WS Price', width: 120, cellRenderer: (p: any) => `Rs. ${(p.value||0).toLocaleString()}` }
  ]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

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
      wholeSalePrice: pd.wholeSalePrice?.toString() || '',
      tradePrice: pd.tradePrice?.toString() || '',
      costPrice: pd.costPrice?.toString() || '',
      currentStock: pd.currentStock?.toString() || '',
      minLevel: pd.minLevel?.toString() || '',
      dangerLevel: pd.dangerLevel?.toString() || '',
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
        alert('Failed to delete');
      }
    } catch (e) { alert('Network error'); }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', height: '100%', position: 'relative' }}>
      
      {/* Left Pane: Data Entry */}
      <div className="glass-panel" style={{ width: expandedPane === 'FORM' ? '100%' : '320px', display: expandedPane === 'GRID' ? 'none' : 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <div className="bg-[#0f172a] text-white font-bold px-4 py-2.5 rounded-t-lg flex justify-between items-center text-sm">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={16} className="text-[#38bdf8]" /> Product Master
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {(formMode === 'DISABLED' || formMode === 'VIEW') && (
              <button 
                onClick={() => {
                  setFormData({
                    productCode: '', barCode: '', productName: '',
                    retailPrice: '', wholeSalePrice: '', tradePrice: '', costPrice: '', 
                    currentStock: '', minLevel: '', dangerLevel: '',
                    pCatId: '', subCatId: '', pTypeId: '', weightUnitId: '', formulaId: '', companyId: '', activeTypeId: ''
                  });
                  setEditingId(null);
                  setSelectedProductData(null);
                  setFormMode('CREATE');
                }} 
                className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold px-3 py-1 rounded-md shadow-sm transition-all duration-150 flex items-center gap-1 text-xs"
              >
                <Plus size={12} className="text-purple-300" /> + Add New
              </button>
            )}

            {formMode === 'VIEW' && (
              <button 
                className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold px-3 py-1 rounded-md shadow-sm transition-all duration-150 flex items-center gap-1 text-xs"
                onClick={() => setFormMode('EDIT')}
              >
                Edit
              </button>
            )}

            {(formMode === 'CREATE' || formMode === 'EDIT') && (
              <button 
                className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold px-3 py-1 rounded-md shadow-sm transition-all duration-150 flex items-center gap-1 text-xs"
                onClick={handleSave}
              >
                {formMode === 'EDIT' ? 'Update Record' : 'Save New'}
              </button>
            )}

            {formMode !== 'DISABLED' && (
              <button 
                onClick={() => {
                  resetForm();
                  setFormMode('DISABLED');
                }} 
                className="bg-[#1e293b] hover:bg-[#334155] text-slate-200 font-semibold px-3 py-1 rounded-md transition-all duration-150 flex items-center gap-1 text-xs"
              >
                Cancel
              </button>
            )}

            <button onClick={toggleFormExpand} style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', marginLeft: '2px', color: '#cbd5e1' }}>
              {expandedPane === 'FORM' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>
        
        {/* Form Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
          <button 
            style={{ 
              flex: 1, 
              padding: '8px', 
              background: activeFormTab === 'BASIC' ? '#0088cc' : 'transparent', 
              color: activeFormTab === 'BASIC' ? '#ffffff' : '#334155',
              border: 'none', 
              fontWeight: activeFormTab === 'BASIC' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px', 
              fontSize: '12px' 
            }}
            onClick={() => setActiveFormTab('BASIC')}
          >
            <Tag size={13} className={activeFormTab === 'BASIC' ? 'text-yellow-300' : ''} /> Basic Info
          </button>
          <button 
            style={{ 
              flex: 1, 
              padding: '8px', 
              background: activeFormTab === 'PRICING' ? '#0088cc' : 'transparent', 
              color: activeFormTab === 'PRICING' ? '#ffffff' : '#334155',
              border: 'none', 
              fontWeight: activeFormTab === 'PRICING' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px', 
              fontSize: '12px' 
            }}
            onClick={() => setActiveFormTab('PRICING')}
          >
            Pricing
          </button>
          <button 
            style={{ 
              flex: 1, 
              padding: '8px', 
              background: activeFormTab === 'STOCK' ? '#0088cc' : 'transparent', 
              color: activeFormTab === 'STOCK' ? '#ffffff' : '#334155',
              border: 'none', 
              fontWeight: activeFormTab === 'STOCK' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px', 
              fontSize: '12px' 
            }}
            onClick={() => setActiveFormTab('STOCK')}
          >
            <Layers size={13} /> Stock
          </button>
        </div>

        <div style={{ padding: '12px', overflowY: 'auto', flex: 1, background: '#fff' }}>
          
          {activeFormTab === 'BASIC' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Product Name *</label>
                <input name="productName" value={formData.productName} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" autoFocus disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Product Code</label>
                  <input name="productCode" value={formData.productCode} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Barcode</label>
                  <input name="barCode" value={formData.barCode} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
                </div>
              </div>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Category (PCat)</label>
                <select name="pCatId" value={formData.pCatId} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                  <option value="">-- Select --</option>
                  {pCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Sub Category</label>
                <select name="subCatId" value={formData.subCatId} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                  <option value="">-- Select --</option>
                  {subCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Brand (Company)</label>
                <select name="companyId" value={formData.companyId} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                  <option value="">-- Select --</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Product Type</label>
                  <select name="pTypeId" value={formData.pTypeId} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                    <option value="">-- Select --</option>
                    {pTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Weight Unit</label>
                  <select name="weightUnitId" value={formData.weightUnitId} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'}>
                    <option value="">-- Select --</option>
                    {weightUnits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeFormTab === 'PRICING' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Cost Price (Rs.)</label>
                <input name="costPrice" type="number" step="0.01" value={formData.costPrice} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
              </div>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Retail Price (Rs.)</label>
                <input name="retailPrice" type="number" step="0.01" value={formData.retailPrice} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
              </div>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Wholesale Price (Rs.)</label>
                <input name="wholeSalePrice" type="number" step="0.01" value={formData.wholeSalePrice} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
              </div>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Trade Price (Rs.)</label>
                <input name="tradePrice" type="number" step="0.01" value={formData.tradePrice} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
              </div>
            </div>
          )}

          {activeFormTab === 'STOCK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Initial Current Stock</label>
                <input name="currentStock" type="number" value={formData.currentStock} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode !== 'CREATE'} />
                {formMode !== 'CREATE' && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>To adjust stock for existing products, use Inventory Control</div>}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Min Level</label>
                  <input name="minLevel" type="number" value={formData.minLevel} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="desktop-label" style={{ fontWeight: 600, color: '#334155' }}>Danger Level</label>
                  <input name="dangerLevel" type="number" value={formData.dangerLevel} onChange={handleChange} className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 px-3 py-1.5 rounded-md text-sm outline-none w-full shadow-sm" disabled={formMode === 'VIEW' || formMode === 'DISABLED'} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Grid & Barcode */}
      <div className="glass-panel" style={{ flex: expandedPane === 'FORM' ? 0 : 1, display: expandedPane === 'FORM' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <div className="bg-[#0f172a] text-white font-bold px-4 py-2.5 rounded-t-lg flex justify-between items-center text-sm">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={activeRightTab === 'LIST' ? "bg-[#0088cc] text-white px-3 py-1 rounded-md flex items-center gap-1.5 font-semibold text-xs" : "bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-md flex items-center gap-1.5 font-medium text-xs"}
              onClick={() => setActiveRightTab('LIST')}
            >
              <List size={13} /> Product List
            </button>
            <button 
              className={activeRightTab === 'BARCODE' ? "bg-[#0088cc] text-white px-3 py-1 rounded-md flex items-center gap-1.5 font-semibold text-xs" : "bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-md flex items-center gap-1.5 font-medium text-xs"}
              onClick={() => setActiveRightTab('BARCODE')}
            >
              <BarcodeIcon size={13} /> Barcode Studio
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-md font-mono">
              Products ({filteredProducts.length})
            </span>
            <button onClick={toggleGridExpand} style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: '#cbd5e1' }}>
              {expandedPane === 'GRID' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {activeRightTab === 'LIST' && (
            <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', width: '240px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      placeholder="Search products by code, name..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white border border-slate-200 focus:border-[#0088cc] text-slate-800 pl-8 pr-3 py-1.5 rounded-md text-xs outline-none w-full shadow-sm"
                    />
                  </div>
                  {selectedRowIds.length > 0 && (
                    <button onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded-md text-xs transition-all">
                      Delete Selected ({selectedRowIds.length})
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', display: 'flex', gap: '10px' }}>
                  <span>Total Stock: <strong style={{ color: '#0088cc' }}>{filteredProducts.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0).toLocaleString()}</strong> units</span>
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
        </div>
      </div>

    </div>
  );
};

export default ProductManagement;

