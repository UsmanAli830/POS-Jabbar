import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthenticatedRequest, getTenantFilter, getTenantCompanyId } from '../middleware/auth';

// Phase 47: Sales route with multi-location support
const router = Router();
const prisma = new PrismaClient();

// GET /api/sales/next-invoice-number
router.get('/next-invoice-number', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const lastSale = await prisma.saleMain.findFirst({
      where: tenantFilter,
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    const nextId = (lastSale?.id || 0) + 1;
    res.json({
      nextId,
      nextInvoiceNumber: `INV-${nextId}`
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

    const salesmanId = req.user?.id;

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
      const productIds = items.map((i: any) => Number(i.productId));
      const products = await tx.productRec.findMany({ where: { id: { in: productIds } } });

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
      if (vanRecId) {
        // Spot / Van Sale
        createdSale = await tx.spotSaleMain.create({
          data: {
            customerRecId: customerId ? Number(customerId) : null,
            vanRecId: Number(vanRecId),
            routeId: routeId ? Number(routeId) : null,
            salesmanId: salesmanId ? Number(salesmanId) : null,
            totalAmount: parsedTotal,
            companyId: getTenantCompanyId(req) || undefined,
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
        createdSale = await tx.saleMain.create({
          data: {
            customerRecId: customerId ? Number(customerId) : null,
            customerLocationId: locIds.length > 0 ? locIds[0] : (customerLocationId ? Number(customerLocationId) : null),
            salesmanId: salesmanId ? Number(salesmanId) : null,
            totalAmount: finalTotalAmount,
            grossAmount: Number(subtotal || 0),
            discountAmount: Number(discountAmount || 0) + backendDiscountAmount,
            expenseAmount: finalTotalAmount - parsedTotal,
            paymentReceived: Number(paymentReceived || 0),
            companyId: getTenantCompanyId(req) || undefined,
            details: {
              create: finalItems.map((item: any) => {
                const qty = Number(item.quantity || 1);
                const price = Number(item.unitPrice || 0);
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
                  productRecId: Number(item.productId),
                  qty,
                  price,
                  discPercent: discPct,
                  cashDiscount: cashDisc,
                  grossAmount: gross,
                  netAmount: lineNet,
                  discountOrder: order
                };
              })
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
        const reqQty = Math.abs(Number(item.quantity));
        await tx.productRec.update({
          where: { id: Number(item.productId) },
          data: { currentStock: { decrement: reqQty } }
        });
      }

      // 3. Post to Double-Entry Ledger (CashFlowMAIN & CashFlowDTL)
      const salesRevHead = await tx.finHead.findFirst({ where: { name: 'Sales Revenue' } });
      const defaultCashHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
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

      return {
        ...createdSale,
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

// GET lookup invoice details by invoice number or ID (Phase 32)
router.get('/lookup/:invoiceNumber', async (req, res) => {
  try {
    const rawParam = req.params.invoiceNumber.trim();
    const cleanIdStr = rawParam.replace(/\D/g, '');
    const numericId = cleanIdStr ? parseInt(cleanIdStr, 10) : NaN;

    const sale = await prisma.saleMain.findFirst({
      where: {
        OR: [
          ...(isNaN(numericId) ? [] : [{ id: numericId }]),
          { id: isNaN(Number(rawParam)) ? -1 : Number(rawParam) }
        ]
      },
      include: {
        customerRec: true,
        details: {
          include: {
            productRec: true
          }
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
        id: d.id,
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

    res.json({
      id: sale.id,
      invoiceNumber: `INV-${sale.id}`,
      date: sale.date,
      customerRecId: sale.customerRecId,
      customerRec: sale.customerRec,
      customerName: custAny?.custName || custAny?.name || 'Walk-in Customer',
      customerPhone: custAny?.phone || custAny?.custMobile || custAny?.custPhone || '',
      salesman: 'System Admin',
      booker: 'Counter Staff',
      paymentMode: sale.customerRecId ? 'Customer Account (Credit)' : 'Cash',
      grossAmount,
      totalDiscount,
      expenseAmount: (sale as any).expenseAmount || 0,
      totalAmount,
      paymentReceived: (sale as any).paymentReceived || 0,
      remainingDues: sale.customerRecId ? (custAny?.CurrentBalance || totalAmount) : 0,
      details: mappedDetails
    });
  } catch (error: any) {
    console.error('Invoice Lookup Error:', error);
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

export default router;
