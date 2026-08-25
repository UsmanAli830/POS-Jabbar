import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to seed 5 sample promotions if database is empty
async function seedPromotionsIfEmpty() {
  const count = await prisma.tradeOffer.count();
  if (count === 0) {
    const now = new Date();
    const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    const firstCat = await prisma.pCat.findFirst();
    const firstProd = await prisma.productRec.findFirst();

    await prisma.tradeOffer.createMany({
      data: [
        {
          offerName: 'Eid Special 10% Off',
          offerType: 'PERCENTAGE_DISCOUNT',
          targetType: 'ALL_PRODUCTS',
          targetId: null,
          conditionValue: 1,
          rewardValue: 10,
          isActive: true,
          startDate: now,
          endDate: nextYear
        },
        {
          offerName: 'Bulk Buy Savings (Rs. 100 Off)',
          offerType: 'CASH_DISCOUNT',
          targetType: 'ALL_PRODUCTS',
          targetId: null,
          conditionValue: 5,
          rewardValue: 100,
          isActive: true,
          startDate: now,
          endDate: nextYear
        },
        {
          offerName: 'Category Mega Deal 15%',
          offerType: 'PERCENTAGE_DISCOUNT',
          targetType: 'CATEGORY',
          targetId: firstCat?.id || 1,
          conditionValue: 1,
          rewardValue: 15,
          isActive: true,
          startDate: now,
          endDate: nextYear
        },
        {
          offerName: 'Buy 3 Get 1 Free',
          offerType: 'BUY_X_GET_Y',
          targetType: firstProd ? 'PRODUCT' : 'ALL_PRODUCTS',
          targetId: firstProd?.id || null,
          conditionValue: 3,
          rewardValue: 1,
          isActive: true,
          startDate: now,
          endDate: nextYear
        },
        {
          offerName: 'Summer Cash Discount (Rs. 50)',
          offerType: 'CASH_DISCOUNT',
          targetType: 'ALL_PRODUCTS',
          targetId: null,
          conditionValue: 1,
          rewardValue: 50,
          isActive: true,
          startDate: now,
          endDate: nextYear
        }
      ]
    });
  }
}

// GET /api/promotions/check — Real-time promo check for POS Register
router.get('/check', async (req, res) => {
  try {
    const productId = req.query.productId ? Number(req.query.productId) : null;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const qty = req.query.qty ? Number(req.query.qty) : 1;

    await seedPromotionsIfEmpty();

    const now = new Date();
    const activeOffers = await prisma.tradeOffer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });

    let bestPromo: any = null;
    let maxBenefit = -1;

    for (const offer of activeOffers) {
      // 1. Check Target match
      let isTargetMatch = false;
      if (offer.targetType === 'ALL_PRODUCTS') {
        isTargetMatch = true;
      } else if (offer.targetType === 'CATEGORY' && categoryId && offer.targetId === categoryId) {
        isTargetMatch = true;
      } else if (offer.targetType === 'PRODUCT' && productId && offer.targetId === productId) {
        isTargetMatch = true;
      }

      if (!isTargetMatch) continue;

      // 2. Check Min Qty Condition
      if (qty < offer.conditionValue) continue;

      // 3. Estimate benefit value
      let benefit = 0;
      if (offer.offerType === 'PERCENTAGE_DISCOUNT') {
        benefit = offer.rewardValue;
      } else if (offer.offerType === 'CASH_DISCOUNT') {
        benefit = offer.rewardValue;
      } else if (offer.offerType === 'BUY_X_GET_Y') {
        benefit = offer.rewardValue * 100;
      } else {
        benefit = offer.rewardValue;
      }

      if (benefit > maxBenefit) {
        maxBenefit = benefit;
        bestPromo = offer;
      }
    }

    if (bestPromo) {
      return res.json({
        applied: true,
        promo: {
          id: bestPromo.id,
          offerName: bestPromo.offerName,
          offerType: bestPromo.offerType,
          discountPercent: bestPromo.offerType === 'PERCENTAGE_DISCOUNT' ? bestPromo.rewardValue : 0,
          cashDiscount: bestPromo.offerType === 'CASH_DISCOUNT' ? bestPromo.rewardValue : 0,
          bonusQty: bestPromo.offerType === 'BUY_X_GET_Y' ? Math.floor(qty / bestPromo.conditionValue) * bestPromo.rewardValue : 0,
          minQty: bestPromo.conditionValue
        }
      });
    }

    return res.json({ applied: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET all trade offers
router.get('/', async (req, res) => {
  try {
    await seedPromotionsIfEmpty();

    const offers = await prisma.tradeOffer.findMany({
      orderBy: { id: 'desc' }
    });

    const categories = await prisma.pCat.findMany();
    const products = await prisma.productRec.findMany();

    const enriched = offers.map(o => {
      let targetName = 'All Products';
      if (o.targetType === 'CATEGORY' && o.targetId) {
        const cat = categories.find(c => c.id === o.targetId);
        targetName = cat ? `Category: ${cat.name}` : `Category #${o.targetId}`;
      } else if (o.targetType === 'PRODUCT' && o.targetId) {
        const prod = products.find(p => p.id === o.targetId);
        targetName = prod ? `Product: ${prod.productName}` : `Product #${o.targetId}`;
      }

      const now = new Date();
      const isExpired = new Date(o.endDate) < now;
      const statusLabel = isExpired ? 'Expired' : (o.isActive ? 'Active' : 'Inactive');

      return {
        ...o,
        targetName,
        isExpired,
        statusLabel
      };
    });

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create trade offer
router.post('/', async (req, res) => {
  try {
    const { offerName, offerType, targetType, targetId, conditionValue, rewardValue, isActive, startDate, endDate } = req.body;
    const offer = await prisma.tradeOffer.create({
      data: {
        offerName,
        offerType,
        targetType,
        targetId: targetId ? Number(targetId) : null,
        conditionValue: Number(conditionValue || 1),
        rewardValue: Number(rewardValue || 0),
        isActive: Boolean(isActive),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 365 * 86400000)
      }
    });
    res.status(201).json(offer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update trade offer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { offerName, offerType, targetType, targetId, conditionValue, rewardValue, isActive, startDate, endDate } = req.body;
    const offer = await prisma.tradeOffer.update({
      where: { id: Number(id) },
      data: {
        offerName,
        offerType,
        targetType,
        targetId: targetId ? Number(targetId) : null,
        conditionValue: Number(conditionValue || 1),
        rewardValue: Number(rewardValue || 0),
        isActive: Boolean(isActive),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 365 * 86400000)
      }
    });
    res.json(offer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE trade offer
router.delete('/:id', async (req, res) => {
  try {
    await prisma.tradeOffer.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
