import React, { useState, useEffect } from 'react';
import { Search, Calendar, Eye, X, Banknote, CreditCard, User, MapPin, Printer, Download } from 'lucide-react';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
import { useSettings } from '../context/SettingsContext';

interface SaleItem {
  id: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: {
    productName: string;
    productCode: string;
  };
}

interface Sale {
  id: number;
  invoiceNumber?: string;
  date: string;
  total?: number;
  totalAmount?: number;
  paymentMethod?: string;
  amountTendered?: number | null;
  customerId?: number | null;
  customerRecId?: number | null;
  customerRec?: {
    custName: string;
    phone?: string;
  };
  customer?: {
    name: string;
    phone: string;
  };
  customerLocation?: {
    id?: number;
    locationName: string;
  };
  saleLocations?: {
    customerLocationId: number;
    customerLocation: {
      id: number;
      locationName: string;
    };
  }[];
  salesman?: {
    name: string;
  };
  saleItems?: SaleItem[];
  details?: any[];
}

const SalesRecord: React.FC = () => {
  const { settings } = useSettings();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Receipt modal state
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'sale', data: {} });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Modal state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | number | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3000/api/sales');
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch (e) {
      console.error('Failed to fetch sales', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const uniqueCustomers = Array.from(
    new Set(
      sales
        .map(s => s.customerRec?.custName || s.customer?.name)
        .filter((name): name is string => Boolean(name))
    )
  );

  const uniqueLocations = Array.from(
    new Set(
      sales.flatMap(s => {
        const locs: string[] = [];
        if (s.customerLocation?.locationName) locs.push(s.customerLocation.locationName);
        if (s.saleLocations && s.saleLocations.length > 0) {
          s.saleLocations.forEach(sl => {
            if (sl.customerLocation?.locationName) locs.push(sl.customerLocation.locationName);
          });
        }
        return locs;
      }).filter((loc): loc is string => Boolean(loc))
    )
  );

  const filteredSales = sales.filter(s => {
    const invNum = s.invoiceNumber || `INV-${s.id}`;
    const custName = s.customerRec?.custName || s.customer?.name || '';

    const matchesSearch = 
      invNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.salesman && s.salesman.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesDate = dateFilter ? s.date.startsWith(dateFilter) : true;
    const matchesCustomer = customerFilter ? custName === customerFilter : true;

    const saleLocNames = Array.from(
      new Set([
        s.customerLocation?.locationName,
        ...(s.saleLocations?.map(sl => sl.customerLocation?.locationName) || [])
      ].filter(Boolean))
    );

    const matchesLocation = locationFilter ? saleLocNames.includes(locationFilter) : true;
    
    return matchesSearch && matchesDate && matchesCustomer && matchesLocation;
  });

  const getPaymentIcon = (method: string = 'Cash') => {
    if (method === 'Cash') return <Banknote size={16} className="text-emerald-500" />;
    if (method === 'Card') return <CreditCard size={16} className="text-blue-500" />;
    return <User size={16} className="text-amber-500" />;
  };

  return (
    <div className="page-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales History</h1>
          <p className="page-subtitle">View, search, and filter past transactions by customer, delivery location, and date.</p>
        </div>
      </div>
      
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px' }}>
        
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', flex: 1, minWidth: '220px' }}>
            <Search size={18} color="#64748b" />
            <input 
              type="text" 
              placeholder="Search by Invoice #, Customer, or Cashier..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '13px' }}
            />
          </div>
          
          {/* Customer Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', width: '210px' }}>
            <User size={16} color="#64748b" style={{ marginRight: '6px' }} />
            <select
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: '#475569', cursor: 'pointer' }}
            >
              <option value="">All Customers</option>
              {uniqueCustomers.map(cust => (
                <option key={cust} value={cust}>{cust}</option>
              ))}
            </select>
            {customerFilter && (
              <button 
                onClick={() => setCustomerFilter('')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer', display: 'flex', marginLeft: '4px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Location Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', width: '210px' }}>
            <MapPin size={16} color="#10b981" style={{ marginRight: '6px' }} />
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: '#475569', cursor: 'pointer' }}
            >
              <option value="">All Locations</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            {locationFilter && (
              <button 
                onClick={() => setLocationFilter('')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer', display: 'flex', marginLeft: '4px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', width: '180px' }}>
            <Calendar size={16} color="#64748b" style={{ marginRight: '6px' }} />
            <input 
              type="date" 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: '#475569' }}
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer', display: 'flex', marginLeft: '4px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 10 }}>
              <tr>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '140px' }}>Date</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '110px' }}>Invoice #</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px' }}>Customer</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '180px' }}>Delivery Location(s)</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'center', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '110px' }}>Payment</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'right', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '130px' }}>Total</th>
                <th style={{ padding: '8px 10px', borderBottom: '1px solid #334155', textAlign: 'center', color: '#ffffff', fontWeight: 700, fontSize: '11px', width: '170px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading records...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No sales records found.</td>
                </tr>
              ) : (
                filteredSales.map(sale => {
                  const invNum = sale.invoiceNumber || `INV-${sale.id}`;
                  const custName = sale.customerRec?.custName || sale.customer?.name;
                  const totalVal = sale.totalAmount !== undefined ? sale.totalAmount : (sale.total || 0);

                  const locationsList = Array.from(
                    new Set([
                      sale.customerLocation?.locationName,
                      ...(sale.saleLocations?.map(sl => sl.customerLocation?.locationName) || [])
                    ].filter((l): l is string => Boolean(l)))
                  );

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => {
                        setSelectedInvoiceId(invNum);
                        setShowInvoiceModal(true);
                      }}
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {new Date(sale.date).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700, color: '#0284c7' }}>
                        {invNum}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: '#0f172a', fontWeight: 600 }}>
                        {custName ? custName : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Walk-in</span>}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                        {locationsList.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {locationsList.map(loc => (
                              <span key={loc} style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '10px', fontWeight: 600, fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <MapPin size={9} /> {loc}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: (sale.paymentMethod || 'Cash') === 'Cash' ? '#ecfdf5' : (sale.paymentMethod || 'Cash') === 'Card' ? '#eff6ff' : '#fffbeb', color: (sale.paymentMethod || 'Cash') === 'Cash' ? '#047857' : (sale.paymentMethod || 'Cash') === 'Card' ? '#1d4ed8' : '#b45309', padding: '2px 8px', borderRadius: '100px', fontWeight: 600, fontSize: '10px' }}>
                          {getPaymentIcon(sale.paymentMethod)}
                          {sale.paymentMethod || 'Cash'}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                        Rs. {totalVal.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => {
                              setSelectedInvoiceId(invNum);
                              setShowInvoiceModal(true);
                            }}
                            style={{ background: '#0284c7', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', color: '#ffffff', fontWeight: 600, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={12} /> View
                          </button>
                          <button
                            onClick={() => {
                              setReceiptModal({
                                isOpen: true, type: 'sale',
                                data: {
                                  storeName: settings?.storeName || 'Wholesale ERP',
                                  storeAddress: settings?.storeAddress || '',
                                  receiptFooter: settings?.receiptFooter || 'Thank you for your business!',
                                  invoiceNumber: invNum,
                                  date: sale.date,
                                  customerName: custName || 'Walk-in',
                                  locations: locationsList,
                                  paymentMethod: sale.paymentMethod || 'Cash',
                                  items: (sale.details || sale.saleItems || []).map((d: any, i: number) => ({
                                    sr: i + 1,
                                    name: d.productRec?.productName || d.product?.productName || 'Product',
                                    qty: d.qty || d.quantity || 1,
                                    rate: d.price || d.unitPrice || 0,
                                    discPercent: d.discPercent || 0,
                                    cashDisc: d.cashDiscount || 0,
                                    netAmount: d.netAmount || d.totalPrice || ((d.qty || 1) * (d.price || 0)),
                                  })),
                                  grossAmount: totalVal,
                                  netPayable: totalVal,
                                  amountReceived: sale.amountTendered || totalVal,
                                  changeReturn: 0,
                                  balanceDue: 0,
                                }
                              });
                            }}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                            title="Print Thermal Receipt"
                          >
                            <Printer size={12} /> Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHASE 36: FULL VISUAL RECEIPT & INLINE RETURNS MODAL */}
      <InvoiceDetailsModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        invoiceId={selectedInvoiceId}
        onReturnSuccess={fetchSales}
      />

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />

    </div>
  );
};

export default SalesRecord;
