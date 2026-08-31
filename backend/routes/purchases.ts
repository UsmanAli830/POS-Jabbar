import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST process new vendor purchase
router.post('/', async (req, res) => {
  try {
    const { vendorId, locationId, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required for purchase.' });
    }
    
    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor is required for purchase.' });
    }

    const tenantCompanyId = getTenantCompanyId(req);

    const result = await prisma.$transaction(async (tx) => {
      let totalPurchaseValue = 0;

      for (const item of items) {
        const qty = Number(item.quantity);
        const cost = Number(item.costPrice);
        totalPurchaseValue += (qty * cost);
      }

      const lastPur = await tx.purMain.findFirst({
        where: tenantCompanyId ? { companyId: tenantCompanyId } : {},
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true }
      });
      const nextSeq = (lastPur && lastPur.invoiceNumber) ? lastPur.invoiceNumber + 1 : 1;

      // 1. Create Purchase Record
      const purchase = await tx.purMain.create({
        data: {
          sellerRecId: Number(vendorId),
          vendorLocationId: locationId ? Number(locationId) : null,
          totalAmount: totalPurchaseValue,
          companyId: tenantCompanyId || undefined,
          invoiceNumber: nextSeq,
          details: {
            create: items.map((item: any) => ({
              productRecId: Number(item.productId),
              qty: Number(item.quantity),
              price: Number(item.costPrice),
            }))
          }
        },
        include: { details: true }
      });

      // 2. Add Inventory
      for (const item of items) {
        const qty = Number(item.quantity);
        
        await tx.productRec.update({
          where: { id: Number(item.productId) },
          data: { currentStock: { increment: Math.abs(qty) } }
        });
      }

      const rawCashPaid = Number(req.body.cashPaid || 0);
      const cashPaidAmount = Math.min(totalPurchaseValue, Math.max(0, rawCashPaid));
      const adjustedInBalance = totalPurchaseValue - cashPaidAmount;

      // 3. Post to Double-Entry Ledger (CashFlowMAIN)
      let invAssetHead = await tx.finHead.findFirst({ where: { name: 'Inventory Asset' } });
      if (!invAssetHead) {
        invAssetHead = await tx.finHead.create({ data: { name: 'Inventory Asset' } });
      }

      let cashHead = await tx.finHead.findFirst({ where: { name: { contains: 'Cash' } } });
      if (!cashHead) {
        cashHead = await tx.finHead.create({ data: { name: 'Cash in Till' } });
      }

      let vendorFinHeadId: number | null = null;
      let vendor = await tx.sellerRec.findUnique({ where: { id: Number(vendorId) }, include: { finHead: true } });
      if (vendor && !vendor.finHead) {
        const newFinHead = await tx.finHead.create({
          data: {
            name: `Vendor: ${vendor.companyName}`,
            sellerRecId: vendor.id
          }
        });
        vendorFinHeadId = newFinHead.id;
      } else if (vendor && vendor.finHead) {
        vendorFinHeadId = vendor.finHead.id;
      }

      const entries: { finHeadId: number; amount: number; transactionType: 'DR' | 'CR' }[] = [
        // 1. Debit (DR): Inventory Asset (increases total stock value)
        {
          finHeadId: invAssetHead.id,
          amount: totalPurchaseValue,
          transactionType: 'DR'
        }
      ];

      // 2. Credit (CR): Cash in Till (for physical cash paid)
      if (cashPaidAmount > 0) {
        entries.push({
          finHeadId: cashHead.id,
          amount: cashPaidAmount,
          transactionType: 'CR'
        });
      }

      // 3. Credit (CR): Vendor Account (increases outstanding Accounts Payable balance)
      if (adjustedInBalance > 0 && vendorFinHeadId) {
        entries.push({
          finHeadId: vendorFinHeadId,
          amount: adjustedInBalance,
          transactionType: 'CR'
        });
      }

      await tx.cashFlowMAIN.create({
        data: {
          description: `Purchase Invoice ID ${purchase.id} (Paid: Rs. ${cashPaidAmount}, Adjusted: Rs. ${adjustedInBalance})`,
          companyId: tenantCompanyId || undefined,
          details: {
            create: entries
          }
        }
      });

      // Compute Vendor's updated live balance
      let currentVendorBalance = vendor?.openingBalance || 0;
      if (vendorFinHeadId) {
        const allVendorDtls = await tx.cashFlowDTL.findMany({ where: { finHeadId: vendorFinHeadId } });
        const crSum = allVendorDtls.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
        const drSum = allVendorDtls.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
        currentVendorBalance = (vendor?.openingBalance || 0) + crSum - drSum;
      }

      const formattedPO = `PO-${purchase.invoiceNumber || purchase.id}`;
      return {
        ...purchase,
        invoiceNumber: formattedPO,
        seqNumber: purchase.invoiceNumber || purchase.id,
        cashPaid: cashPaidAmount,
        balanceAdjusted: adjustedInBalance,
        vendorBalance: currentVendorBalance
      };
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Purchase Transaction Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process purchase', details: error });
  }
});

// GET all purchases
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const purchases = await prisma.purMain.findMany({
      where: tenantFilter,
      include: {
        sellerRec: true,
        details: { include: { productRec: true } }
      },
      orderBy: { date: 'desc' },
      take: 50
    });
    res.json(purchases);
  } catch (error: any) {
    res.status(500).json({ error: error.message, details: error });
  }
});

