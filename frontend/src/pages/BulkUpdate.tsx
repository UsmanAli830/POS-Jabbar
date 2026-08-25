import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Save } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

const BulkUpdate: React.FC = () => {
  const { products, refreshInventory } = useInventory();

  const [categories, setCategories] = useState<any[]>([]);
  
  useEffect(() => {
    fetch('http://localhost:3000/api/master-data')
      .then(res => res.json())
      .then(data => setCategories(data.categories || []));
  }, []);

  // Keep track of modified rows by ID
  const [dirtyRows, setDirtyRows] = useState<Record<number, any>>({});
  const [saving, setSaving] = useState(false);



  const onCellValueChanged = useCallback((params: any) => {
    const { data } = params;
    // When a cell is edited, store the new data in dirtyRows
    setDirtyRows(prev => ({
      ...prev,
      [data.id]: {
        id: data.id,
        salePrice: data.salePrice,
        costPrice: data.costPrice,
        barCode: data.barCode,
        categoryId: data.categoryId ? Number(data.categoryId) : null
      }
    }));
  }, []);

  const handleSaveAll = async () => {
    const updates = Object.values(dirtyRows);
    if (updates.length === 0) {
      alert('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('http://localhost:3000/api/products/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        alert(`Successfully updated ${updates.length} products!`);
        setDirtyRows({});
        await refreshInventory();
      } else {
        const err = await res.json();
        alert('Failed to save bulk update: ' + err.error);
      }
    } catch (e) {
      alert('Network error during bulk save.');
    } finally {
      setSaving(false);
    }
  };

  const colDefs: any[] = useMemo(() => {
    const catOptions = categories.map(c => String(c.id));
    return [
      { field: 'productCode', headerName: 'Product Code', width: 120, editable: false },
      { field: 'productName', headerName: 'Product Name', flex: 2, minWidth: 220, editable: false },
      { 
        field: 'categoryId', 
        headerName: 'Category', 
        width: 170, 
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: catOptions
        },
        valueFormatter: (params: any) => {
          const cat = categories.find(c => String(c.id) === String(params.value));
          return cat ? cat.name : '-- None --';
        },
        cellStyle: { backgroundColor: '#fef9c3', border: '1px dashed #ca8a04' }
      },
      { 
        field: 'barCode', 
        headerName: 'Barcode', 
        width: 170, 
        editable: true,
        cellStyle: { backgroundColor: '#fef9c3', border: '1px dashed #ca8a04' }
      },
      { 
        field: 'costPrice', 
        headerName: 'Cost Price (Rs.)', 
        width: 140, 
        editable: true,
        cellStyle: { backgroundColor: '#fef9c3', border: '1px dashed #ca8a04', textAlign: 'right' },
        valueParser: (params: any) => Number(params.newValue),
        valueFormatter: (params: any) => params.value !== undefined && params.value !== null ? Number(params.value).toLocaleString() : '0'
      },
      { 
        field: 'salePrice', 
        headerName: 'Sale Price (Rs.)', 
        width: 140, 
        editable: true,
        cellStyle: { backgroundColor: '#fef9c3', border: '1px dashed #ca8a04', textAlign: 'right' },
        valueParser: (params: any) => Number(params.newValue),
        valueFormatter: (params: any) => params.value !== undefined && params.value !== null ? Number(params.value).toLocaleString() : '0'
      }
    ];
  }, [categories]);

  const defaultColDef = useMemo(() => {
    return {
      sortable: true,
      filter: true,
      resizable: true,
    };
  }, []);

  const dirtyCount = Object.keys(dirtyRows).length;

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Bulk Update Utility</h1>
          <p className="page-subtitle">Excel-style grid for rapid pricing and barcode updates. Highlighted cells are editable.</p>
        </div>
        
        <div>
          <button 
            className="btn btn-primary" 
            style={{ padding: '8px 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleSaveAll}
            disabled={saving || dirtyCount === 0}
          >
            <Save size={18} />
            {saving ? 'Saving...' : `Save ${dirtyCount} Changes`}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
        <div className="ag-theme-alpine" style={{ flex: 1, width: '100%' }}>
          <AgGridReact
            rowData={products}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            onCellValueChanged={onCellValueChanged}
            rowSelection="single"
            animateRows={true}
          />
        </div>
      </div>
    </div>
  );
};

export default BulkUpdate;
