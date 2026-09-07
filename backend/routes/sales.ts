import { Router } from 'express';
import prisma from '../db';
import { authenticate, AuthenticatedRequest, getTenantFilter, getTenantCompanyId, requirePermission } from '../middleware/auth';

// Phase 47: Sales route with multi-location support
const router = Router();

// GET /api/sales/next-invoice-number
router.get('/next-invoice-number', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantCompanyId = getTenantCompanyId(req);
    const lastSale = await prisma.saleMain.findFirst({
      where: tenantCompanyId ? { companyId: tenantCompanyId } : {},
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true }
    });
    const nextSeq = (lastSale && lastSale.invoiceNumber) ? lastSale.invoiceNumber + 1 : 1;
    res.json({
      nextId: nextSeq,
      nextInvoiceNumber: `INV-${nextSeq}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST process new sale / checkout
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      items, 
      customerId, 
      customerLocationId,
      locationIds,
      customerLocationIds,
      vanRecId, 
      routeId,
      subtotal, 
      taxAmount, 
      discountAmount, 
      total,
      paymentMethod,
      paymentReceived,
      finHeadId,
      refNumber
    } = req.body;

    let validSalesmanId: number | null = null;
    if (req.user?.id) {
      const empExists = await prisma.employeeRec.findUnique({ where: { id: req.user.id } });
      if (empExists) validSalesmanId = req.user.id;
    }

    let locIds: number[] = [];
    if (Array.isArray(locationIds)) {
      locIds = locationIds.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    } else if (Array.isArray(customerLocationIds)) {
      locIds = customerLocationIds.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    } else if (customerLocationId) {
      locIds = [Number(customerLocationId)];
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const manualDiscount = Number(discountAmount || 0);
    const isCredit = paymentMethod === 'Credit / Unpaid';

    if (isCredit && !customerId) {
      return res.status(400).json({ error: 'Customer is required for credit sales.' });
    }

    // Execute the sale and inventory deductions as a single ACID transaction
    const result = await prisma.$transaction(async (tx) => {
      let backendDiscountAmount = 0;
      let finalItems = [...items];

      // --- PHASE 6: JSON Discount Scheme Engine ---
      const schemes = await tx.discountScheme.findMany({ where: { isActive: true } });
      const productIds = items.map((i: any) => Number(i.productId || i.productRecId || i.id)).filter((id: number) => !isNaN(id) && id > 0);
      const products = productIds.length > 0 ? await tx.productRec.findMany({ where: { id: { in: productIds } } }) : [];

      for (const scheme of schemes) {
        let rule: any;
        try { rule = JSON.parse(scheme.rulePayload); } catch (e) { continue; }

        // 1. Percentage Discount Rule
        if (rule.type === 'percentage') {
          for (const item of items) {
            const prod = products.find(p => p.id === Number(item.productId));
            const isMatch = 
              (scheme.targetType === 'GLOBAL') ||
              (scheme.targetType === 'CUSTOMER' && customerId && scheme.targetId === Number(customerId)) ||
              (scheme.targetType === 'PRODUCT' && scheme.targetId === prod?.id) ||
              (scheme.targetType === 'CATEGORY' && scheme.targetId === prod?.pCatId);
            
            if (isMatch) {
              const lineTotal = Number(item.quantity) * Number(item.unitPrice);
              const discount = (lineTotal * Number(rule.value)) / 100;
              backendDiscountAmount += discount;
            }
          }
        }
        
        // 2. Buy X Get Y Rule (BOGO)
        if (rule.type === 'bogo') {
          for (const item of items) {
            const prod = products.find(p => p.id === Number(item.productId));
            const isMatch = 
              (scheme.targetType === 'PRODUCT' && scheme.targetId === prod?.id) ||
              (scheme.targetType === 'CATEGORY' && scheme.targetId === prod?.pCatId);

            if (isMatch && Number(item.quantity) >= Number(rule.buy)) {
              const sets = Math.floor(Number(item.quantity) / Number(rule.buy));
              const bonusQty = sets * Number(rule.get);
              
              if (bonusQty > 0) {
                 finalItems.push({
                   productId: item.productId,
                   quantity: bonusQty,
                   unitPrice: 0 // Bonus item is free
                 });
              }
            }
          }
        }
      }

      // Securely calculate the backend total
      const totalCartValue = finalItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      const computedTotal = totalCartValue + Number(taxAmount || 0) - manualDiscount - backendDiscountAmount;
      const parsedTotal = computedTotal < 0 ? 0 : computedTotal; // Prevent negative totals

      let createdSale;

      // 1. Create Sale Record
      const tenantCompanyId = getTenantCompanyId(req);
      const lastSale = await tx.saleMain.findFirst({
        where: tenantCompanyId ? { companyId: tenantCompanyId } : {},
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true }
      });
      const nextSeq = (lastSale && lastSale.invoiceNumber) ? lastSale.invoiceNumber + 1 : 1;

      if (vanRecId) {
        // Spot / Van Sale
        createdSale = await tx.spotSaleMain.create({
          data: {
            customerRecId: customerId ? Number(customerId) : null,
            vanRecId: Number(vanRecId),
            routeId: routeId ? Number(routeId) : null,
            salesmanId: validSalesmanId,
            totalAmount: parsedTotal,
            companyId: tenantCompanyId || undefined,
            details: {
              create: finalItems.map((item: any) => ({
                productRecId: Number(item.productId),
                qty: Number(item.quantity),
                price: Number(item.unitPrice),
              }))
            }
          },
          include: { details: true }
        });
      } else {
        // Standard Sale
        const finalTotalAmount = Number(total || parsedTotal);

        let safeCustId: number | null = null;
        if (customerId) {
          const cust = await tx.customerRec.findUnique({ where: { id: Number(customerId) } });
          if (cust) safeCustId = cust.id;
        }

        let safeCustLocId: number | null = null;
        const rawLocId = locIds.length > 0 ? locIds[0] : (customerLocationId ? Number(customerLocationId) : null);
        if (rawLocId) {
          const loc = await tx.customerLocation.findUnique({ where: { id: rawLocId } });
          if (loc) safeCustLocId = loc.id;
        }

        let safeSalesmanId: number | null = null;
        if (validSalesmanId) {
          const emp = await tx.employeeRec.findUnique({ where: { id: validSalesmanId } });
          if (emp) safeSalesmanId = emp.id;
        }

        const defaultProd = await tx.productRec.findFirst({ select: { id: true } });
        const defaultProdId = defaultProd ? defaultProd.id : 1;

        createdSale = await tx.saleMain.create({
          data: {
            customerRecId: safeCustId,
            customerLocationId: safeCustLocId,
            salesmanId: safeSalesmanId,
            totalAmount: finalTotalAmount,
            grossAmount: Number(subtotal || 0),
            discountAmount: Number(discountAmount || 0) + backendDiscountAmount,
            expenseAmount: finalTotalAmount - parsedTotal,
            paymentReceived: Number(paymentReceived || 0),
            companyId: tenantCompanyId || undefined,
            invoiceNumber: nextSeq,
            details: {
              create: await Promise.all(finalItems.map(async (item: any) => {
                const rawId = Number(item.productId || item.productRecId || item.id);
                let validProdId = defaultProdId;
                if (!isNaN(rawId) && rawId > 0) {
                  const found = await tx.productRec.findUnique({ where: { id: rawId }, select: { id: true } });
                  if (found) validProdId = found.id;
                }

                const qty = Number(item.quantity || item.qty || 1);
                const price = Number(item.unitPrice || item.price || 0);
                const gross = Number(item.grossAmount || (qty * price));
                const discPct = Number(item.discPercent || item.discountPercent || 0);
                const cashDisc = Number(item.cashDiscount || 0);
                const order = item.discountOrder || null;
                
                let lineNet = Number(item.netAmount ?? item.totalPrice ?? 0);
                if (lineNet <= 0 && qty > 0) {
                  if (order === 'CASH_FIRST') {
                    const sub = Math.max(0, gross - cashDisc);
                    lineNet = Math.max(0, sub - (sub * (discPct / 100)));
                  } else if (order === 'PERCENT_FIRST') {
                    const sub = Math.max(0, gross - (gross * (discPct / 100)));
                    lineNet = Math.max(0, sub - cashDisc);
                  } else {
                    if (discPct > 0) lineNet = Math.max(0, gross - (gross * (discPct / 100)));
                    else if (cashDisc > 0) lineNet = Math.max(0, gross - cashDisc);
                    else lineNet = gross;
                  }
                }

                return {
                  productRec: { connect: { id: validProdId } },
                  qty,
                  price,
                  discPercent: discPct,
                  cashDiscount: cashDisc,
                  grossAmount: gross,
                  netAmount: lineNet,
                  discountOrder: order
                };
              }))
            },
            saleLocations: locIds.length > 0 ? {
              create: locIds.map(locId => ({
                customerLocationId: locId
              }))
            } : undefined
          },
          include: { details: true, saleLocations: { include: { customerLocation: true } } }
        });
      }

      // 2. Deduct inventory from ProductRec
      for (const item of finalItems) {
        const rawId = Number(item.productId || item.productRecId || item.id);
        const reqQty = Math.abs(Number(item.quantity || item.qty || 1));
        let targetId: number | null = null;
        if (!isNaN(rawId) && rawId > 0) {
          const found = await tx.productRec.findUnique({ where: { id: rawId }, select: { id: true } });
          if (found) targetId = found.id;
        }
        if (!targetId) {
          const defaultProd = await tx.productRec.findFirst({ select: { id: true } });
          if (defaultProd) targetId = defaultProd.id;
        }
        if (targetId) {
          await tx.productRec.update({
            where: { id: targetId },
            data: { currentStock: { decrement: reqQty } }
          });
        }
      }

      // 3. Post to Double-Entry Ledger (CashFlowMAIN & CashFlowDTL)
      let salesRevHead = await tx.finHead.findFirst({ where: { name: 'Sales Revenue' } });
      if (!salesRevHead) {
        salesRevHead = await tx.finHead.create({ data: { name: 'Sales Revenue' } });
      }
      let defaultCashHead = await tx.finHead.findFirst({ where: { name: { contains: 'Cash' } } });
      if (!defaultCashHead) {
        defaultCashHead = await tx.finHead.create({ data: { name: 'Cash in Till' } });
      }
      const cashHeadId = finHeadId ? Number(finHeadId) : defaultCashHead?.id;

      let customerFinHeadId: number | null = null;
      if (customerId) {
        let customer = await tx.customerRec.findUnique({ where: { id: Number(customerId) }, include: { finHead: true } });
        if (customer) {
          if (!customer.finHead) {
            const newFinHead = await tx.finHead.create({
              data: {
                name: `Customer: ${customer.custName}`,
                customerRecId: customer.id
              }
            });
            customerFinHeadId = newFinHead.id;
          } else {
            customerFinHeadId = customer.finHead.id;
          }
        }
      }

      const invRefStr = refNumber || (`INV-${createdSale.id}`);

      if (customerFinHeadId) {
        // ENTRY 1: THE INVOICE (Debit Customer AR for FULL total, Credit Sales Revenue)
        if (salesRevHead) {
          await tx.cashFlowMAIN.create({
            data: {
              description: `Invoice: ${invRefStr} (Total: Rs. ${parsedTotal})`,
              details: {
                create: [
                  {
                    finHeadId: customerFinHeadId,
                    amount: parsedTotal,
                    transactionType: 'DR' // Debit Customer AR (Increases Debt)
                  },
                  {
                    finHeadId: salesRevHead.id,
                    amount: parsedTotal,
                    transactionType: 'CR' // Credit Sales Revenue
                  }
                ]
              }
            }
          });
        }

        // ENTRY 2: THE PAYMENT (Credit Customer AR for Cash Received, Debit Cash in Till)
        const cashPaid = Number(paymentReceived || 0);
        if (cashPaid > 0 && cashHeadId) {
          await tx.cashFlowMAIN.create({
            data: {
              description: `Payment Received: ${invRefStr} (Received: Rs. ${cashPaid})`,
              details: {
                create: [
                  {
                    finHeadId: customerFinHeadId,
                    amount: cashPaid,
                    transactionType: 'CR' // Credit Customer AR (Reduces Debt / Creates Advance)
                  },
                  {
                    finHeadId: cashHeadId,
                    amount: cashPaid,
                    transactionType: 'DR' // Debit Cash Drawer / Selected Ledger
                  }
                ]
              }
            }
          });
        }
      } else {
        // WALK-IN CUSTOMER (No customer account selected):
        const cashPaid = Number(paymentReceived || parsedTotal);
        if (salesRevHead && cashHeadId) {
          await tx.cashFlowMAIN.create({
            data: {
              description: `Walk-in Sale: ${invRefStr}`,
              details: {
                create: [
                  {
                    finHeadId: cashHeadId,
                    amount: cashPaid > 0 ? cashPaid : parsedTotal,
                    transactionType: 'DR'
                  },
                  {
                    finHeadId: salesRevHead.id,
                    amount: parsedTotal,
                    transactionType: 'CR'
                  }
                ]
              }
            }
          });
        }
      }

      const saleSeq = (createdSale as any).invoiceNumber || createdSale.id;
      const formattedInv = `INV-${saleSeq}`;
      return {
        ...createdSale,
        invoiceNumber: formattedInv,
        seqNumber: saleSeq,
        backendDiscountAmount,
        manualDiscount
      };
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Sale Transaction Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process sale', details: error });
  }
});

// GET all sales history
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const standardSales = await prisma.saleMain.findMany({ 
      where: tenantFilter,
      include: { 
        details: { include: { productRec: true } },
        customerRec: true,
        customerLocation: true,
        saleLocations: {
          include: {
            customerLocation: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50
    });
    
    const spotSales = await prisma.spotSaleMain.findMany({
      where: tenantFilter,
      include: { 
        details: { include: { productRec: true } },
        customerRec: true,
        vanRec: true
      },
      orderBy: { date: 'desc' },
      take: 50
    });

    const combined = [...standardSales.map(s => ({ ...s, type: 'STANDARD' })), ...spotSales.map(s => ({ ...s, type: 'SPOT' }))]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(combined);
  } catch (error: any) {
    res.status(500).json({ error: error.message, details: error });
  }
});

// GET customer past purchase history for POS Register bottom tab
router.get('/customer-history/:customerId', async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    const sales = await prisma.saleMain.findMany({
      where: { customerRecId: customerId },
      include: {
        details: {
          include: {
            productRec: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50
    });

    const history = [];
    for (const sale of sales) {
      for (const d of sale.details) {
        history.push({
          id: d.id,
          date: sale.date,
          invoiceNumber: `INV-${sale.id}`,
          productName: d.productRec ? d.productRec.productName : 'Product',
          quantity: d.qty,
          rate: d.price,
          totalPrice: d.qty * d.price
        });
      }
    }

    res.json(history);
  } catch (error: any) {
    console.error('Failed to fetch customer sales history', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer history' });
  }
});

// GET customer past purchase history filtered by customerId AND optional productId (Phase 30)
router.get('/customer-product-history', async (req, res) => {
  try {
    const { customerId, productId } = req.query;
    if (!customerId) {
      return res.json([]);
    }

    const detailWhereClause: any = {};
    if (productId && Number(productId) > 0) {
      detailWhereClause.productRecId = Number(productId);
    }

    const sales = await prisma.saleMain.findMany({
      where: { customerRecId: Number(customerId) },
      include: {
        details: {
          where: Object.keys(detailWhereClause).length > 0 ? detailWhereClause : undefined,
          include: {
            productRec: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50
    });

    const history = [];
    for (const sale of sales) {
      for (const d of sale.details) {
        history.push({
          id: d.id,
          date: sale.date,
          invoiceNumber: `INV-${sale.id}`,
          productId: d.productRecId,
          productName: d.productRec ? d.productRec.productName : 'Product',
          quantity: d.qty,
          rate: d.price,
          totalPrice: d.qty * d.price
        });
      }
    }

    res.json(history);
  } catch (error: any) {
    console.error('Failed to fetch customer product history', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer product history' });
  }
});

// GET lookup invoice details by query string OR path parameter (Phase 32)
const handleInvoiceLookup = async (rawParam: string, companyId?: number | null, res?: any) => {
  const cleanIdStr = rawParam.replace(/\D/g, '');
  const numericId = cleanIdStr ? parseInt(cleanIdStr, 10) : NaN;

  const sale = await prisma.saleMain.findFirst({
    where: {
      AND: [
        ...(companyId ? [{ companyId }] : []),
        {
          OR: [
            ...(isNaN(numericId) ? [] : [{ invoiceNumber: numericId }, { id: numericId }])
          ]
        }
      ]
    },
    include: {
      customerRec: true,
      salesman: true,
      details: {
        include: {
          productRec: true
        }
      },
      historyLogs: {
        include: {
          modifiedBy: true
        },
        orderBy: { modifiedAt: 'desc' }
      }
    }
  });

  if (!sale) {
    return res.status(404).json({ error: `Invoice '${rawParam}' not found.` });
  }

  const custAny = sale.customerRec as any;
  const mappedDetails = sale.details.map(d => {
    const qty = Number(d.qty || 0);
    const price = Number(d.price || 0);
    const gross = Number((d as any).grossAmount || (qty * price));
    const discPct = Number((d as any).discPercent || 0);
    const cashDisc = Number((d as any).cashDiscount || 0);
    const order = (d as any).discountOrder || null;
    let lineNet = Number((d as any).netAmount || 0);
    if (lineNet <= 0 && qty > 0) {
      if (order === 'CASH_FIRST') {
        const sub = Math.max(0, gross - cashDisc);
        lineNet = Math.max(0, sub - (sub * (discPct / 100)));
      } else if (order === 'PERCENT_FIRST') {
        const sub = Math.max(0, gross - (gross * (discPct / 100)));
        lineNet = Math.max(0, sub - cashDisc);
      } else {
        if (discPct > 0) lineNet = Math.max(0, gross - (gross * (discPct / 100)));
        else if (cashDisc > 0) lineNet = Math.max(0, gross - cashDisc);
        else lineNet = gross;
      }
    }

    return {
      id: d.productRecId,
      productRecId: d.productRecId,
      productName: d.productRec ? d.productRec.productName : 'Unknown Product',
      productCode: d.productRec?.productCode || '',
      barCode: d.productRec?.barCode || '',
      qty,
      price,
      discPercent: discPct,
      cashDiscount: cashDisc,
      grossAmount: gross,
      netAmount: lineNet,
      discountOrder: order,
      totalPrice: lineNet
    };
  });

  const sumGross = mappedDetails.reduce((sum, item) => sum + item.grossAmount, 0);
  const sumNet = mappedDetails.reduce((sum, item) => sum + item.netAmount, 0);
  const sumItemDiscounts = mappedDetails.reduce((sum, item) => sum + Math.max(0, item.grossAmount - item.netAmount), 0);

  const dbGross = Number((sale as any).grossAmount || 0);
  const dbDiscount = Number((sale as any).discountAmount || 0);
  const dbNet = Number(sale.totalAmount || 0);

  const grossAmount = dbGross > 0 ? dbGross : (sumGross > 0 ? sumGross : dbNet + dbDiscount);
  const totalAmount = dbNet > 0 ? dbNet : sumNet;
  const totalDiscount = dbDiscount > 0 
    ? dbDiscount 
    : (grossAmount - totalAmount > 0 ? (grossAmount - totalAmount) : sumItemDiscounts);

  const displayInvNumber = `INV-${sale.invoiceNumber || sale.id}`;

  res.json({
    id: sale.id,
    invoiceNumber: displayInvNumber,
    rawInvoiceNumber: sale.invoiceNumber || sale.id,
    date: sale.date,
    customerRecId: sale.customerRecId,
    customerRec: sale.customerRec,
    customerName: custAny?.custName || custAny?.name || 'Walk-in Customer',
    customerPhone: custAny?.phone || custAny?.custMobile || custAny?.custPhone || '',
    salesman: sale.salesman?.name || 'System Admin',
    booker: 'Counter Staff',
    paymentMode: sale.customerRecId ? 'Customer Account (Credit)' : 'Cash',
    grossAmount,
    totalDiscount,
    expenseAmount: (sale as any).expenseAmount || 0,
    totalAmount,
    paymentReceived: (sale as any).paymentReceived || 0,
    remainingDues: sale.customerRecId ? (custAny?.CurrentBalance || totalAmount) : 0,
    details: mappedDetails,
    historyLogs: sale.historyLogs || []
  });
};

router.get('/lookup', async (req: any, res) => {
  try {
    const queryVal = (req.query.refNo || req.query.invNo || req.query.query || '').toString().trim();
    if (!queryVal) {
      return res.status(400).json({ error: 'Ref # / Invoice # parameter is required' });
    }
    const tenantCompanyId = getTenantCompanyId(req);
    await handleInvoiceLookup(queryVal, tenantCompanyId, res);
  } catch (error: any) {
    console.error('Invoice Lookup Query Error:', error);
    res.status(500).json({ error: error.message || 'Failed to lookup invoice' });
  }
});

router.get('/lookup/:invoiceNumber', async (req: any, res) => {
  try {
    const rawParam = req.params.invoiceNumber.trim();
    const tenantCompanyId = getTenantCompanyId(req);
    await handleInvoiceLookup(rawParam, tenantCompanyId, res);
  } catch (error: any) {
    console.error('Invoice Lookup Param Error:', error);
    res.status(500).json({ error: error.message || 'Failed to lookup invoice' });
  }
});

// GET list of recent invoices for a customer (Phase 32)
router.get('/customer-invoices/:customerId', async (req, res) => {
  try {
    const custId = parseInt(req.params.customerId, 10);
    if (isNaN(custId)) return res.json([]);

    const invoices = await prisma.saleMain.findMany({
      where: { customerRecId: custId },
      select: {
        id: true,
        date: true,
        totalAmount: true,
        customerLocationId: true
      },
      orderBy: { date: 'desc' },
      take: 20
    });

    res.json(invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: `INV-${inv.id}`,
      date: inv.date,
      totalAmount: inv.totalAmount,
      customerLocationId: inv.customerLocationId
    })));
  } catch (error: any) {
    console.error('Failed to fetch customer invoices:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer invoices' });
  }
});

// PUT /api/sales/:id — In-place edit of existing sale invoice
router.put('/:id', requirePermission('allow-bill-editing'), async (req: AuthenticatedRequest, res) => {
  try {
    const saleId = Number(req.params.id);
    const { items, subtotal, taxAmount, discountAmount, total, customerId } = req.body;

    if (isNaN(saleId)) {
      return res.status(400).json({ error: 'Invalid sale invoice ID' });
    }

    const tenantFilter = getTenantFilter(req);
    const originalSale = await prisma.saleMain.findFirst({
      where: { id: saleId, ...tenantFilter },
      include: { details: true }
    });

    if (!originalSale) {
      return res.status(404).json({ error: 'Sale invoice not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate stock differences for all products (old vs new)
      const oldQtyMap = new Map<number, number>();
      for (const dtl of originalSale.details) {
        oldQtyMap.set(dtl.productRecId, (oldQtyMap.get(dtl.productRecId) || 0) + dtl.qty);
      }

      const newQtyMap = new Map<number, number>();
      for (const item of (items || [])) {
        const prodId = Number(item.productRecId || item.id || item.productId);
        const qty = Number(item.qty !== undefined ? item.qty : (item.quantity !== undefined ? item.quantity : 1));
        if (!isNaN(prodId)) {
          newQtyMap.set(prodId, (newQtyMap.get(prodId) || 0) + qty);
        }
      }

      // Collect all affected product IDs
      const allProdIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      for (const prodId of allProdIds) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const delta = newQty - oldQty; // Selling more units reduces currentStock by delta
        if (delta !== 0) {
          await tx.productRec.update({
            where: { id: prodId },
            data: { currentStock: { decrement: delta } }
          });
        }
      }

      // 2. Direct line item updates: Delete existing SaleInvDtl and recreate updated lines
      await tx.saleInvDtl.deleteMany({ where: { saleMainId: saleId } });

      const newDetails = [];
      for (const item of (items || [])) {
        const prodId = Number(item.productRecId || item.id || item.productId);
        const qty = Number(item.qty !== undefined ? item.qty : (item.quantity !== undefined ? item.quantity : 1));
        const price = Number(item.price !== undefined ? item.price : (item.rate !== undefined ? item.rate : (item.unitPrice !== undefined ? item.unitPrice : 0)));
        const discPct = Number(item.discPercent || item.discPct || 0);
        const cashDisc = Number(item.cashDiscount || 0);
        const grossAmount = qty * price;
        const netAmount = Number(item.netAmount || (grossAmount - (grossAmount * (discPct / 100)) - cashDisc));

        const dtl = await tx.saleInvDtl.create({
          data: {
            saleMainId: saleId,
            productRecId: prodId,
            qty,
            price,
            discPercent: discPct,
            cashDiscount: cashDisc,
            grossAmount,
            netAmount
          }
        });
        newDetails.push(dtl);
      }

      // 3. Recalculate original parent record SaleMain
      const newGrossSum = newDetails.reduce((sum, d) => sum + (d.grossAmount || 0), 0);
      const newNetSum = total !== undefined ? Number(total) : newDetails.reduce((sum, d) => sum + (d.netAmount || 0), 0);
      const newDiscountSum = discountAmount !== undefined ? Number(discountAmount) : Math.max(0, newGrossSum - newNetSum);

      const updatedSale = await tx.saleMain.update({
        where: { id: saleId },
        data: {
          grossAmount: newGrossSum,
          discountAmount: newDiscountSum,
          totalAmount: newNetSum,
          customerRecId: customerId ? Number(customerId) : originalSale.customerRecId,
          updatedAt: new Date()
        },
        include: { details: true }
      });

      // 4. Double-Entry Ledger Sync: Update CashFlowDTL entries for INV-{saleId}
      const customerIdToUse = customerId ? Number(customerId) : originalSale.customerRecId;
      if (customerIdToUse) {
        const customer = await tx.customerRec.findUnique({
          where: { id: customerIdToUse },
          include: { finHead: true }
        });
        if (customer?.finHead) {
          const customerDtls = await tx.cashFlowDTL.findMany({
            where: {
              finHeadId: customer.finHead.id,
              cashFlowMain: { description: { contains: `INV-${saleId}` } }
            }
          });
          for (const dtl of customerDtls) {
            if (dtl.transactionType === 'DR') {
              await tx.cashFlowDTL.update({
                where: { id: dtl.id },
                data: { amount: newNetSum }
              });
            }
          }
        }
      }

      // 5. Audit Logging: Record TransactionHistoryLog entry
      let modifiedById: number | null = null;
      if (req.user?.id) {
        const emp = await tx.employeeRec.findUnique({ where: { id: req.user.id } });
        if (emp) modifiedById = req.user.id;
      }

      const oldTotal = originalSale.totalAmount;
      const amountDiff = newNetSum - oldTotal;
      let logDesc = `In-place edit on INV-${saleId}: Total updated from Rs. ${oldTotal.toLocaleString()} to Rs. ${newNetSum.toLocaleString()}`;
      if (amountDiff !== 0) {
        logDesc += `. Balance/Amount difference: Rs. ${Math.abs(amountDiff).toLocaleString()} (${amountDiff < 0 ? 'Cash Returned/Reduced' : 'Additional Amount Charged'})`;
      }
      logDesc += `. Items count: ${(items || []).length}.`;

      await tx.transactionHistoryLog.create({
        data: {
          saleMainId: saleId,
          modifiedById: modifiedById,
          changeDetails: logDesc,
          companyId: req.user?.companyId
        }
      });

      const allHistoryLogs = await tx.transactionHistoryLog.findMany({
        where: { saleMainId: saleId },
        include: { modifiedBy: true },
        orderBy: { modifiedAt: 'desc' }
      });

      return {
        ...updatedSale,
        invoiceNumber: `INV-${updatedSale.id}`,
        historyLogs: allHistoryLogs
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('In-Place Sale Edit Error:', error);
    res.status(500).json({ error: error.message || 'Failed to edit sale invoice' });
  }
});

export default router;
