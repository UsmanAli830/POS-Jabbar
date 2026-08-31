import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

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

      // 1. Create Purchase Record
      const purchase = await tx.purMain.create({
        data: {
          sellerRecId: Number(vendorId),
          vendorLocationId: locationId ? Number(locationId) : null,
          totalAmount: totalPurchaseValue,
          companyId: tenantCompanyId || undefined,
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

      return {
        ...purchase,
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
    const purchase = await prisma.purMain.findUnique({
      where: { id: Number(req.params.id.replace('PO-', '')) },
      include: {
        sellerRec: true,
        details: { include: { productRec: true } }
      }
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