// GET single purchase by ID
router.get('/:id', async (req, res) => {
  try {
    const rawParam = req.params.id.trim();
    const cleanIdStr = rawParam.replace(/\D/g, '');
    const numericId = cleanIdStr ? parseInt(cleanIdStr, 10) : NaN;
    const tenantCompanyId = getTenantCompanyId(req);

    const purchase = await prisma.purMain.findFirst({
      where: {
        AND: [
          ...(tenantCompanyId ? [{ companyId: tenantCompanyId }] : []),
          {
            OR: [
              ...(isNaN(numericId) ? [] : [{ invoiceNumber: numericId }, { id: numericId }])
            ]
          }
        ]
      },
      include: {
        sellerRec: true,
        details: { include: { productRec: true } },
        historyLogs: {
          include: { modifiedBy: true },
          orderBy: { modifiedAt: 'desc' }
        }
      }
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json({
      ...purchase,
      invoiceNumber: `PO-${purchase.invoiceNumber || purchase.id}`,
      rawInvoiceNumber: purchase.invoiceNumber || purchase.id
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/purchases/:id — In-place edit of existing vendor purchase / GRN bill
router.put('/:id', requirePermission('allow-bill-editing'), async (req: AuthenticatedRequest, res) => {
  try {
    const paramId = String(req.params.id);
    const rawId = paramId.replace('PO-', '').replace('PUR-', '');
    const purId = Number(rawId);
    const { items, vendorId, sellerRecId, totalAmount } = req.body;

    if (isNaN(purId)) {
      return res.status(400).json({ error: 'Invalid purchase invoice ID' });
    }

    const tenantFilter = getTenantFilter(req);
    const originalPur = await prisma.purMain.findFirst({
      where: { id: purId, ...tenantFilter },
      include: { details: true }
    });

    if (!originalPur) {
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }

    const targetVendorId = vendorId ? Number(vendorId) : (sellerRecId ? Number(sellerRecId) : originalPur.sellerRecId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate stock differences for all products (new vs old)
      const oldQtyMap = new Map<number, number>();
      for (const dtl of originalPur.details) {
        oldQtyMap.set(dtl.productRecId, (oldQtyMap.get(dtl.productRecId) || 0) + dtl.qty);
      }

      const newQtyMap = new Map<number, number>();
      for (const item of (items || [])) {
        const prodId = Number(item.productRecId || item.productId || item.id);
        const qty = Number(item.qty || item.quantity);
        newQtyMap.set(prodId, (newQtyMap.get(prodId) || 0) + qty);
      }

      // Collect all affected product IDs
      const allProdIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      for (const prodId of allProdIds) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const delta = newQty - oldQty; // Purchasing more units increases currentStock by delta
        if (delta !== 0) {
          await tx.productRec.update({
            where: { id: prodId },
            data: { currentStock: { increment: delta } }
          });
        }
      }

      // 2. Direct line item updates: Delete existing PurDtl and recreate updated lines
      await tx.purDtl.deleteMany({ where: { purMainId: purId } });

      const newDetails = [];
      for (const item of (items || [])) {
        const prodId = Number(item.productRecId || item.productId || item.id);
        const qty = Number(item.qty || item.quantity);
        const costPrice = Number(item.costPrice || item.price || 0);

        const dtl = await tx.purDtl.create({
          data: {
            purMainId: purId,
            productRecId: prodId,
            qty,
            price: costPrice
          }
        });
        newDetails.push(dtl);
      }

      // 3. Recalculate original parent record PurMain
      const newNetSum = totalAmount !== undefined ? Number(totalAmount) : newDetails.reduce((sum, d) => sum + (d.qty * d.price), 0);

      const updatedPur = await tx.purMain.update({
        where: { id: purId },
        data: {
          totalAmount: newNetSum,
          sellerRecId: targetVendorId
        },
        include: { details: { include: { productRec: true } }, sellerRec: true }
      });

      // 4. Double-Entry Ledger Sync: Update CashFlowDTL entries for PUR-{purId}
      if (targetVendorId) {
        const vendor = await tx.sellerRec.findUnique({
          where: { id: targetVendorId },
          include: { finHead: true }
        });
        if (vendor?.finHead) {
          const vendorDtls = await tx.cashFlowDTL.findMany({
            where: {
              finHeadId: vendor.finHead.id,
              cashFlowMain: { description: { contains: `PUR-${purId}` } }
            }
          });
          for (const dtl of vendorDtls) {
            if (dtl.transactionType === 'CR') {
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

      const oldTotal = originalPur.totalAmount;
      const amountDiff = newNetSum - oldTotal;
      let logDesc = `In-place edit on PUR-${purId}: Total updated from Rs. ${oldTotal.toLocaleString()} to Rs. ${newNetSum.toLocaleString()}`;
      if (amountDiff !== 0) {
        logDesc += `. Balance/Amount difference: Rs. ${Math.abs(amountDiff).toLocaleString()} (${amountDiff < 0 ? 'Vendor Liability Reduced' : 'Additional Vendor Dues'})`;
      }
      logDesc += `. Items count: ${(items || []).length}.`;

      await tx.transactionHistoryLog.create({
        data: {
          purMainId: purId,
          modifiedById: modifiedById,
          changeDetails: logDesc,
          companyId: req.user?.companyId
        }
      });

      return updatedPur;
    });

    res.json(result);
  } catch (error: any) {
    console.error('In-Place Purchase Edit Error:', error);
    res.status(500).json({ error: error.message || 'Failed to edit purchase invoice' });
  }
});

export default router;
