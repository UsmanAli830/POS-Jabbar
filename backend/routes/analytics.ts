import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics/kpis
router.get('/kpis', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Today's Sales
    const todaySalesData = await prisma.saleMain.aggregate({
      where: { date: { gte: todayStart }, ...tenantFilter },
      _sum: { totalAmount: true },
      _count: { id: true }
    });
    const todaySalesTotal = todaySalesData._sum.totalAmount || 0;
    const todayInvoicesCount = todaySalesData._count.id || 0;

    // 2. Total Revenue (Current Month)
    const monthSales = await prisma.saleMain.aggregate({
      where: { date: { gte: startOfMonth }, ...tenantFilter },
      _sum: { totalAmount: true }
    });
    const totalRevenue = monthSales._sum.totalAmount || 0;

    // 3. Total Expenses (Current Month)
    const expenses = await prisma.expenceRecord.aggregate({
      where: { date: { gte: startOfMonth }, ...tenantFilter },
      _sum: { amount: true }
    });
    const totalExpenses = expenses._sum.amount || 0;

    // 4. Total Accounts Receivable
    const customers = await prisma.customerRec.findMany({
      where: tenantFilter,
      include: { finHead: { include: { cashFlowDtls: true } } }
    });
    let totalAR = 0;
    for (const c of customers) {
      let bal = c.openingBalance || 0;
      if (c.finHead?.cashFlowDtls) {
        const dr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        const cr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        bal += (dr - cr);
      }
      if (bal > 0) totalAR += bal;
    }

    // 5. Total Accounts Payable
    const sellers = await prisma.sellerRec.findMany({
      where: tenantFilter,
      include: { finHead: { include: { cashFlowDtls: true } } }
    });
    let totalAP = 0;
    for (const v of sellers) {
      let bal = v.openingBalance || 0;
      if (v.finHead?.cashFlowDtls) {
        const cr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        const dr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        bal += (cr - dr);
      }
      if (bal > 0) totalAP += bal;
    }

    // 6. Low Stock Count
    const products = await prisma.productRec.findMany({
      where: tenantFilter
    });
    const lowStockCount = products.filter(p => (p.currentStock || 0) <= (p.minLevel || 5)).length;

    res.json({
      todaySalesTotal,
      todayInvoicesCount,
      totalRevenue,
      totalExpenses,
      totalAR,
      totalAP,
      lowStockCount,
      totalProducts: products.length
    });
  } catch (error: any) {
    console.error('Analytics KPI error:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// GET /api/analytics/revenue-expense-30d
router.get('/revenue-expense-30d', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sales = await prisma.saleMain.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: today }, ...tenantFilter }
    });

    const expenses = await prisma.expenceRecord.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: today }, ...tenantFilter }
    });

    const grouped: Record<string, { revenue: number; expense: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      grouped[dateStr] = { revenue: 0, expense: 0 };
    }

    sales.forEach(s => {
      const dateStr = new Date(s.date).toISOString().split('T')[0];
      if (grouped[dateStr]) {
        grouped[dateStr].revenue += (s.totalAmount || 0);
      }
    });

    expenses.forEach(e => {
      const dateStr = new Date(e.date).toISOString().split('T')[0];
      if (grouped[dateStr]) {
        grouped[dateStr].expense += (e.amount || 0);
      }
    });

    const data = Object.keys(grouped).sort().map(dateStr => {
      const d = new Date(dateStr);
      const dayName = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        name: dayName,
        Revenue: grouped[dateStr].revenue,
        Expenses: grouped[dateStr].expense
      };
    });

    res.json(data);
  } catch (error: any) {
    console.error('Analytics RevExp error:', error);
    res.status(500).json({ error: 'Failed to fetch RevExp data' });
  }
});

