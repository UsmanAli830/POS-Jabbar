import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, X, User, Barcode, CheckCircle, RotateCcw, Pause, ClipboardList, PackageCheck } from 'lucide-react';
import TimeclockModal from '../components/TimeclockModal';
import Receipt from '../components/Receipt';
import { useSettings } from '../context/SettingsContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useAuth } from '../context/AuthContext';

type Product = {
  id: number;
  productCode: string;
  barCode: string;
  productName: string;
  salePrice: number;
  costPrice?: number;
  packSize: number;
  baseUom: string;
  bulkUom: string;
  currentStock: number;
  pCatId?: number;
  categoryId?: number;
};

type CartItem = Product & {
  cartQuantity: number;
  rate: number;
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  totalQty: number;
};

const BookingSheet: React.FC = () => {
  // Mode & Tabs
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'NEW' | 'MANAGE'>('NEW');
  const [openBookings, setOpenBookings] = useState<any[]>([]);

  // Master Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | 'ALL'>('ALL');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Header State
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [customers, setCustomers] = useState<{ id: number; name: string; custName?: string; liveBalance?: number; CurrentBalance?: number }[]>([]);
  const [salesmanId, setSalesmanId] = useState<number | ''>('');
  const [booker, setBooker] = useState<string>('');
  const [refNumber, setRefNumber] = useState<string>(`BKG-${Date.now().toString().slice(-6)}`);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Right Pane Financial State
  const [lossPercent, setLossPercent] = useState<number | ''>(0);
  const [expense, setExpense] = useState<number | ''>(0);
  const [advancePayment, setAdvancePayment] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Credit / Unpaid'>('Cash');
  const [finHeadId, setFinHeadId] = useState<number | ''>('');
  const [finHeads, setFinHeads] = useState<any[]>([]);

  // Modals & UI State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', initialBalance: '' });
  const [showAddFinHeadModal, setShowAddFinHeadModal] = useState(false);
  const [newFinHeadName, setNewFinHeadName] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');

  // Autocomplete state
  const [activeAutocompleteRow, setActiveAutocompleteRow] = useState<number | 'NEW' | null>(null);
  const [autocompleteText, setAutocompleteText] = useState<string>('');
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Settings & Scan state
  const { settings } = useSettings();
  const allowNegativeStock = settings?.allowNegativeStock ?? false;
  const [scanToast, setScanToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error(e);
    }
  };

  const showScanToast = (msg: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setScanToast({ message: msg, type });
    toastTimeoutRef.current = setTimeout(() => setScanToast(null), 3000);
  };

  // Hardware Barcode Scanner integration
  const handleBarcodeScan = async (scannedBarcode: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/products/search?barcode=${encodeURIComponent(scannedBarcode)}`);
      if (res.ok) {
        const prod = await res.json();
        addProductToCart(prod);
        playBeep();
        showScanToast(`Scanned: ${prod.productName}`, 'success');
      } else {
        showScanToast(`Barcode not found: ${scannedBarcode}`, 'error');
      }
    } catch (e) {
      console.error('Barcode error', e);
    }
  };

  useBarcodeScanner(handleBarcodeScan);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchMasterData();
    fetchBookings();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (customerId) {
      fetchCustomerBalance(Number(customerId));
    } else {
      setCustomerBalance(null);
    }
  }, [customerId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setActiveAutocompleteRow(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/products');
      if (res.ok) setProducts(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async (autoSelectId?: number) => {
    try {
      const res = await fetch('http://localhost:3000/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        if (autoSelectId) setCustomerId(autoSelectId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomerBalance = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/customers/${id}/balance`);
      if (res.ok) {
        const data = await res.json();
        setCustomerBalance(data.balance);
      }
    } catch (e) {
      setCustomerBalance(null);
    }
  };

  const fetchMasterData = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/master-data');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        setFinHeads(data.finHeads || []);
        setCategories(data.pCats || data.categories || []);
        setLocations(data.locations || []);
        if (data.locations && data.locations.length > 0) {
          setSelectedLocationId(data.locations[0].id);
        }
        if (data.finHeads && data.finHeads.length > 0 && !finHeadId) {
          setFinHeadId(data.finHeads[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateFinHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinHeadName.trim()) return;
    try {
      const res = await fetch('http://localhost:3000/api/finance/heads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFinHeadName.trim() })
      });
      if (res.ok) {
        const created = await res.json();
        setShowAddFinHeadModal(false);
        setNewFinHeadName('');
        fetchMasterData();
        setFinHeadId(created.id);
      } else {
        const err = await res.json();
        alert('Error creating financial head: ' + (err.error || 'Failed'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/bookings');
      if (res.ok) setOpenBookings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // Product List Filtering
  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategoryId !== 'ALL') {
      list = list.filter((p: any) => p.pCatId === activeCategoryId || p.categoryId === activeCategoryId);
    }
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase();
      list = list.filter(p =>
        (p.productName || '').toLowerCase().includes(q) ||
        (p.productCode || '').toLowerCase().includes(q) ||
        (p.barCode || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, activeCategoryId, productSearchQuery]);

  const autocompleteMatchingProducts = useMemo(() => {
    if (!autocompleteText.trim()) return products.slice(0, 15);
    const q = autocompleteText.toLowerCase();
    return products.filter(p =>
      (p.productName || '').toLowerCase().includes(q) ||
      (p.productCode || '').toLowerCase().includes(q) ||
      (p.barCode || '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [products, autocompleteText]);

  // Cart Operations
  const addProductToCart = (prod: Product) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === prod.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.cartQuantity + 1;
        const gross = newQty * item.rate;
        const discAmt = gross * (item.discountPercent / 100);
        updated[existingIdx] = {
          ...item,
          cartQuantity: newQty,
          totalQty: newQty * (item.packSize || 1),
          grossAmount: gross,
          discountAmount: discAmt,
          netAmount: gross - discAmt
        };
        return updated;
      }

      const rate = prod.salePrice || 0;
      const packSize = prod.packSize || 1;
      const gross = rate * 1;
      return [
        ...prev,
        {
          ...prod,
          cartQuantity: 1,
          totalQty: packSize * 1,
          rate,
          grossAmount: gross,
          discountPercent: 0,
          discountAmount: 0,
          netAmount: gross
        }
      ];
    });
  };

  const updateCartRow = (index: number, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      
      let qty = Number(updated.cartQuantity);
      if (isNaN(qty) || qty <= 0) qty = 1;
      
      let packSize = updated.packSize || 1;
      
      let totalQty = Number(updated.totalQty);
      if (field === 'totalQty') {
        if (isNaN(totalQty) || totalQty <= 0) totalQty = 1;
        qty = Math.max(1, Math.round(totalQty / packSize));
      } else {
        totalQty = qty * packSize;
      }
      
      let rate = Number(updated.rate);
      if (isNaN(rate) || rate < 0) rate = 0;
      
      let gross = Number(updated.grossAmount);
      if (field === 'grossAmount') {
        if (isNaN(gross) || gross < 0) gross = 0;
        rate = qty > 0 ? gross / qty : 0;
      } else {
        gross = qty * rate;
      }
      
      let discPct = Number(updated.discountPercent);
      if (isNaN(discPct) || discPct < 0) discPct = 0;
      if (discPct > 100) discPct = 100;
      
      const discAmt = gross * (discPct / 100);
      const net = gross - discAmt;

      return {
        ...updated,
        cartQuantity: qty,
        totalQty,
        rate,
        grossAmount: gross,
        discountPercent: discPct,
        discountAmount: discAmt,
        netAmount: net
      };
    }));
  };

  const removeCartRow = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const selectProductForGridRow = (prod: Product, rowIndex: number | 'NEW') => {
    if (rowIndex === 'NEW') {
      addProductToCart(prod);
    } else {
      setCart(prev => prev.map((item, i) => {
        if (i !== rowIndex) return item;
        const rate = prod.salePrice || 0;
        const qty = item.cartQuantity || 1;
        const gross = qty * rate;
        const discAmt = gross * ((item.discountPercent || 0) / 100);
        return {
          ...prod,
          cartQuantity: qty,
          totalQty: qty * (prod.packSize || 1),
          rate,
          grossAmount: gross,
          discountPercent: item.discountPercent || 0,
          discountAmount: discAmt,
          netAmount: gross - discAmt
        };
      }));
    }
    setActiveAutocompleteRow(null);
    setAutocompleteText('');
  };

  // Financial Calculations
  const grossTotal = useMemo(() => cart.reduce((sum, item) => sum + item.grossAmount, 0), [cart]);
  const itemDiscountsTotal = useMemo(() => cart.reduce((sum, item) => sum + item.discountAmount, 0), [cart]);
  const lossDiscountAmount = useMemo(() => {
    const pct = Number(lossPercent) || 0;
    return (grossTotal - itemDiscountsTotal) * (pct / 100);
  }, [grossTotal, itemDiscountsTotal, lossPercent]);

  const netValue = useMemo(() => Math.max(0, grossTotal - itemDiscountsTotal - lossDiscountAmount), [grossTotal, itemDiscountsTotal, lossDiscountAmount]);
  const totalAmount = useMemo(() => netValue + (Number(expense) || 0), [netValue, expense]);
  
  const advanceValue = Number(advancePayment) || 0;
  const balanceDue = useMemo(() => totalAmount - advanceValue, [totalAmount, advanceValue]);

  // Order Booking Submission (POST /api/bookings)
  const handleBookOrder = async () => {
    if (cart.length === 0) {
      alert('Cannot book order: Order detail grid is empty!');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        invoiceNumber: refNumber || `BKG-${Date.now().toString().slice(-6)}`,
        subtotal: grossTotal,
        discountAmount: itemDiscountsTotal + lossDiscountAmount,
        taxAmount: 0,
        total: totalAmount,
        paymentMethod,
        locationId: selectedLocationId || 1,
        customerId: customerId || undefined,
        salesmanId: salesmanId || undefined,
        dueDate: expectedDeliveryDate || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        remarks: remarks || undefined,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.cartQuantity,
          unitPrice: item.rate,
          totalPrice: item.netAmount,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount
        }))
      };

      const res = await fetch('http://localhost:3000/api/bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('🎉 Order Booked Successfully! Inventory reserved.');
        setCart([]);
        setRefNumber(`BKG-${Date.now().toString().slice(-6)}`);
        setRemarks('');
        setLossPercent(0);
        setExpense(0);
        setAdvancePayment('');
        setExpectedDeliveryDate('');
        fetchBookings();
        fetchProducts();
      } else {
        const err = await res.json();
        alert('Booking Error: ' + (err.error || 'Failed to create booking'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error while booking order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFulfillBooking = async (bookingId: number) => {
    if (!window.confirm('Are you sure you want to fulfill this booking into an active sale?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/bookings/${bookingId}/fulfill`, {
        method: 'POST'
      });
      if (res.ok) {
        alert('Booking fulfilled and converted to Sale!');
        fetchBookings();
      } else {
        const err = await res.json();
        alert('Fulfillment error: ' + (err.error || 'Failed'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: newCustomer.phone,
          initialBalance: newCustomer.initialBalance ? Number(newCustomer.initialBalance) : 0
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShowAddCustomerModal(false);
        setNewCustomer({ name: '', phone: '', initialBalance: '' });
        fetchCustomers(data.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 42px)', background: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden', padding: '4px' }}>
      
      {/* SCAN TOAST ALERT */}
      {scanToast && (
        <div style={{
          position: 'fixed', top: '12px', right: '12px', zIndex: 9999,
          background: scanToast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff', padding: '6px 14px', borderRadius: '4px', fontSize: '11px',
          fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <Barcode size={14} /> {scanToast.message}
        </div>
      )}

      {/* TOP TAB SWITCHER */}
      <div style={{ padding: '4px 8px', background: '#0f172a', color: '#ffffff', borderRadius: '3px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('NEW')}
            style={{
              padding: '4px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '2px', cursor: 'pointer', border: 'none',
              background: activeTab === 'NEW' ? '#0284c7' : '#334155', color: '#ffffff'
            }}
          >
            ➕ NEW ORDER BOOKING
          </button>
          <button
            onClick={() => setActiveTab('MANAGE')}
            style={{
              padding: '4px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '2px', cursor: 'pointer', border: 'none',
              background: activeTab === 'MANAGE' ? '#0284c7' : '#334155', color: '#ffffff'
            }}
          >
            📋 OPEN BOOKINGS LIST ({openBookings.filter(b => b.status === 'OPEN').length})
          </button>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
          ORDER BOOKING SYSTEM
        </div>
      </div>

      {/* VIEW OPEN BOOKINGS TAB */}
      {activeTab === 'MANAGE' ? (
        <div style={{ flex: 1, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>Open Order Bookings</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '6px', textAlign: 'left' }}>Ref #</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Booking Date</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Items</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Total (Rs)</th>
                <th style={{ padding: '6px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '6px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {openBookings.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No active bookings found.</td></tr>
              ) : (
                openBookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px', fontWeight: 700 }}>{b.invoiceNumber}</td>
                    <td style={{ padding: '6px' }}>{new Date(b.date).toLocaleDateString()}</td>
                    <td style={{ padding: '6px' }}>{b.customer ? (b.customer.custName || b.customer.name) : 'Walk-in'}</td>
                    <td style={{ padding: '6px' }}>{b.bookingItems ? b.bookingItems.length : 0} items</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>Rs. {(b.total || 0).toLocaleString()}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 700, background: b.status === 'OPEN' ? '#fef3c7' : '#dcfce7', color: b.status === 'OPEN' ? '#b45309' : '#15803d' }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      {b.status === 'OPEN' && (
                        <button
                          onClick={() => handleFulfillBooking(b.id)}
                          style={{ padding: '3px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '2px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Fulfill to Sale
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (

        /* 3-PANE ORDER BOOKING POS CLONE LAYOUT GRID */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '230px 1fr 270px',
          gap: '6px',
          flex: 1,
          minHeight: 0
        }}>

          {/* ========================================== */}
          {/* LEFT PANE: CATEGORIES & PRODUCTS SIDEBAR   */}
          {/* ========================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
            
            {/* TOP SECTION: CATEGORY LIST */}
            <div style={{ height: '45%', display: 'flex', flexDirection: 'column', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ padding: '6px 8px', background: '#0f172a', color: '#f8fafc', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Categories</span>
                <span style={{ background: '#334155', padding: '1px 5px', borderRadius: '3px', fontSize: '9px' }}>{categories.length}</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <button
                  onClick={() => setActiveCategoryId('ALL')}
                  style={{
                    width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: '11px', fontWeight: activeCategoryId === 'ALL' ? 700 : 500,
                    background: activeCategoryId === 'ALL' ? '#0284c7' : '#ffffff',
                    color: activeCategoryId === 'ALL' ? '#ffffff' : '#334155',
                    border: '1px solid', borderColor: activeCategoryId === 'ALL' ? '#0284c7' : '#e2e8f0',
                    borderRadius: '3px', cursor: 'pointer', transition: 'all 0.1s'
                  }}
                >
                  📁 All Categories
                </button>

                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: '11px', fontWeight: activeCategoryId === cat.id ? 700 : 500,
                      background: activeCategoryId === cat.id ? '#0284c7' : '#ffffff',
                      color: activeCategoryId === cat.id ? '#ffffff' : '#334155',
                      border: '1px solid', borderColor: activeCategoryId === cat.id ? '#0284c7' : '#e2e8f0',
                      borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}
                  >
                    📂 {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* BOTTOM SECTION: PRODUCT LIST */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', overflow: 'hidden' }}>
              <div style={{ padding: '6px 8px', background: '#1e293b', color: '#f8fafc', fontSize: '11px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Products</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>({filteredProducts.length})</span>
              </div>

              <div style={{ padding: '4px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search Product / Code..."
                    value={productSearchQuery}
                    onChange={e => setProductSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '4px 6px 4px 22px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {filteredProducts.map(prod => (
                  <div
                    key={prod.id}
                    onClick={() => addProductToCart(prod)}
                    style={{
                      padding: '5px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '3px',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <div style={{ fontWeight: 600, fontSize: '11px', color: '#0f172a', lineHeight: '1.2' }}>{prod.productName}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
                      <span>Rs. {(prod.salePrice || 0).toLocaleString()}</span>
                      <span style={{ fontWeight: 700, color: (prod.currentStock || 0) > 0 ? '#16a34a' : '#dc2626' }}>
                        Stk: {prod.currentStock || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* CENTER PANE: HEADER & ORDER DETAIL GRID    */}
          {/* ========================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
            
            {/* CENTER TOP HEADER FORM (Compact 2 Rows x 4 Columns) */}
            <div style={{ padding: '6px 8px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              
              {/* ROW 1: Customer, Salesman, Booker, Ref# */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px' }}>
                
                {/* Customer Searchable Select */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155' }}>Customer *</label>
                    <button onClick={() => setShowAddCustomerModal(true)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '9px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      + New
                    </button>
                  </div>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', height: '26px', padding: '2px 4px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.custName} - Balance: Rs. {(c.CurrentBalance !== undefined ? c.CurrentBalance : (c.liveBalance || 0)).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {customerBalance !== null && customerId !== '' && (
                    <div style={{ fontSize: '9px', fontWeight: 700, color: customerBalance > 0 ? '#dc2626' : '#16a34a', marginTop: '1px' }}>
                      Bal: Rs. {Math.abs(customerBalance).toLocaleString()} {customerBalance > 0 ? '(Dr)' : '(Cr)'}
                    </div>
                  )}
                </div>

                {/* Salesman */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Salesman</label>
                  <div style={{
                    width: '100%',
                    height: '26px',
                    padding: '4px 6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    background: '#e2e8f0',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {user?.name || 'Not Logged In'}
                  </div>
                </div>

                {/* Booker */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Booker</label>
                  <input
                    type="text"
                    value={booker}
                    onChange={e => setBooker(e.target.value)}
                    placeholder="Booker Name"
                    style={{ width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  />
                </div>

                {/* Booking Ref# */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Booking Ref #</label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={e => setRefNumber(e.target.value)}
                    style={{ width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* ROW 2: Booking Date, Expected Delivery Date, Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Booking Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                    style={{ width: '100%', height: '26px', padding: '2px 4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '1px' }}>Expected Delivery Date *</label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={e => setExpectedDeliveryDate(e.target.value)}
                    style={{ width: '100%', height: '26px', padding: '2px 4px', fontSize: '11px', border: '1px solid #0284c7', borderRadius: '3px', outline: 'none', background: '#f0f9ff' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Order delivery notes..."
                    style={{ width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* ORDER DETAIL GRID TABLE */}
            <div style={{ flex: 1, overflow: 'auto', position: 'relative' }} ref={autocompleteRef}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                
                <thead style={{ position: 'sticky', top: 0, background: '#0f172a', color: '#ffffff', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '6px 4px', width: '35px', textAlign: 'center', borderRight: '1px solid #334155' }}>Sr#</th>
                    <th style={{ padding: '6px 6px', width: '100px', borderRight: '1px solid #334155' }}>Bar Code</th>
                    <th style={{ padding: '6px 6px', borderRight: '1px solid #334155' }}>Item Name (Search / Select)</th>
                    <th style={{ padding: '6px 4px', width: '60px', textAlign: 'center', borderRight: '1px solid #334155' }}>Qty</th>
                    <th style={{ padding: '6px 4px', width: '65px', textAlign: 'center', borderRight: '1px solid #334155' }}>Total Qty</th>
                    <th style={{ padding: '6px 6px', width: '80px', textAlign: 'right', borderRight: '1px solid #334155' }}>Rate (Rs)</th>
                    <th style={{ padding: '6px 6px', width: '90px', textAlign: 'right', borderRight: '1px solid #334155' }}>Gross Amt</th>
                    <th style={{ padding: '6px 4px', width: '65px', textAlign: 'center', borderRight: '1px solid #334155' }}>Disc %</th>
                    <th style={{ padding: '6px 4px', width: '40px', textAlign: 'center' }}>Act</th>
                  </tr>
                </thead>

                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '4px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>

                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="text"
                          value={item.barCode || ''}
                          onChange={e => updateCartRow(idx, 'barCode', e.target.value)}
                          style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '2px 4px', position: 'relative' }}>
                        <input
                          type="text"
                          value={activeAutocompleteRow === idx ? autocompleteText : item.productName}
                          onFocus={() => { setActiveAutocompleteRow(idx); setAutocompleteText(item.productName); }}
                          onChange={e => {
                            setAutocompleteText(e.target.value);
                            updateCartRow(idx, 'productName', e.target.value);
                          }}
                          style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />

                        {activeAutocompleteRow === idx && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                            background: '#ffffff', border: '1px solid #0284c7', borderRadius: '3px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '180px', overflowY: 'auto'
                          }}>
                            {autocompleteMatchingProducts.map(p => (
                              <div
                                key={p.id}
                                onClick={() => selectProductForGridRow(p, idx)}
                                style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'}
                                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                              >
                                <span style={{ fontWeight: 600 }}>{p.productName}</span>
                                <span style={{ color: '#0284c7' }}>Rs. {(p.salePrice || 0).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          min="1"
                          value={item.cartQuantity}
                          onChange={e => updateCartRow(idx, 'cartQuantity', e.target.value)}
                          style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          min="1"
                          value={item.totalQty}
                          onChange={e => updateCartRow(idx, 'totalQty', e.target.value)}
                          style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={e => updateCartRow(idx, 'rate', e.target.value)}
                          style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={item.grossAmount}
                          onChange={e => updateCartRow(idx, 'grossAmount', e.target.value)}
                          style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={e => updateCartRow(idx, 'discountPercent', e.target.value)}
                          style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                        <button onClick={() => removeCartRow(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* BOTTOM NEW ENTRY ROW */}
                  <tr style={{ background: '#ecfdf5', borderTop: '2px solid #10b981' }}>
                    <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: '#10b981' }}>+</td>
                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="text"
                        placeholder="Bar Code..."
                        value={activeAutocompleteRow === 'NEW' ? autocompleteText : ''}
                        onFocus={() => { setActiveAutocompleteRow('NEW'); setAutocompleteText(''); }}
                        onChange={e => setAutocompleteText(e.target.value)}
                        style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontFamily: 'monospace', border: '1px solid #10b981', borderRadius: '2px', outline: 'none', background: '#ffffff' }}
                      />
                    </td>
                    <td style={{ padding: '2px 4px', position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Type Item Name to Add..."
                        value={activeAutocompleteRow === 'NEW' ? autocompleteText : ''}
                        onFocus={() => { setActiveAutocompleteRow('NEW'); setAutocompleteText(''); }}
                        onChange={e => setAutocompleteText(e.target.value)}
                        style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontWeight: 600, border: '1px solid #10b981', borderRadius: '2px', outline: 'none', background: '#ffffff' }}
                      />

                      {activeAutocompleteRow === 'NEW' && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                          background: '#ffffff', border: '1px solid #10b981', borderRadius: '3px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '180px', overflowY: 'auto'
                        }}>
                          {autocompleteMatchingProducts.map(p => (
                            <div
                              key={p.id}
                              onClick={() => selectProductForGridRow(p, 'NEW')}
                              style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#d1fae5'}
                              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                            >
                              <span style={{ fontWeight: 600 }}>{p.productName} ({p.barCode || p.productCode})</span>
                              <span style={{ color: '#059669' }}>Rs. {(p.salePrice || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="1" style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="1" style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="Rate" style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="Gross" style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="0%" style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', fontSize: '10px', color: '#059669', fontWeight: 700 }}>Auto</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================== */}
          {/* RIGHT PANE: ORDER SUMMARY SIDEBAR          */}
          {/* ========================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
            
            <div style={{ padding: '6px 8px', background: '#0f172a', color: '#ffffff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Booking Summary
            </div>

            <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', background: '#f8fafc' }}>
              
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Gross Amount</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Rs. {grossTotal.toLocaleString()}</span>
              </div>

              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>Loss / Overall Disc %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={lossPercent}
                  onChange={e => setLossPercent(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                />
              </div>

              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Net Value</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0284c7' }}>Rs. {netValue.toLocaleString()}</span>
              </div>

              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>Expense (Freight/Misc)</label>
                <input
                  type="number"
                  min="0"
                  value={expense}
                  onChange={e => setExpense(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                />
              </div>

              <div style={{ background: '#0f172a', color: '#ffffff', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>Total Order Value</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#38bdf8' }}>Rs. {totalAmount.toLocaleString()}</div>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px' }}>
                  {(['Cash', 'Card', 'Credit / Unpaid'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMethod(mode)}
                      style={{
                        padding: '4px 2px', fontSize: '9px', fontWeight: 700,
                        background: paymentMethod === mode ? '#0284c7' : '#ffffff',
                        color: paymentMethod === mode ? '#ffffff' : '#334155',
                        border: '1px solid', borderColor: paymentMethod === mode ? '#0284c7' : '#cbd5e1',
                        borderRadius: '2px', cursor: 'pointer'
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '3px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>Advance Payment (Rs)</label>
                <input
                  type="number"
                  value={advancePayment}
                  onChange={e => setAdvancePayment(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  style={{ width: '100%', height: '26px', padding: '2px 6px', fontSize: '13px', fontWeight: 700, border: '1px solid #0284c7', borderRadius: '2px', outline: 'none' }}
                />
              </div>

              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Balance Due</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                  Rs. {Math.abs(balanceDue).toLocaleString()}
                </span>
              </div>

            </div>

            {/* ACTION BUTTONS AT BOTTOM */}
            <div style={{ padding: '6px', background: '#e2e8f0', borderTop: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                onClick={handleBookOrder}
                disabled={isSubmitting || cart.length === 0}
                style={{
                  width: '100%', padding: '8px', fontSize: '13px', fontWeight: 800,
                  background: cart.length === 0 || isSubmitting ? '#cbd5e1' : '#16a34a',
                  color: '#ffffff', border: 'none', borderRadius: '3px',
                  cursor: cart.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                  boxShadow: cart.length === 0 ? 'none' : '0 2px 6px rgba(22, 163, 74, 0.3)'
                }}
              >
                <PackageCheck size={14} /> {isSubmitting ? 'Booking Order...' : 'BOOK ORDER'}
              </button>

              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                style={{
                  width: '100%', padding: '5px', fontSize: '10px', fontWeight: 700, background: '#dc2626', color: '#ffffff',
                  border: 'none', borderRadius: '2px', cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px'
                }}
              >
                <RotateCcw size={10} /> Clear Order Form
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ADD FINANCIAL HEAD MODAL */}
      {showAddFinHeadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '350px', padding: '16px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Add New Financial Head</h3>
              <button onClick={() => setShowAddFinHeadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateFinHead}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Financial Head Name *</label>
                <input required type="text" placeholder="e.g. COUNTER 2, BANK HBL, EXPENSE CASH" value={newFinHeadName} onChange={e => setNewFinHeadName(e.target.value)} style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '6px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                Save & Select Head
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '350px', padding: '16px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Add New Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Customer Name *</label>
                <input required type="text" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Phone Number</label>
                <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '6px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                Save Customer
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default BookingSheet;
