import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';

type Props = {
  selectedProduct: any;
  allProducts: any[];
  onSelectProduct: (product: any) => void;
};

const BarcodeGenerator: React.FC<Props> = ({ selectedProduct, allProducts, onSelectProduct }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [printQuantity, setPrintQuantity] = React.useState<number>(30);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); // Reload to restore React bindings after print hack
  };

  const handleProductSelect = (p: any) => {
    onSelectProduct(p);
    setSearchTerm(''); // clear search after selection
    setDropdownOpen(false);
  };

  const filteredProducts = allProducts.filter(p => 
    p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.productCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const barcodeValue = selectedProduct ? (selectedProduct.barCode || selectedProduct.productCode) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '24px', width: '100%', maxWidth: '500px' }}>
      
      {/* Controls */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Select Product</label>
          
          <div 
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#fff', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span style={{ color: selectedProduct ? '#0f172a' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedProduct ? `${selectedProduct.productName} (${selectedProduct.productCode})` : '-- Choose a Product --'}
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
          </div>

          {dropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '250px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                  autoFocus
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>No products found</div>
                ) : (
                  filteredProducts.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => handleProductSelect(p)}
                      style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {p.productName} <span style={{ color: '#64748b', fontSize: '12px' }}>({p.productCode})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Number of Labels</label>
          <input 
            type="number" 
            value={printQuantity}
            onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
            min="1" max="1000"
          />
        </div>
      </div>

      {!selectedProduct ? (
        <div style={{ padding: '24px', color: '#64748b', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', width: '100%' }}>
          <BarcodeIcon size={48} opacity={0.2} style={{ marginBottom: '16px' }} />
          <div>Please select a product above to generate labels.</div>
        </div>
      ) : (
        <>
          {/* Visual Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, textAlign: 'center', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedProduct.company?.name || 'Wholesale ERP'}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, textAlign: 'center', marginBottom: '2px' }}>{selectedProduct.productName}</div>
              <div style={{ fontSize: '10px', color: '#475569', textAlign: 'center', marginBottom: '8px' }}>
                {selectedProduct.size ? `Size: ${selectedProduct.size}` : ''} 
                {selectedProduct.size && selectedProduct.productCode ? ' | ' : ''}
                {selectedProduct.productCode ? `Code: ${selectedProduct.productCode}` : ''}
              </div>
              <Barcode value={barcodeValue} format="CODE128" width={1.8} height={50} fontSize={14} displayValue={true} margin={0} />
              <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '8px' }}>Rs. {Number(selectedProduct.salePrice || 0).toFixed(2)}</div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '14px', width: '100%', justifyContent: 'center', fontWeight: 'bold' }}>
            <Printer size={18} /> Print {printQuantity} Labels
          </button>

          {/* Hidden Print Grid (Sticker Sheet Layout) */}
          <div style={{ display: 'none' }}>
            <div ref={printRef} style={{ padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start' }}>
              {Array.from({ length: printQuantity }).map((_, i) => (
                <div key={i} style={{ width: '200px', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {selectedProduct.productName}
                  </div>
                  <Barcode value={barcodeValue} format="CODE128" width={1.5} height={40} fontSize={12} margin={0} />
                  {selectedProduct.salePrice !== undefined && (
                    <div style={{ fontSize: '14px', fontWeight: 900, marginTop: '6px' }}>
                      Rs. {Number(selectedProduct.salePrice).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
    </div>
  );
};

export default BarcodeGenerator;
