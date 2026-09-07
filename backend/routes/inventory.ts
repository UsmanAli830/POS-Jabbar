import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();

// GET /api/inventory (Main Inventory stock list for active tenant)
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const products = await prisma.productRec.findMany({
      where: tenantFilter,
      include: {
        pCat: true,
        subCat: true,
        company: true
      },
      orderBy: { productName: 'asc' }
    });

    const stockList = products.map(p => ({
      id: p.id,
      productCode: p.productCode || '',
      barCode: p.barCode || '',
      productName: p.productName,
      salePrice: p.retailPrice ?? 0,
      costPrice: p.costPrice ?? 0,
      stock: p.currentStock ?? 0,
      minLevel: p.minLevel ?? 0,
      dangerLevel: p.dangerLevel ?? 0,
      categoryName: p.pCat?.name || 'General'
    }));

    res.json(stockList);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch inventory', details: error });
  }
});

// GET /api/inventory/stock/:locationId (Stock list for location filtered by tenant)
router.get('/stock/:locationId', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const products = await prisma.productRec.findMany({
      where: tenantFilter,
      include: {
        pCat: true,
        company: true
      },
      orderBy: { productName: 'asc' }
    });

    const stockList = products.map(p => ({
      id: p.id,
      productCode: p.productCode || '',
      barCode: p.barCode || '',
      productName: p.productName,
      salePrice: p.retailPrice ?? 0,
      costPrice: p.costPrice ?? 0,
      stock: p.currentStock ?? 0
    }));

    res.json(stockList);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch stock for location', details: error });
  }
});

// POST /api/inventory/adjust (Stock adjustment on ProductRec)
router.post('/adjust', async (req, res) => {
  try {
    const { productId, locationId, quantity, referenceNotes, targetLedger } = req.body;
    const tenantFilter = getTenantFilter(req);

    const product = await prisma.productRec.findFirst({
      where: { id: Number(productId), ...tenantFilter }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    const adjQty = Number(quantity);

    const updated = await prisma.productRec.update({
      where: { id: product.id },
      data: {
        currentStock: {
          increment: adjQty
        }
      }
    });

    res.status(201).json({
      success: true,
      productId: updated.id,
      productName: updated.productName,
      newStock: updated.currentStock
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to adjust stock', details: error });
  }
});

// POST /api/inventory/reset-negatives (Reset negative stock values to 0)
router.post('/reset-negatives', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const negativeProducts = await prisma.productRec.findMany({
      where: {
        currentStock: { lt: 0 },
        ...tenantFilter
      }
    });

    let fixedCount = 0;
    for (const p of negativeProducts) {
      await prisma.productRec.update({
        where: { id: p.id },
        data: { currentStock: 0 }
      });
      fixedCount++;
    }

    res.json({ message: 'Cleanup complete', fixedCount });
  } catch (error: any) {
    console.error('Reset negatives error:', error);
    res.status(500).json({ error: 'Failed to reset negative stock' });
  }
});

export default router;