// GET /api/analytics/top-products
router.get('/top-products', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const topItems = await prisma.saleInvDtl.groupBy({
      by: ['productRecId'],
      where: {
        saleMain: tenantFilter
      },
      _sum: {
        qty: true,
        netAmount: true
      },
      orderBy: {
        _sum: {
          qty: 'desc'
        }
      },
      take: 5
    });

    const products = await prisma.productRec.findMany({
      where: { id: { in: topItems.map(item => Number(item.productRecId)) }, ...tenantFilter }
    });

    const data = topItems.map(item => {
      const prod = products.find(p => p.id === item.productRecId);
      return {
        id: item.productRecId,
        name: prod?.productName || 'Unknown Product',
        sold: item._sum?.qty || 0,
        revenue: item._sum?.netAmount || 0
      };
    });

    res.json(data);
  } catch (error: any) {
    console.error('Analytics Top Products error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/analytics/sales-deep
router.get('/sales-deep', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    // Helper to calculate accurate line-item net rate if netAmount is unpopulated/0 in DB
    const getLineNet = (item: any) => {
      let lineNet = item.netAmount || 0;
      if (lineNet <= 0 && item.qty > 0 && item.price > 0) {
        const gross = item.qty * item.price;
        const order = item.discountOrder;
        const discPct = item.discPercent || 0;
        const cashDisc = item.cashDiscount || 0;
        
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
      return lineNet;
    };

    // 1. Fetch products mapping
    const products = await prisma.productRec.findMany({
      where: tenantFilter,
      include: {
        pCat: true
      }
    });

    // 2. Fetch routes and zones
    const routes = await prisma.route.findMany({
      where: tenantFilter.companyId ? { OR: [{ companyId: tenantFilter.companyId }, { companyId: null }] } : {}
    });
    const zones = await prisma.zone.findMany({
      where: tenantFilter.companyId ? { OR: [{ companyId: tenantFilter.companyId }, { companyId: null }] } : {}
    });

    // 3. Fetch all SaleMain and details with date filtering
    const { startDate, endDate } = req.query;
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(String(startDate) + 'T00:00:00.000Z');
    }
    if (endDate) {
      dateFilter.lte = new Date(String(endDate) + 'T23:59:59.999Z');
    }

    const sales = await prisma.saleMain.findMany({
      where: {
        ...tenantFilter,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      },
      include: {
        customerRec: {
          select: {
            id: true,
            custName: true,
            businessName: true,
            routeId: true,
            zoneId: true
          }
        },
        details: {
          include: {
            productRec: {
              select: {
                id: true,
                productName: true,
                costPrice: true
              }
            }
          }
        }
      }
    });

    // --- AGGREGATIONS ---

    // A. Top Products
    const productSalesMap = new Map<number, { qtySold: number; salesValue: number }>();
    for (const sale of sales) {
      for (const item of sale.details) {
        if (!item.productRecId) continue;
        const existing = productSalesMap.get(item.productRecId) || { qtySold: 0, salesValue: 0 };
        existing.qtySold += item.qty || 0;
        existing.salesValue += getLineNet(item);
        productSalesMap.set(item.productRecId, existing);
      }
    }

    const topProducts = products.map(prod => {
      const ps = productSalesMap.get(prod.id) || { qtySold: 0, salesValue: 0 };
      const netProfit = ps.salesValue - (prod.costPrice * ps.qtySold);
      return {
        productId: prod.id,
        productName: prod.productName,
        categoryName: prod.pCat?.name || 'Uncategorized',
        qtySold: ps.qtySold,
        salesValue: ps.salesValue,
        netProfit: netProfit,
        marginPercent: ps.salesValue > 0 ? (netProfit / ps.salesValue) * 100 : 0
      };
    })
    .filter(p => p.qtySold > 0 || p.salesValue > 0)
    .sort((a, b) => b.netProfit - a.netProfit);

    // B. Top Customers
    const customers = await prisma.customerRec.findMany({
      where: tenantFilter
    });
    const customerAnalyticsMap = new Map<number, {
      totalBilling: number;
      totalProfit: number;
      productsMap: Map<number, { name: string; qty: number }>;
    }>();

    for (const sale of sales) {
      if (!sale.customerRecId) continue;
      const custId = sale.customerRecId;
      if (!customerAnalyticsMap.has(custId)) {
        customerAnalyticsMap.set(custId, {
          totalBilling: 0,
          totalProfit: 0,
          productsMap: new Map()
        });
      }

      const stats = customerAnalyticsMap.get(custId)!;
      stats.totalBilling += sale.totalAmount || 0;

      for (const item of sale.details) {
        const qty = item.qty || 0;
        const netAmount = getLineNet(item);
        const cost = item.productRec?.costPrice || 0;
        stats.totalProfit += (netAmount - (cost * qty));

        if (item.productRecId) {
          const prodName = item.productRec?.productName || 'Unknown Product';
          const pStats = stats.productsMap.get(item.productRecId) || { name: prodName, qty: 0 };
          pStats.qty += qty;
          stats.productsMap.set(item.productRecId, pStats);
        }
      }
    }

    const topCustomers = customers.map(cust => {
      const stats = customerAnalyticsMap.get(cust.id) || { totalBilling: 0, totalProfit: 0, productsMap: new Map() };
      const top3Products = Array.from(stats.productsMap.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 3)
        .map(p => `${p.name} (${p.qty})`);

      return {
        customerId: cust.id,
        customerName: cust.custName || cust.businessName || 'Unknown Customer',
        totalBilling: stats.totalBilling,
        totalProfit: stats.totalProfit,
        topProducts: top3Products
      };
    })
    .filter(c => c.totalBilling > 0 || c.totalProfit > 0)
    .sort((a, b) => b.totalProfit - a.totalProfit);

    // C. Loss & Discount Analysis
    const underCostItems: any[] = [];
    const discountLeakageMap = new Map<number, { name: string; totalDiscounts: number }>();

    for (const sale of sales) {
      // Discount Leakage
      if (sale.customerRecId && (sale.discountAmount || 0) > 0) {
        const custId = sale.customerRecId;
        const custName = sale.customerRec?.custName || sale.customerRec?.businessName || 'Unknown Customer';
        const dl = discountLeakageMap.get(custId) || { name: custName, totalDiscounts: 0 };
        dl.totalDiscounts += sale.discountAmount || 0;
        discountLeakageMap.set(custId, dl);
      }

      // Under-cost items
      for (const item of sale.details) {
        const qty = item.qty || 0;
        const netAmount = getLineNet(item);
        const cost = item.productRec?.costPrice || 0;
        const lossAmount = (cost * qty) - netAmount;

        if (qty > 0 && lossAmount > 0.01) {
          underCostItems.push({
            id: item.id,
            saleMainId: sale.id,
            date: sale.date,
            invoiceNumber: `INV-${sale.id}`,
            productName: item.productRec?.productName || 'Unknown Product',
            customerName: sale.customerRec?.custName || 'Walk-in Customer',
            costPrice: cost,
            sellingPrice: qty > 0 ? (netAmount / qty) : 0,
            qty,
            netAmount,
            lossAmount
          });
        }
      }
    }

    const discountLeakage = Array.from(discountLeakageMap.values())
      .sort((a, b) => b.totalDiscounts - a.totalDiscounts);

    underCostItems.sort((a, b) => b.lossAmount - a.lossAmount);

    // D. Route & Zone Analytics
    const routeNames = new Map<number, string>();
    const zoneNames = new Map<number, string>();
    routes.forEach(r => routeNames.set(r.id, r.name));
    zones.forEach(z => zoneNames.set(z.id, z.name));
    routeNames.set(0, 'Unassigned Route');
    zoneNames.set(0, 'Unassigned Zone');

    const routeToZone = new Map<number, number>();
    for (const cust of customers) {
      if (cust.routeId && cust.zoneId) {
        routeToZone.set(cust.routeId, cust.zoneId);
      }
    }

    const routeAnalyticsMap = new Map<number, { name: string; sales: number; profit: number; parentZoneName: string }>();
    const zoneAnalyticsMap = new Map<number, { name: string; sales: number; profit: number; contributingRoutes: any[] }>();
    const zoneRouteContributions = new Map<number, Map<number, { sales: number; profit: number }>>();

    // Seed Route Map
    routes.forEach(r => {
      const parentZoneId = routeToZone.get(r.id) || 0;
      const parentZoneName = zoneNames.get(parentZoneId) || 'Unassigned Zone';
      routeAnalyticsMap.set(r.id, { name: r.name, sales: 0, profit: 0, parentZoneName });
    });
    routeAnalyticsMap.set(0, { name: 'Unassigned Route', sales: 0, profit: 0, parentZoneName: 'Unassigned Zone' });

    // Seed Zone Map
    zones.forEach(z => {
      zoneAnalyticsMap.set(z.id, { name: z.name, sales: 0, profit: 0, contributingRoutes: [] });
      zoneRouteContributions.set(z.id, new Map());
    });
    zoneAnalyticsMap.set(0, { name: 'Unassigned Zone', sales: 0, profit: 0, contributingRoutes: [] });
    zoneRouteContributions.set(0, new Map());

    for (const sale of sales) {
      const routeId = sale.customerRec?.routeId || 0;
      const zoneId = sale.customerRec?.zoneId || 0;
      
      let saleVal = 0;
      let profitVal = 0;

      for (const item of sale.details) {
        const qty = item.qty || 0;
        const netAmount = getLineNet(item);
        const cost = item.productRec?.costPrice || 0;
        saleVal += netAmount;
        profitVal += (netAmount - (cost * qty));
      }

      // Add to Route
      const rData = routeAnalyticsMap.get(routeId);
      if (rData) {
        rData.sales += saleVal;
        rData.profit += profitVal;
      }

      // Add to Zone
      const zData = zoneAnalyticsMap.get(zoneId);
      if (zData) {
        zData.sales += saleVal;
        zData.profit += profitVal;
      }

      // Add to Zone -> Route Contribution
      const routeContrMap = zoneRouteContributions.get(zoneId);
      if (routeContrMap) {
        const rc = routeContrMap.get(routeId) || { sales: 0, profit: 0 };
        rc.sales += saleVal;
        rc.profit += profitVal;
        routeContrMap.set(routeId, rc);
      }
    }

    // Compile contributing routes for each zone
    zoneAnalyticsMap.forEach((zData, zoneId) => {
      const routeContrMap = zoneRouteContributions.get(zoneId);
      if (routeContrMap) {
        routeContrMap.forEach((stats, rId) => {
          const rName = routeNames.get(rId) || `Route ${rId}`;
          zData.contributingRoutes.push({
            routeId: rId,
            routeName: rName,
            sales: stats.sales,
            profit: stats.profit
          });
        });
      }
    });

    const routeAnalytics = Array.from(routeAnalyticsMap.values()).filter(r => r.sales > 0 || r.profit > 0);
    const zoneAnalytics = Array.from(zoneAnalyticsMap.values()).filter(z => z.sales > 0 || z.profit > 0);

    res.json({
      topProducts,
      topCustomers,
      underCostItems,
      discountLeakage,
      routeAnalytics,
      zoneAnalytics
    });
  } catch (error: any) {
    console.error('Deep sales analysis endpoint error:', error);
    res.status(500).json({ error: 'Failed to compute deep sales analysis', details: error.message || error });
  }
});

export default router;
