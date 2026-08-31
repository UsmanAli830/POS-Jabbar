import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, X, User, Barcode, CheckCircle, RotateCcw, Pause, ChevronLeft, ChevronRight, History, ReceiptText } from 'lucide-react';
import TimeclockModal from '../components/TimeclockModal';
import Receipt from '../components/Receipt';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import type { ReceiptType, ReceiptData } from '../components/ReceiptDocument';
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
  cashDiscount: number;
  discountOrder?: 'PERCENT_FIRST' | 'CASH_FIRST' | null;
  discountAmount: number;
  netAmount: number;
  totalQty: number;
  appliedPromoName?: string;
  bonusQty?: number;
};

const POSRegister: React.FC = () => {
  const { token, user } = useAuth();
  // Master & Core State
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activePromotions, setActivePromotions] = useState<any[]>([]);

  // Phase 29: Bi-directional Collapsible Left Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Phase 30: History Panel State (Right Column Placement)
  const [selectedCartRowIndex, setSelectedCartRowIndex] = useState<number | null>(null);
  const [historyMode, setHistoryMode] = useState<'CUSTOMER_PRODUCT' | 'ALL_RECORDS'>('CUSTOMER_PRODUCT');
  const [bottomHistoryList, setBottomHistoryList] = useState<any[]>([]);

  // Header State
  const [searchParams] = useSearchParams();
  const urlCustomerId = searchParams.get('customerId');
  const [customerId, setCustomerId] = useState<number | ''>(urlCustomerId ? Number(urlCustomerId) : '');
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [customers, setCustomers] = useState<{ id: number; name: string; custName?: string; liveBalance?: number; CurrentBalance?: number }[]>([]);
  const [customerLocations, setCustomerLocations] = useState<any[]>([]);
  const [customerLocationId, setCustomerLocationId] = useState<number | ''>('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  
  const [salesmanId, setSalesmanId] = useState<number | ''>('');
  const [booker, setBooker] = useState<string>('');
  const [refNumber, setRefNumber] = useState<string>(`INV-${Date.now().toString().slice(-6)}`);
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [creditTillDate, setCreditTillDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Right Pane Financial State
  const [lossPercent, setLossPercent] = useState<number | ''>(0);
  const [cashDiscount, setCashDiscount] = useState<number | ''>('');
  const [discountOrder, setDiscountOrder] = useState<'PERCENT_FIRST' | 'CASH_FIRST' | null>(null);
  const [expense, setExpense] = useState<number | ''>(0);
  const [paymentReceived, setPaymentReceived] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Credit / Unpaid'>('Cash');
  const [finHeadId, setFinHeadId] = useState<number | ''>('');
  const [finHeads, setFinHeads] = useState<any[]>([]);

  // Modals & UI Toggles
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', initialBalance: '' });
  const [showAddFinHeadModal, setShowAddFinHeadModal] = useState(false);
  const [newFinHeadName, setNewFinHeadName] = useState('');
  const [newFinHeadType, setNewFinHeadType] = useState('Asset');
  const [selectedInvoiceIdForModal, setSelectedInvoiceIdForModal] = useState<string | number | null>(null);
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [heldTickets, setHeldTickets] = useState<{ id: string; date: string; cart: CartItem[]; customerId: number | '' }[]>([]);
  const [isInvoiceLocked, setIsInvoiceLocked] = useState<boolean>(false);

  // Combobox / Autocomplete state for detail grid
  const [activeAutocompleteRow, setActiveAutocompleteRow] = useState<number | 'NEW' | null>(null);
  const [autocompleteText, setAutocompleteText] = useState<string>('');
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Settings & Scan state
  const { settings } = useSettings();
  const allowNegativeStock = settings?.allowNegativeStock ?? false;
  const [printData, setPrintData] = useState<any>(null);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; type: ReceiptType; data: ReceiptData }>({ isOpen: false, type: 'sale', data: {} });
  const [scanToast, setScanToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Scanner Hook Audio Beep
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

  // Initial Fetching
  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchMasterData();
    fetchPromotions();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const fetchPromotions = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/promotions');
      if (res.ok) {
        const data = await res.json();
        setActivePromotions(data.filter((p: any) => p.isActive && !p.isExpired));
      }
    } catch (e) {
      console.error('Failed to fetch promotions', e);
    }
  };

  const evaluatePromoForCartItem = (prod: Product, qty: number) => {
    if (activePromotions.length === 0) return { discPct: 0, cashDisc: 0, bonus: 0, promoName: undefined };

    const now = new Date();
    let bestPromo: any = null;
    let maxBenefit = -1;

    for (const offer of activePromotions) {
      if (!offer.isActive) continue;
      if (new Date(offer.endDate) < now) continue;

      let isMatch = false;
      if (offer.targetType === 'ALL_PRODUCTS') isMatch = true;
      else if (offer.targetType === 'CATEGORY' && (prod.categoryId === offer.targetId || prod.pCatId === offer.targetId)) isMatch = true;
      else if (offer.targetType === 'PRODUCT' && prod.id === offer.targetId) isMatch = true;

      if (!isMatch) continue;
      if (qty < offer.conditionValue) continue;

      let benefit = offer.rewardValue;
      if (offer.offerType === 'BUY_X_GET_Y') benefit = offer.rewardValue * 100;

      if (benefit > maxBenefit) {
        maxBenefit = benefit;
        bestPromo = offer;
      }
    }

    if (bestPromo) {
      let discPct = 0;
      let cashDisc = 0;
      let bonus = 0;

      if (bestPromo.offerType === 'PERCENTAGE_DISCOUNT') {
        discPct = bestPromo.rewardValue;
      } else if (bestPromo.offerType === 'CASH_DISCOUNT' || bestPromo.offerType === 'MIN_QTY_DISCOUNT') {
        cashDisc = bestPromo.rewardValue;
      } else if (bestPromo.offerType === 'BUY_X_GET_Y') {
        bonus = Math.floor(qty / bestPromo.conditionValue) * bestPromo.rewardValue;
      }

      return {
        discPct,
        cashDisc,
        bonus,
        promoName: bestPromo.offerName
      };
    }

    return { discPct: 0, cashDisc: 0, bonus: 0, promoName: undefined };
  };

  // Customer Balance & Locations Fetch
  useEffect(() => {
    if (customerId) {
      fetchCustomerBalance(Number(customerId));
      fetchCustomerLocations(Number(customerId));
    } else {
      setCustomerBalance(null);
      setCustomerLocations([]);
      setCustomerLocationId('');
      setSelectedLocationIds([]);
    }
  }, [customerId]);

  const fetchCustomerLocations = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/customers/${id}/locations`);
      if (res.ok) {
        const data = await res.json();
        setCustomerLocations(data);
        if (data.length > 0) {
          setCustomerLocationId(data[0].id);
          setSelectedLocationIds([data[0].id]);
        } else {
          setCustomerLocationId('');
          setSelectedLocationIds([]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch customer locations', e);
    }
  };

  // Phase 30 Dynamic Bottom History Filtering Logic
  const selectedCartProduct = useMemo(() => {
    if (selectedCartRowIndex !== null && cart[selectedCartRowIndex]) {
      return cart[selectedCartRowIndex];
    }
    if (cart.length > 0) return cart[cart.length - 1];
    return null;
  }, [selectedCartRowIndex, cart]);

  const fetchBottomHistory = async () => {
    if (!customerId) {
      setBottomHistoryList([]);
      return;
    }

    try {
      let url = `http://localhost:3000/api/sales/customer-product-history?customerId=${customerId}`;
      if (historyMode === 'CUSTOMER_PRODUCT' && selectedCartProduct) {
        url += `&productId=${selectedCartProduct.id}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        setBottomHistoryList(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch bottom history', e);
    }
  };

  useEffect(() => {
    fetchBottomHistory();
  }, [customerId, historyMode, selectedCartProduct?.id]);

  // Click Outside Listener for Autocomplete Dropdown
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
      console.error('Failed to fetch products', e);
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
      console.error('Failed to fetch customers', e);
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

  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/sales/next-invoice-number');
      if (res.ok) {
        const data = await res.json();
        if (data.nextInvoiceNumber) {
          setRefNumber(data.nextInvoiceNumber);
        }
      }
    } catch (e) {
      console.error('Failed to fetch next invoice number', e);
    }
  };

  const fetchMasterData = async () => {
    try {
      fetchNextInvoiceNumber();
      const res = await fetch('http://localhost:3000/api/finance/heads');
      if (res.ok) {
        const heads = await res.json();
        setFinHeads(heads);
        if (heads.length > 0 && !finHeadId) setFinHeadId(heads[0].id);
      }
      const mRes = await fetch('http://localhost:3000/api/master-data');
      if (mRes.ok) {
        const data = await mRes.json();
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error('Failed master data fetch', e);
    }
  };

  const handleCreateFinHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinHeadName.trim()) return;
    try {
      const res = await fetch('http://localhost:3000/api/finance/heads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFinHeadName.trim(),
          headType: newFinHeadType
        })
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

  // Product List Filtering
  const filteredProducts = useMemo(() => {
    let list = products;
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase();
      list = list.filter(p =>
        (p.productName || '').toLowerCase().includes(q) ||
        (p.productCode || '').toLowerCase().includes(q) ||
        (p.barCode || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, productSearchQuery]);

  const autocompleteMatchingProducts = useMemo(() => {
    if (!autocompleteText.trim()) return products.slice(0, 15);
    const q = autocompleteText.toLowerCase();
    return products.filter(p =>
      (p.productName || '').toLowerCase().includes(q) ||
      (p.productCode || '').toLowerCase().includes(q) ||
      (p.barCode || '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [products, autocompleteText]);

  // Chart of Accounts Grouping
  const groupedFinHeads = useMemo(() => {
    const groups: Record<string, any[]> = {
      'Asset': [],
      'Liability': [],
      'Equity': [],
      'Income': [],
      'Expense': [],
      'Other': []
    };

    finHeads.forEach(fh => {
      const groupName = fh.finHeadMainGroup?.name || 'Other';
      if (groups[groupName]) {
        groups[groupName].push(fh);
      } else {
        groups['Other'].push(fh);
      }
    });

    return groups;
  }, [finHeads]);

  // Cart Operations
  const addProductToCart = (prod: Product) => {
    if (!allowNegativeStock && (prod.currentStock <= 0)) {
      showScanToast(`Out of stock: ${prod.productName}`, 'error');
      return;
    }

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === prod.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.cartQuantity + 1;
        const gross = newQty * item.rate;
        
        const promo = evaluatePromoForCartItem(item, newQty);
        const discPct = promo.promoName ? promo.discPct : (item.discountPercent || 0);
        const cashDisc = promo.promoName ? promo.cashDisc : (item.cashDiscount || 0);
        const order = item.discountOrder || (discPct && cashDisc ? 'PERCENT_FIRST' : (cashDisc ? 'CASH_FIRST' : (discPct ? 'PERCENT_FIRST' : null)));

        let net = gross;
        if (order === 'CASH_FIRST') {
          const subtotal = Math.max(0, gross - cashDisc);
          net = Math.max(0, subtotal - (subtotal * (discPct / 100)));
        } else if (order === 'PERCENT_FIRST') {
          const subtotal = Math.max(0, gross - (gross * (discPct / 100)));
          net = Math.max(0, subtotal - cashDisc);
        } else {
          if (discPct > 0) net = Math.max(0, gross - (gross * (discPct / 100)));
          else if (cashDisc > 0) net = Math.max(0, gross - cashDisc);
        }

        updated[existingIdx] = {
          ...item,
          cartQuantity: newQty,
          totalQty: (newQty + promo.bonus) * (item.packSize || 1),
          grossAmount: gross,
          discountPercent: discPct,
          cashDiscount: cashDisc,
          discountOrder: order,
          discountAmount: gross - net,
          netAmount: net,
          appliedPromoName: promo.promoName,
          bonusQty: promo.bonus
        };
        setSelectedCartRowIndex(existingIdx);
        return updated;
      }

      const rate = prod.salePrice || 0;
      const packSize = prod.packSize || 1;
      const gross = rate * 1;
      const promo = evaluatePromoForCartItem(prod, 1);
      const discPct = promo.discPct;
      const cashDisc = promo.cashDisc;
      let net = gross;
      if (discPct > 0) net = Math.max(0, gross - (gross * (discPct / 100)));
      else if (cashDisc > 0) net = Math.max(0, gross - cashDisc);

      const newCart = [
        ...prev,
        {
          ...prod,
          cartQuantity: 1,
          totalQty: (1 + promo.bonus) * packSize,
          rate,
          grossAmount: gross,
          discountPercent: discPct,
          cashDiscount: cashDisc,
          discountOrder: null,
          discountAmount: gross - net,
          netAmount: net,
          appliedPromoName: promo.promoName,
          bonusQty: promo.bonus
        }
      ];
      setSelectedCartRowIndex(newCart.length - 1);
      return newCart;
    });
  };

  const updateCartRow = (index: number, field: keyof CartItem, value: any) => {
    setSelectedCartRowIndex(index);
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

      let cashDisc = Number(updated.cashDiscount);
      if (isNaN(cashDisc) || cashDisc < 0) cashDisc = 0;

      if (field === 'cartQuantity' || field === 'totalQty') {
        const promo = evaluatePromoForCartItem(updated, qty);
        if (promo.promoName) {
          discPct = promo.discPct;
          cashDisc = promo.cashDisc;
          updated.appliedPromoName = promo.promoName;
          updated.bonusQty = promo.bonus;
        } else {
          updated.appliedPromoName = undefined;
          updated.bonusQty = 0;
        }
      }

      let newOrder = item.discountOrder || null;
      if (field === 'discountPercent') {
        if (discPct > 0 && !newOrder) {
          newOrder = 'PERCENT_FIRST';
        } else if (discPct === 0) {
          newOrder = cashDisc > 0 ? 'CASH_FIRST' : null;
        }
      } else if (field === 'cashDiscount') {
        if (cashDisc > 0 && !newOrder) {
          newOrder = 'CASH_FIRST';
        } else if (cashDisc === 0) {
          newOrder = discPct > 0 ? 'PERCENT_FIRST' : null;
        }
      }

      let net = gross;
      if (newOrder === 'CASH_FIRST') {
        const subtotal = Math.max(0, gross - cashDisc);
        net = Math.max(0, subtotal - (subtotal * (discPct / 100)));
      } else if (newOrder === 'PERCENT_FIRST') {
        const subtotal = Math.max(0, gross - (gross * (discPct / 100)));
        net = Math.max(0, subtotal - cashDisc);
      } else {
        if (discPct > 0) {
          net = Math.max(0, gross - (gross * (discPct / 100)));
        } else if (cashDisc > 0) {
          net = Math.max(0, gross - cashDisc);
        } else {
          net = gross;
        }
      }

      const discAmt = gross - net;

      return {
        ...updated,
        cartQuantity: qty,
        totalQty,
        rate,
        grossAmount: gross,
        discountPercent: discPct,
        cashDiscount: cashDisc,
        discountOrder: newOrder,
        discountAmount: discAmt,
        netAmount: net
      };
    }));
  };

  const removeCartRow = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    if (selectedCartRowIndex === index) setSelectedCartRowIndex(null);
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

        // Re-evaluate promotions for the newly selected product
        const promo = evaluatePromoForCartItem(prod, qty);
        const discPct = promo.promoName ? promo.discPct : (item.discountPercent || 0);
        const cashDisc = promo.promoName ? promo.cashDisc : (item.cashDiscount || 0);
        const order = promo.promoName
          ? (discPct && cashDisc ? 'PERCENT_FIRST' : (cashDisc ? 'CASH_FIRST' : (discPct ? 'PERCENT_FIRST' : null)))
          : (item.discountOrder || null);

        let net = gross;
        if (order === 'CASH_FIRST') {
          const subtotal = Math.max(0, gross - cashDisc);
          net = Math.max(0, subtotal - (subtotal * (discPct / 100)));
        } else if (order === 'PERCENT_FIRST') {
          const subtotal = Math.max(0, gross - (gross * (discPct / 100)));
          net = Math.max(0, subtotal - cashDisc);
        } else {
          if (discPct > 0) net = Math.max(0, gross - (gross * (discPct / 100)));
          else if (cashDisc > 0) net = Math.max(0, gross - cashDisc);
        }

        return {
          ...prod,
          cartQuantity: qty,
          totalQty: (qty + (promo.bonus || 0)) * (prod.packSize || 1),
          rate,
          grossAmount: gross,
          discountPercent: discPct,
          cashDiscount: cashDisc,
          discountOrder: order,
          discountAmount: gross - net,
          netAmount: net,
          appliedPromoName: promo.promoName,
          bonusQty: promo.bonus || 0
        };
      }));
      setSelectedCartRowIndex(rowIndex as number);
    }
    setActiveAutocompleteRow(null);
    setAutocompleteText('');
  };


  // Financial Calculations (Bi-directionally Synced Bill Discount)
  const gridNetTotal = useMemo(() => cart.reduce((sum, item) => sum + item.netAmount, 0), [cart]);
  const grossTotal = gridNetTotal;
  const itemDiscountsTotal = useMemo(() => cart.reduce((sum, item) => sum + item.discountAmount, 0), [cart]);
  const eligibleAmount = gridNetTotal;

  const handleLossPercentChange = (val: string) => {
    if (val === '') {
      setLossPercent('');
      if (cashDiscount === '' || Number(cashDiscount) === 0) {
        setDiscountOrder(null);
      } else {
        setDiscountOrder('CASH_FIRST');
      }
      return;
    }
    const pct = Math.min(100, Math.max(0, Number(val)));
    setLossPercent(pct);
    if (pct === 0) {
      if (cashDiscount === '' || Number(cashDiscount) === 0) {
        setDiscountOrder(null);
      } else {
        setDiscountOrder('CASH_FIRST');
      }
    } else {
      if (discountOrder === null) {
        setDiscountOrder('PERCENT_FIRST');
      }
    }
  };

  const handleCashDiscountChange = (val: string) => {
    if (val === '') {
      setCashDiscount('');
      if (lossPercent === '' || Number(lossPercent) === 0) {
        setDiscountOrder(null);
      } else {
        setDiscountOrder('PERCENT_FIRST');
      }
      return;
    }
    const amt = Math.max(0, Number(val));
    setCashDiscount(amt);
    if (amt === 0) {
      if (lossPercent === '' || Number(lossPercent) === 0) {
        setDiscountOrder(null);
      } else {
        setDiscountOrder('PERCENT_FIRST');
      }
    } else {
      if (discountOrder === null) {
        setDiscountOrder('CASH_FIRST');
      }
    }
  };

  const netValue = useMemo(() => {
    const gross = eligibleAmount;
    const discPct = Number(lossPercent) || 0;
    const cashDisc = Number(cashDiscount) || 0;

    if (discountOrder === 'CASH_FIRST') {
      const subtotal = Math.max(0, gross - cashDisc);
      return Math.max(0, subtotal - (subtotal * (discPct / 100)));
    } else if (discountOrder === 'PERCENT_FIRST') {
      const subtotal = Math.max(0, gross - (gross * (discPct / 100)));
      return Math.max(0, subtotal - cashDisc);
    } else {
      if (discPct > 0) {
        return Math.max(0, gross - (gross * (discPct / 100)));
      }
      if (cashDisc > 0) {
        return Math.max(0, gross - cashDisc);
      }
      return gross;
    }
  }, [eligibleAmount, lossPercent, cashDiscount, discountOrder]);
  const totalAmount = useMemo(() => netValue + (Number(expense) || 0), [netValue, expense]);

  const isCreditSale = paymentMethod === 'Credit / Unpaid';
  const cashPaid = isCreditSale ? (Number(paymentReceived) || 0) : totalAmount;
  const changeDue = useMemo(() => {
    return (Number(paymentReceived) || 0) - totalAmount;
  }, [paymentReceived, totalAmount]);

  // Ticket Holding Operations
  const holdTicket = () => {
    if (cart.length === 0) return;
    const ticket = {
      id: `TKT-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleTimeString(),
      cart: [...cart],
      customerId
    };
    setHeldTickets(prev => [...prev, ticket]);
    setCart([]);
    fetchNextInvoiceNumber();
    showScanToast(`Ticket ${ticket.id} Held Successfully`, 'success');
  };

  // Complete Sale / Checkout Handler
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('Cannot complete sale: Sales grid is empty!');
      return;
    }
    if (isCreditSale && !customerId) {
      alert('Customer selection is required for Credit / Unpaid sales!');
      return;
    }

    setIsCheckingOut(true);
    try {
      const payload = {
        items: cart.map(item => ({
          productId: item.id,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.cartQuantity,
          unitPrice: item.rate,
          totalPrice: item.netAmount,
          discountAmount: item.discountAmount,
          discPercent: item.discountPercent || 0,
          cashDiscount: item.cashDiscount || 0,
          grossAmount: item.grossAmount,
          discountOrder: item.discountOrder
        })),
        customerId: customerId || undefined,
        customerLocationId: selectedLocationIds.length > 0 ? selectedLocationIds[0] : (customerLocationId || undefined),
        locationIds: selectedLocationIds,
        customerLocationIds: selectedLocationIds,
        subtotal: grossTotal,
        discountAmount: itemDiscountsTotal + (eligibleAmount - netValue),
        taxAmount: 0,
        total: totalAmount,
        paymentMethod,
        paymentReceived: cashPaid,
        finHeadId: finHeadId || undefined,
        refNumber
      };

      const res = await fetch('http://localhost:3000/api/sales', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saleData = await res.json();
        
        // Construct detailed metadata for Receipt Modal
        const selectedCust = customers.find(c => c.id === Number(customerId));
        const custName = selectedCust?.name || selectedCust?.custName || 'Walk-in Customer';
        
        const salesmanName = user?.name || '';
        
        const locNames = customerLocations
          .filter(l => selectedLocationIds.includes(l.id))
          .map(l => l.locationName);

        // Auto-Popup Receipt Modal Phase 49
        setReceiptModal({
          isOpen: true,
          type: 'sale',
          data: {
            invoiceNumber: saleData.invoiceNumber || refNumber || `INV-${saleData.id}`,
            date: new Date().toLocaleString(),
            customerName: custName,
            locations: locNames.length > 0 ? locNames : undefined,
            salesmanName: salesmanName || undefined,
            bookerName: booker || undefined,
            paymentMethod,
            refNumber,
            items: cart.map((item, idx) => ({
              sr: idx + 1,
              name: item.productName,
              qty: item.cartQuantity,
              rate: item.rate,
              discPercent: item.discountPercent || 0,
              cashDisc: item.cashDiscount || 0,
              netAmount: item.netAmount
            })),
            grossAmount: grossTotal,
            totalDiscount: itemDiscountsTotal + (eligibleAmount - netValue),
            netPayable: totalAmount,
            amountReceived: cashPaid,
            changeReturn: changeDue > 0 ? changeDue : 0,
            balanceDue: isCreditSale ? Math.max(0, totalAmount - cashPaid) : 0,
            storeName: settings?.storeName || 'Ammad Sanitary',
            storeAddress: settings?.storeAddress || 'Main Wholesale Market, G.T. Road',
            receiptFooter: settings?.receiptFooter || 'Thank you for your business! — Ammad Sanitary'
          }
        });

        // Reset Cart & Form
        setCart([]);
        setSelectedCartRowIndex(null);
        setSelectedLocationIds([]);
        fetchNextInvoiceNumber();
        setRemarks('');
        setLossPercent(0);
        setCashDiscount('');
        setDiscountOrder(null);
        setExpense(0);
        setPaymentReceived('');

        // Real-Time Customer Balance & Bottom History Refresh
        fetchCustomers();
        if (customerId) {
          fetchCustomerBalance(Number(customerId));
          fetchBottomHistory();
        }
        fetchProducts();
      } else {
        const err = await res.json();
        alert('Transaction Error: ' + (err.error || 'Failed to complete sale'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error while completing transaction.');
    } finally {
      setIsCheckingOut(false);
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

      {/* HIDDEN PRINTABLE RECEIPT COMPONENT */}
      {printData && (
        <div style={{ display: 'none' }}>
          <Receipt data={printData} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN 3-PANE POS LAYOUT (LEFT SIDEBAR | CENTER GRID | RIGHT SUMMARY & HISTORY) */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isSidebarOpen ? '230px 1fr 290px' : '32px 1fr 290px',
        gap: '6px',
        height: '100%',
        minHeight: 0,
        transition: 'grid-template-columns 0.2s ease'
      }}>

        {/* LEFT PANE: PRODUCT LIST SIDEBAR WITH BI-DIRECTIONAL TOGGLE */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {isSidebarOpen ? (
            /* EXPANDED PRODUCT LIST VIEW */
            <>
              <div style={{ padding: '6px 8px', background: '#0f172a', color: '#f8fafc', fontSize: '11px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Products List ({filteredProducts.length})</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  title="Collapse Product List Sidebar"
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <div style={{ padding: '4px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search Product / Code / Barcode..."
                    value={productSearchQuery}
                    onChange={e => setProductSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '4px 6px 4px 22px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* FULL HEIGHT PRODUCT CARDS LIST */}
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
                    <div style={{ fontWeight: 700, fontSize: '11px', color: '#0f172a', lineHeight: '1.2' }}>{prod.productName}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
                      <span>Rs. {(prod.salePrice || 0).toLocaleString()}</span>
                      <span style={{ fontWeight: 700, color: (prod.currentStock || 0) > 0 ? '#16a34a' : '#dc2626' }}>
                        Stk: {prod.currentStock || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* COLLAPSED PINNED STRIP WITH RE-EXPAND BUTTON */
            <div
              onClick={() => setIsSidebarOpen(true)}
              title="Click to Expand Product List Sidebar"
              style={{
                height: '100%', background: '#0f172a', display: 'flex', flexDirection: 'column',
                alignItems: 'center', paddingTop: '8px', cursor: 'pointer'
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
                title="Expand Products List"
                style={{ background: '#0284c7', border: 'none', color: '#ffffff', padding: '6px 4px', borderRadius: '3px', cursor: 'pointer' }}
              >
                <ChevronRight size={18} />
              </button>
              <div style={{ writingMode: 'vertical-rl', textTransform: 'uppercase', fontSize: '10px', fontWeight: 800, color: '#38bdf8', marginTop: '16px', letterSpacing: '1.5px' }}>
                Products Sidebar
              </div>
            </div>
          )}
        </div>

        {/* CENTER PANE: HEADER & SALES DETAIL GRID */}
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
                  disabled={isInvoiceLocked}
                  style={{ 
                    width: '100%', height: '26px', padding: '2px 4px', fontSize: '11px', fontWeight: 600, 
                    border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none',
                    background: isInvoiceLocked ? '#e2e8f0' : '#ffffff',
                    color: isInvoiceLocked ? '#64748b' : '#0f172a',
                    cursor: isInvoiceLocked ? 'not-allowed' : 'default'
                  }}
                  title={isInvoiceLocked ? "Customer selector locked for loaded invoice" : "Select customer"}
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

              {/* Ref# */}
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Ref #</label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={e => setRefNumber(e.target.value)}
                  style={{ width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                />
              </div>
            </div>

            {/* ROW 2: Sale Date, Credit Till Date, Ship To, Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  style={{ width: '100%', height: '26px', padding: '2px 4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Credit Till</label>
                <input
                  type="date"
                  value={creditTillDate}
                  onChange={e => setCreditTillDate(e.target.value)}
                  style={{ width: '100%', height: '26px', padding: '2px 4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                />
              </div>

              <div style={{ minWidth: '150px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>
                  Delivery Locations {selectedLocationIds.length > 0 && `(${selectedLocationIds.length})`}
                </label>
                {!customerId ? (
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', height: '26px', display: 'flex', alignItems: 'center' }}>
                    Select customer first
                  </div>
                ) : customerLocations.length === 0 ? (
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', height: '26px', display: 'flex', alignItems: 'center' }}>
                    No saved locations
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxHeight: '54px', overflowY: 'auto', padding: '1px' }}>
                    {customerLocations.map(loc => {
                      const isSelected = selectedLocationIds.includes(loc.id);
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedLocationIds(selectedLocationIds.filter(id => id !== loc.id));
                            } else {
                              setSelectedLocationIds([...selectedLocationIds, loc.id]);
                            }
                          }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: '10px',
                            border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                            background: isSelected ? '#e0f2fe' : '#ffffff',
                            color: isSelected ? '#0369a1' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            height: '22px'
                          }}
                        >
                          {isSelected && <span style={{ fontWeight: 800 }}>✓</span>}
                          {loc.locationName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Order notes / comments..."
                  style={{ width: '100%', height: '26px', padding: '2px 6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* MAIN SALES DETAIL GRID (CENTER PANE) */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }} ref={autocompleteRef}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#1e293b', color: '#ffffff', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '6px 4px', width: '35px', textAlign: 'center', borderRight: '1px solid #334155' }}>Sr#</th>
                  <th style={{ padding: '6px 6px', width: '90px', borderRight: '1px solid #334155' }}>Bar Code</th>
                  <th style={{ padding: '6px 6px', borderRight: '1px solid #334155' }}>Item Name (Search / Select)</th>
                  <th style={{ padding: '6px 4px', width: '55px', textAlign: 'center', borderRight: '1px solid #334155' }}>Qty</th>
                  <th style={{ padding: '6px 4px', width: '55px', textAlign: 'center', borderRight: '1px solid #334155' }}>Total Qty</th>
                  <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right', borderRight: '1px solid #334155' }}>Rate (Rs)</th>
                  <th style={{ padding: '6px 6px', width: '80px', textAlign: 'right', borderRight: '1px solid #334155' }}>Gross Amt</th>
                  <th style={{ padding: '6px 4px', width: '55px', textAlign: 'center', borderRight: '1px solid #334155' }}>Disc %</th>
                  <th style={{ padding: '6px 4px', width: '75px', textAlign: 'center', borderRight: '1px solid #334155' }}>Cash Disc (Rs)</th>
                  <th style={{ padding: '6px 6px', width: '85px', textAlign: 'right', borderRight: '1px solid #334155' }}>Net Amt</th>
                  <th style={{ padding: '6px 4px', width: '40px', textAlign: 'center' }}>Act</th>
                </tr>
              </thead>

              <tbody>
                {cart.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedCartRowIndex(idx)}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: selectedCartRowIndex === idx ? '#e0f2fe' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '4px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="text"
                        value={item.barCode || ''}
                        onChange={e => updateCartRow(idx, 'barCode', e.target.value)}
                        onFocus={() => setSelectedCartRowIndex(idx)}
                        style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px', position: 'relative' }}>
                      <input
                        type="text"
                        value={activeAutocompleteRow === idx ? autocompleteText : item.productName}
                        onFocus={() => { setActiveAutocompleteRow(idx); setAutocompleteText(item.productName); setSelectedCartRowIndex(idx); }}
                        onChange={e => {
                          setAutocompleteText(e.target.value);
                          updateCartRow(idx, 'productName', e.target.value);
                        }}
                        style={{ width: '100%', height: '24px', padding: '2px 4px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />

                      {item.appliedPromoName && (
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '3px', padding: '1px 5px', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          ✨ {item.appliedPromoName} Applied
                          {item.bonusQty ? ` (+${item.bonusQty} Free)` : ''}
                        </div>
                      )}

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
                        onChange={e => {
                          const val = e.target.value;
                          updateCartRow(idx, 'cartQuantity', val === '' ? '' : Number(val));
                        }}
                        onFocus={e => {
                          e.target.select();
                          setSelectedCartRowIndex(idx);
                        }}
                        onBlur={e => {
                          if (e.target.value === '' || Number(e.target.value) <= 0) {
                            updateCartRow(idx, 'cartQuantity', 1);
                          }
                        }}
                        style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="number"
                        min="1"
                        value={item.totalQty}
                        onChange={e => {
                          const val = e.target.value;
                          updateCartRow(idx, 'totalQty', val === '' ? '' : Number(val));
                        }}
                        onFocus={e => {
                          e.target.select();
                          setSelectedCartRowIndex(idx);
                        }}
                        onBlur={e => {
                          if (e.target.value === '' || Number(e.target.value) <= 0) {
                            updateCartRow(idx, 'totalQty', 1);
                          }
                        }}
                        style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={e => {
                          const val = e.target.value;
                          updateCartRow(idx, 'rate', val === '' ? '' : Number(val));
                        }}
                        onFocus={e => {
                          e.target.select();
                          setSelectedCartRowIndex(idx);
                        }}
                        onBlur={e => {
                          if (e.target.value === '') {
                            updateCartRow(idx, 'rate', 0);
                          }
                        }}
                        style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.grossAmount}
                        onChange={e => {
                          const val = e.target.value;
                          updateCartRow(idx, 'grossAmount', val === '' ? '' : Number(val));
                        }}
                        onFocus={e => {
                          e.target.select();
                          setSelectedCartRowIndex(idx);
                        }}
                        onBlur={e => {
                          if (e.target.value === '') {
                            updateCartRow(idx, 'grossAmount', 0);
                          }
                        }}
                        style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent || ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateCartRow(idx, 'discountPercent', val === '' ? 0 : Number(val));
                        }}
                        onFocus={e => {
                          e.target.select();
                          setSelectedCartRowIndex(idx);
                        }}
                        onBlur={e => {
                          if (e.target.value === '') {
                            updateCartRow(idx, 'discountPercent', 0);
                          }
                        }}
                        style={{ width: '100%', height: '24px', textAlign: 'center', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.cashDiscount || ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateCartRow(idx, 'cashDiscount', val === '' ? 0 : Number(val));
                        }}
                        onFocus={e => {
                          e.target.select();
                          setSelectedCartRowIndex(idx);
                        }}
                        onBlur={e => {
                          if (e.target.value === '') {
                            updateCartRow(idx, 'cashDiscount', 0);
                          }
                        }}
                        placeholder="0"
                        style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                      />
                    </td>

                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        disabled
                        value={item.netAmount}
                        style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', fontWeight: 800, border: '1px solid #93c5fd', borderRadius: '2px', outline: 'none', background: '#eff6ff', color: '#1e40af' }}
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
                  <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="0" style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                  <td style={{ padding: '2px 4px' }}><input type="text" disabled placeholder="Net" style={{ width: '100%', height: '24px', textAlign: 'right', fontSize: '11px', border: '1px solid #a7f3d0', borderRadius: '2px', background: '#f0fdf4' }} /></td>
                  <td style={{ padding: '2px 4px', textAlign: 'center', fontSize: '10px', color: '#059669', fontWeight: 700 }}>Auto</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT PANE: SALES SUMMARY, FINANCIAL HEADS, AND HISTORICAL PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
          
          <div style={{ padding: '6px 8px', background: '#0f172a', color: '#ffffff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sale Summary
          </div>

          <div style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', background: '#f8fafc' }}>
            
            {/* GROSS AMOUNT */}
            <div style={{ background: '#ffffff', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>Gross Amount</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>Rs. {grossTotal.toLocaleString()}</span>
            </div>

            {/* LOSS % AND CASH DISCOUNT (RS) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div style={{ background: '#ffffff', padding: '3px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '1px' }}>Loss / Disc %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={lossPercent}
                  onChange={e => handleLossPercentChange(e.target.value)}
                  onFocus={e => e.target.select()}
                  onBlur={e => { if (e.target.value === '') handleLossPercentChange(''); }}
                  placeholder="0%"
                  style={{ width: '100%', height: '20px', padding: '2px 4px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
                />
              </div>

              <div style={{ background: '#ffffff', padding: '3px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                <label style={{ fontSize: '9px', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '1px' }}>Cash Disc (Rs)</label>
                <input
                  type="number"
                  min="0"
                  value={cashDiscount}
                  onChange={e => handleCashDiscountChange(e.target.value)}
                  onFocus={e => e.target.select()}
                  onBlur={e => { if (e.target.value === '') handleCashDiscountChange(''); }}
                  placeholder="0.00"
                  style={{ width: '100%', height: '20px', padding: '2px 4px', fontSize: '10px', fontWeight: 700, border: '1px solid #0284c7', borderRadius: '2px', outline: 'none' }}
                />
              </div>
            </div>

            {discountOrder && (
              <div style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', textAlign: 'right', marginTop: '-2px', marginBottom: '1px' }}>
                <span className="text-[10px] text-gray-400">
                  Order: {discountOrder === 'PERCENT_FIRST' ? '% applied first' : 'Cash (Rs) applied first'}
                </span>
              </div>
            )}

            {/* NET VALUE */}
            <div style={{ background: '#ffffff', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>Net Value</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>Rs. {netValue.toLocaleString()}</span>
            </div>

            {/* EXPENSE */}
            <div style={{ background: '#ffffff', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '1px' }}>Expense (Freight/Misc)</label>
              <input
                type="number"
                min="0"
                value={expense || ''}
                onChange={e => setExpense(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={e => { if (e.target.value === '') setExpense(0); }}
                placeholder="0.00"
                style={{ width: '100%', height: '20px', padding: '2px 4px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
              />
            </div>

            {/* TOTAL AMOUNT */}
            <div style={{ background: '#0f172a', color: '#ffffff', padding: '4px', borderRadius: '3px', textAlign: 'center' }}>
              <div style={{ fontSize: '8px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>Total Payable</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8' }}>Rs. {totalAmount.toLocaleString()}</div>
            </div>

            {/* FINANCIAL HEAD DROPDOWN */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' }}>
                <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155' }}>Financial Head</label>
                <button onClick={() => setShowAddFinHeadModal(true)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '8px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  + New
                </button>
              </div>
              <select
                value={finHeadId}
                onChange={e => setFinHeadId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ width: '100%', height: '22px', padding: '1px 4px', fontSize: '10px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '2px', outline: 'none' }}
              >
                {Object.entries(groupedFinHeads).map(([groupName, heads]) => {
                  if (heads.length === 0) return null;
                  return (
                    <optgroup key={groupName} label={`--- ${groupName.toUpperCase()} ---`}>
                      {heads.map(fh => (
                        <option key={fh.id} value={fh.id}>{fh.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            {/* PAYMENT MODE SELECTOR */}
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>Payment Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px' }}>
                {(['Cash', 'Card', 'Credit / Unpaid'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMethod(mode)}
                    style={{
                      padding: '2px 1px', fontSize: '8px', fontWeight: 700,
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

            {/* CASH RECEIVED INPUT */}
            <div style={{ background: '#ffffff', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '3px' }}>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '1px' }}>
                {isCreditSale ? 'Cash Paid Now' : 'Cash Received'}
              </label>
              <input
                type="number"
                value={paymentReceived}
                onChange={e => setPaymentReceived(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                placeholder={isCreditSale ? '0.00' : totalAmount.toString()}
                style={{ width: '100%', height: '22px', padding: '2px 6px', fontSize: '11px', fontWeight: 700, border: '1px solid #0284c7', borderRadius: '2px', outline: 'none' }}
              />
            </div>

            {/* CHANGE DUE BADGE */}
            <div style={{ background: '#ffffff', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: '#64748b' }}>
                {isCreditSale ? 'Remaining Debt' : 'Change Return'}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: isCreditSale ? '#dc2626' : (changeDue >= 0 ? '#16a34a' : '#dc2626') }}>
                Rs. {isCreditSale ? Math.max(0, totalAmount - (Number(paymentReceived) || 0)).toLocaleString() : Math.max(0, changeDue).toLocaleString()}
              </span>
            </div>

          </div>

          {/* ACTION BUTTONS */}
          <div style={{ padding: '6px 8px', background: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <button
              onClick={handleCompleteSale}
              disabled={isCheckingOut || cart.length === 0}
              className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-2 px-4 rounded-md shadow-sm transition-all duration-150 flex items-center justify-center gap-2 text-xs w-full"
              style={{
                background: cart.length === 0 || isCheckingOut ? '#cbd5e1' : '#0088cc',
                cursor: cart.length === 0 || isCheckingOut ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle size={14} className="text-white" /> {isCheckingOut ? 'Processing...' : 'COMPLETE SALE (F10)'}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <button
                onClick={holdTicket}
                disabled={cart.length === 0}
                className="bg-[#1e293b] hover:bg-[#334155] text-slate-200 font-semibold py-1.5 px-2 rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 text-[11px]"
                style={{ cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                <Pause size={12} className="text-amber-400" /> Hold Invoice
              </button>

              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="bg-[#1e293b] hover:bg-[#334155] text-slate-200 font-semibold py-1.5 px-2 rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 text-[11px]"
                style={{ cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                <RotateCcw size={12} className="text-rose-400" /> Clear Grid
              </button>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* PHASE 30: EXACT HISTORY PANEL RECREATION (PLACED IN RIGHT COLUMN AT BOTTOM) */}
          {/* ========================================================================= */}
          <div style={{
            height: '210px',
            borderTop: '2px solid #0f172a',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* HEADER WITH EXACT CHECKBOX CONTROLS */}
            <div style={{ padding: '4px 6px', background: '#0f172a', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9px', fontWeight: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={historyMode === 'CUSTOMER_PRODUCT'}
                    onChange={() => setHistoryMode(prev => prev === 'CUSTOMER_PRODUCT' ? 'ALL_RECORDS' : 'CUSTOMER_PRODUCT')}
                    style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                  />
                  Customer wise Product History
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={historyMode === 'ALL_RECORDS'}
                    onChange={() => setHistoryMode(prev => prev === 'ALL_RECORDS' ? 'CUSTOMER_PRODUCT' : 'ALL_RECORDS')}
                    style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                  />
                  All Record
                </label>
              </div>

              {historyMode === 'CUSTOMER_PRODUCT' && selectedCartProduct && (
                <div style={{ fontSize: '8px', color: '#38bdf8', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  Item: "{selectedCartProduct.productName}"
                </div>
              )}
            </div>

            {/* HISTORICAL DENSE DATA GRID (4 COLUMNS: Dt Date, Inv #, Qty, Rate) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1e293b', color: '#ffffff', zIndex: 5 }}>
                  <tr>
                    <th style={{ padding: '3px 4px', borderRight: '1px solid #334155' }}>Dt Date</th>
                    <th style={{ padding: '3px 4px', borderRight: '1px solid #334155' }}>Inv #</th>
                    <th style={{ padding: '3px 2px', width: '30px', textAlign: 'center', borderRight: '1px solid #334155' }}>Qty</th>
                    <th style={{ padding: '3px 4px', width: '55px', textAlign: 'right' }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomHistoryList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '12px 4px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '8px' }}>
                        {!customerId ? 'Select customer' : (historyMode === 'CUSTOMER_PRODUCT' && selectedCartProduct ? 'No past purchase for this item' : 'No history found')}
                      </td>
                    </tr>
                  ) : (
                    bottomHistoryList.map((h, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          if (h.invoiceNumber) {
                            setSelectedInvoiceIdForModal(h.invoiceNumber);
                            setShowInvoiceDetailsModal(true);
                          }
                        }}
                        style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', cursor: 'pointer' }}
                        title="Click to view full Invoice Details & Returns"
                      >
                        <td style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>{new Date(h.date).toLocaleDateString()}</td>
                        <td style={{ padding: '2px 4px', fontWeight: 700, color: '#0284c7', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px' }}>{h.invoiceNumber}</td>
                        <td style={{ padding: '2px 2px', textAlign: 'center', fontWeight: 700 }}>{h.quantity}</td>
                        <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 800, color: '#0284c7', whiteSpace: 'nowrap' }}>
                          Rs. {(h.rate || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* ADD FINANCIAL HEAD MODAL WITH CHART OF ACCOUNTS TYPE SELECTOR */}
      {showAddFinHeadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '360px', padding: '16px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Add New Financial Head</h3>
              <button onClick={() => setShowAddFinHeadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateFinHead}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Financial Head Name *</label>
                <input required type="text" placeholder="e.g. COUNTER 2, BANK HBL, EXPENSE CASH" value={newFinHeadName} onChange={e => setNewFinHeadName(e.target.value)} style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Chart of Accounts Type *</label>
                <select
                  value={newFinHeadType}
                  onChange={e => setNewFinHeadType(e.target.value)}
                  style={{ width: '100%', padding: '6px', fontSize: '11px', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '3px' }}
                >
                  <option value="Asset">Asset (Cash, Bank, Receivables)</option>
                  <option value="Liability">Liability (Payables, Loans)</option>
                  <option value="Equity">Equity (Capital, Retained Earnings)</option>
                  <option value="Income">Income (Revenue, Sales)</option>
                  <option value="Expense">Expense (COGS, Salaries, Rent)</option>
                </select>
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

      {/* PHASE 35: INVOICE DETAILS & INLINE RETURNS MODAL */}
      <InvoiceDetailsModal
        isOpen={showInvoiceDetailsModal}
        onClose={() => setShowInvoiceDetailsModal(false)}
        invoiceId={selectedInvoiceIdForModal}
        onReturnSuccess={() => {
          if (customerId) fetchBottomHistory();
        }}
      />

      {/* PHASE 49: AUTO-POPUP POST-SALE RECEIPT MODAL */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
        type={receiptModal.type}
        data={receiptModal.data}
      />

    </div>
  );
};

export default POSRegister;
