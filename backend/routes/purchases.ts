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

      // 3. Post to Double-Entry Ledger (CashFlowMAIN)
      const invAssetHead = await tx.finHead.findFirst({ where: { name: 'Inventory Asset' } });
      
      let crFinHeadId: number | null = null;
      
      let vendor = await tx.sellerRec.findUnique({ where: { id: Number(vendorId) }, include: { finHead: true } });
      if (vendor && !vendor.finHead) {
        const newFinHead = await tx.finHead.create({
          data: {
            name: `Vendor: ${vendor.companyName}`,
            sellerRecId: vendor.id
          }
        });
        crFinHeadId = newFinHead.id;
      } else if (vendor && vendor.finHead) {
        crFinHeadId = vendor.finHead.id;
      }

      if (invAssetHead && crFinHeadId) {
        await tx.cashFlowMAIN.create({
          data: {
            description: `Purchase Invoice ID ${purchase.id}`,
            companyId: tenantCompanyId || undefined,
            details: {
              create: [
                {
                  finHeadId: crFinHeadId,
                  amount: totalPurchaseValue,
                  transactionType: 'CR' // Credit Accounts Payable
                },
                {
                  finHeadId: invAssetHead.id,
                  amount: totalPurchaseValue,
                  transactionType: 'DR' // Debit Inventory Asset
                }
              ]
            }
          }
        });
      }

      return purchase;
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
