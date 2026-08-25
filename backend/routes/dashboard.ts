import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/summary', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's Sales
    const todaySalesData = await prisma.saleMain.aggregate({
      where: {
        date: { gte: today },
        ...tenantFilter
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    // Total counts
    const totalCustomers = await prisma.customerRec.count({
      where: tenantFilter
    });
    const totalProducts = await prisma.productRec.count({
      where: tenantFilter
    });

    // Low Stock Items (currentStock <= minLevel)
    const allProducts = await prisma.productRec.findMany({
      where: tenantFilter,
      include: { pCat: true }
    });

    const lowStockItems = allProducts.filter(p => (p.currentStock || 0) <= (p.minLevel || 5));
    const lowStockCount = lowStockItems.length;

    // Recent 5 Transactions
    const recentSales = await prisma.saleMain.findMany({
      where: tenantFilter,
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        customerRec: true
      }
    });

    // Grand Total Inventory Valuation (currentStock * costPrice)
    const totalInventoryValuation = allProducts.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.costPrice || 0)), 0);

    res.json({
      todaySalesTotal: todaySalesData._sum.totalAmount || 0,
      todayInvoicesCount: todaySalesData._count.id || 0,
      totalCustomers,
      totalProducts,
      lowStockCount,
      lowStockItems: lowStockItems.slice(0, 5).map(p => ({
        id: p.id,
        productCode: p.productCode || '',
        productName: p.productName,
        minLevel: p.minLevel || 5,
        openingQty: p.currentStock || 0
      })),
      recentSales: recentSales.map(s => ({
        id: s.id,
        invoiceNumber: `INV-${s.id}`,
        date: s.date,
        total: s.totalAmount,
        customerName: s.customerRec ? s.customerRec.custName : 'Walk-in Customer'
      })),
      totalInventoryValuation
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
