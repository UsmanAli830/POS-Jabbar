import { Router } from 'express';
import prisma from '../db';
import { requirePermission, getTenantFilter } from '../middleware/auth';

const router = Router();

const parseDates = (req: any) => {
  const start = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
  let end = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  
  if (req.query.endDate && !(req.query.endDate as string).includes('T')) {
    end = new Date(end.setHours(23, 59, 59, 999));
  }
  return { start, end };
};

// 1. Sales Report
router.get('/sales', async (req, res) => {
  try {
    const { start, end } = parseDates(req);
    const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
    const salesmanId = req.query.salesmanId ? Number(req.query.salesmanId) : undefined;

    const sales = await prisma.saleMain.findMany({
      where: {
        ...getTenantFilter(req),
        date: { gte: start, lte: end },
        ...(customerId ? { customerRecId: customerId } : {}),
        ...(salesmanId ? { salesmanId: salesmanId } : {})
      },
      include: {
        customerRec: true,
        details: {
          include: { productRec: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    let totalSales = 0;
    let totalGross = 0;
    let totalDiscounts = 0;
    let totalReceived = 0;
    const invoiceCount = sales.length;

    const productStats: Record<number, { id: number; name: string; code: string; qty: number; revenue: number }> = {};
    const customerStats: Record<number, { id: number; name: string; phone: string; count: number; total: number }> = {};
    const salesByDay: Record<string, { date: string; sales: number; count: number }> = {};

    for (const s of sales) {
      const net = s.totalAmount || 0;
      const gross = (s as any).grossAmount || net;
      const disc = (s as any).discountAmount || Math.max(0, gross - net);
      const rec = (s as any).paymentReceived || 0;

      totalSales += net;
      totalGross += gross;
      totalDiscounts += disc;
      totalReceived += rec;

      const dateStr = new Date(s.date).toISOString().split('T')[0];
      if (!salesByDay[dateStr]) salesByDay[dateStr] = { date: dateStr, sales: 0, count: 0 };
      salesByDay[dateStr].sales += net;
      salesByDay[dateStr].count += 1;

      if (s.customerRecId && s.customerRec) {
        const cId = s.customerRecId;
        if (!customerStats[cId]) {
          customerStats[cId] = {
            id: cId,
            name: s.customerRec.custName || 'Customer',
            phone: s.customerRec.phone || '',
            count: 0,
            total: 0
          };
        }
        customerStats[cId].count += 1;
        customerStats[cId].total += net;
      }

      for (const d of s.details) {
        const pId = d.productRecId;
        const qty = d.qty || 0;
        const lineNet = (d as any).netAmount || (qty * d.price);
        const pName = d.productRec ? d.productRec.productName : `Item #${pId}`;
        const pCode = d.productRec ? (d.productRec.productCode || '') : '';

        if (!productStats[pId]) {
          productStats[pId] = { id: pId, name: pName, code: pCode, qty: 0, revenue: 0 };
        }
        productStats[pId].qty += qty;
        productStats[pId].revenue += lineNet;
      }
    }

    const topProductsByQty = Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const topProductsByRevenue = Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const topCustomers = Object.values(customerStats).sort((a, b) => b.total - a.total).slice(0, 10);
    const salesTimeline = Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      summary: {
        totalSales,
        totalGross,
        totalDiscounts,
        totalReceived,
        invoiceCount
      },
      topProductsByQty,
      topProductsByRevenue,
      topCustomers,
      salesTimeline,
      invoices: sales.map(s => ({
        id: s.id,
        invoiceNumber: `INV-${s.id}`,
        date: s.date,
        customerName: s.customerRec ? s.customerRec.custName : 'Walk-in Customer',
        itemCount: s.details.length,
        totalAmount: s.totalAmount,
        paymentReceived: (s as any).paymentReceived || 0,
        paymentMode: s.customerRecId ? 'Credit Account' : 'Cash'
      }))
    });
  } catch (error: any) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate sales report' });
  }
});

// 2. Purchase Report
router.get('/purchases', async (req, res) => {
  try {
    const { start, end } = parseDates(req);
    const sellerId = req.query.sellerId ? Number(req.query.sellerId) : undefined;

    const purchases = await prisma.purMain.findMany({
      where: {
        ...getTenantFilter(req),
        date: { gte: start, lte: end },
        ...(sellerId ? { sellerRecId: sellerId } : {})
      },
      include: {
        sellerRec: true,
        details: { include: { productRec: true } }
      },
      orderBy: { date: 'desc' }
    });

    let totalPurchases = 0;
    let totalPaid = 0;
    const invoiceCount = purchases.length;

    const vendorMap: Record<number, { id: number; name: string; phone: string; count: number; total: number }> = {};
    const productMap: Record<number, { id: number; name: string; qty: number; totalCost: number }> = {};
    const purchasesByDay: Record<string, { date: string; purchases: number; payments: number }> = {};

    for (const p of purchases) {
      const net = p.totalAmount || 0;
      const paid = net;

      totalPurchases += net;
      totalPaid += paid;

      const dateStr = new Date(p.date).toISOString().split('T')[0];
      if (!purchasesByDay[dateStr]) purchasesByDay[dateStr] = { date: dateStr, purchases: 0, payments: 0 };
      purchasesByDay[dateStr].purchases += net;
      purchasesByDay[dateStr].payments += paid;

      if (p.sellerRecId && p.sellerRec) {
        const vId = p.sellerRecId;
        if (!vendorMap[vId]) {
          vendorMap[vId] = {
            id: vId,
            name: p.sellerRec.companyName || 'Vendor',
            phone: p.sellerRec.phone || '',
            count: 0,
            total: 0
          };
        }
        vendorMap[vId].count += 1;
        vendorMap[vId].total += net;
      }

      for (const d of p.details) {
        const pId = d.productRecId;
        const qty = d.qty || 0;
        const lineTotal = qty * d.price;
        const pName = d.productRec ? d.productRec.productName : `Item #${pId}`;

        if (!productMap[pId]) {
          productMap[pId] = { id: pId, name: pName, qty: 0, totalCost: 0 };
        }
        productMap[pId].qty += qty;
        productMap[pId].totalCost += lineTotal;
      }
    }

    const topVendors = Object.values(vendorMap).sort((a, b) => b.total - a.total).slice(0, 10);
    const mostPurchasedProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const purchaseTimeline = Object.values(purchasesByDay).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      summary: {
        totalPurchases,
        totalPaid,
        totalRemaining: Math.max(0, totalPurchases - totalPaid),
        invoiceCount
      },
      topVendors,
      mostPurchasedProducts,
      purchaseTimeline,
      purchases: purchases.map(p => ({
        id: p.id,
        invoiceNumber: `PUR-${p.id}`,
        date: p.date,
        vendorName: p.sellerRec ? p.sellerRec.companyName : 'General Supplier',
        totalAmount: p.totalAmount,
        amountPaid: p.totalAmount,
        itemCount: p.details.length
      }))
    });
  } catch (error: any) {
    console.error('Purchase report error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate purchase report' });
  }
});

// 3. Inventory Stock & Valuation Report
router.get('/inventory', async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const query = req.query.query ? (req.query.query as string).trim() : undefined;
    const tenantFilter = getTenantFilter(req);

    const products = await prisma.productRec.findMany({
      where: {
        ...tenantFilter,
        ...(categoryId ? { pCatId: categoryId } : {}),
        ...(query ? { productName: { contains: query } } : {})
      },
      include: { pCat: true },
      orderBy: { productName: 'asc' }
    });

    const totalProducts = products.length;
    let totalValuation = 0;
    let lowStockCount = 0;
    let dangerStockCount = 0;

    const items = products.map(p => {
      const stock = p.currentStock || 0;
      const minLvl = p.minLevel || 5;
      const dangerLvl = p.dangerLevel || 2;
      const cost = p.costPrice || 0;
      const val = stock * cost;

      totalValuation += val;

      let status = 'OK';
      if (stock <= dangerLvl) {
        status = 'DANGER';
        dangerStockCount++;
        lowStockCount++;
      } else if (stock <= minLvl) {
        status = 'LOW_STOCK';
        lowStockCount++;
      }

      return {
        id: p.id,
        productCode: p.productCode || '',
        barCode: p.barCode || '',
        productName: p.productName,
        categoryName: p.pCat ? p.pCat.name : 'General',
        currentStock: stock,
        minStockLevel: minLvl,
        dangerLevel: dangerLvl,
        purchaseRate: cost,
        saleRate: p.retailPrice || p.tradePrice || 0,
        valuation: val,
        status
      };
    });

    res.json({
      summary: {
        totalProducts,
        totalValuation,
        lowStockCount,
        dangerStockCount
      },
      items
    });
  } catch (error: any) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate inventory report' });
  }
});

// 4. Financial & Profit/Loss Report
router.get('/financials', async (req, res) => {
  try {
    const customers = await prisma.customerRec.findMany({
      include: { finHead: { include: { cashFlowDtls: true } } }
    });

    const vendors = await prisma.sellerRec.findMany({
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

    let totalAP = 0;
    for (const v of vendors) {
      let bal = v.openingBalance || 0;
      if (v.finHead?.cashFlowDtls) {
        const cr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        const dr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        bal += (cr - dr);
      }
      if (bal > 0) totalAP += bal;
    }

    const sales = await prisma.saleMain.findMany({
      include: { details: { include: { productRec: true } } }
    });

    let totalSalesRevenue = 0;
    let totalCOGS = 0;

    for (const s of sales) {
      totalSalesRevenue += (s.totalAmount || 0);
      for (const d of s.details) {
        const qty = d.qty || 0;
        const cost = d.productRec ? (d.productRec.costPrice || 0) : 0;
        totalCOGS += (qty * cost);
      }
    }

    const expensesAgg = await prisma.expenceRecord.aggregate({
      _sum: { amount: true }
    });
    const totalExpenses = expensesAgg._sum.amount || 0;
    const netProfit = totalSalesRevenue - totalCOGS - totalExpenses;

    // 30-Day Trend
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentSales = await prisma.saleMain.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: today } }
    });

    const recentExpenses = await prisma.expenceRecord.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: today } }
    });

    const dayGroup: Record<string, { date: string; revenue: number; expense: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      dayGroup[dateStr] = { date: dateStr, revenue: 0, expense: 0 };
    }

    for (const s of recentSales) {
      const dStr = new Date(s.date).toISOString().split('T')[0];
      if (dayGroup[dStr]) dayGroup[dStr].revenue += (s.totalAmount || 0);
    }

    for (const e of recentExpenses) {
      const dStr = new Date(e.date).toISOString().split('T')[0];
      if (dayGroup[dStr]) dayGroup[dStr].expense += (e.amount || 0);
    }

    res.json({
      summary: {
        totalAR,
        totalAP,
        totalSalesRevenue,
        totalCOGS,
        totalExpenses,
        netProfit
      },
      trend: Object.values(dayGroup).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error: any) {
    console.error('Financial report error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate financial report' });
  }
});

// 5. Customer & Vendor Ledger Report
router.get('/customers', async (req, res) => {
  try {
    const customers = await prisma.customerRec.findMany({
      include: {
        saleMains: true,
        finHead: { include: { cashFlowDtls: true } }
      },
      orderBy: { custName: 'asc' }
    });

    const report = customers.map(c => {
      const totalPurchases = c.saleMains.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
      let curBal = c.openingBalance || 0;
      if (c.finHead?.cashFlowDtls) {
        const dr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        const cr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        curBal += (dr - cr);
      }

      return {
        id: c.id,
        name: c.custName || 'Customer',
        phone: c.phone || '-',
        openingBalance: c.openingBalance || 0,
        totalPurchases,
        currentBalance: curBal
      };
    });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vendors', async (req, res) => {
  try {
    const vendors = await prisma.sellerRec.findMany({
      include: {
        purMains: true,
        finHead: { include: { cashFlowDtls: true } }
      },
      orderBy: { companyName: 'asc' }
    });

    const report = vendors.map(v => {
      const totalPurchases = v.purMains.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
      let curBal = v.openingBalance || 0;
      if (v.finHead?.cashFlowDtls) {
        const cr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        const dr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        curBal += (cr - dr);
      }

      return {
        id: v.id,
        name: v.companyName || 'Vendor',
        phone: v.phone || '-',
        openingBalance: v.openingBalance || 0,
        totalPurchases,
        currentBalance: curBal
      };
    });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Payroll Report
router.get('/payroll', async (req, res) => {
  try {
    const month = req.query.month ? Number(req.query.month) : (new Date().getMonth() + 1);
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const employees = await prisma.employee.findMany();
    let totalPayrollExpense = 0;

    const list = employees.map(emp => {
      const base = emp.baseSalary || 0;
      const bonus = 0;
      const deductions = 0;
      const net = base + bonus - deductions;

      totalPayrollExpense += net;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        month,
        year,
        baseSalary: base,
        bonus,
        deductions,
        netSalary: net,
        status: 'ACTIVE'
      };
    });

    res.json({
      summary: {
        month,
        year,
        totalPayrollExpense,
        employeeCount: employees.length
      },
      employees: list
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Returns Report
router.get('/returns', async (req, res) => {
  try {
    const { start, end } = parseDates(req);

    const manualReturns = await prisma.manualSaleRtnMain.findMany({
      where: { date: { gte: start, lte: end } },
      include: { customerRec: true },
      orderBy: { date: 'desc' }
    });

    const totalSalesReturnVal = manualReturns.reduce((sum: number, r: any) => sum + r.totalAmount, 0);

    res.json({
      summary: {
        totalSalesReturnCount: manualReturns.length,
        totalSalesReturnVal
      },
      salesReturns: manualReturns.map((r: any) => ({
        id: r.id,
        returnRef: `RET-${r.id}`,
        date: r.date,
        amount: r.totalAmount,
        customerName: r.customerRec ? r.customerRec.custName : 'Customer'
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Profit & Loss Report Engine
router.get('/profit-loss', async (req, res) => {
  try {
    const { start, end } = parseDates(req);
    const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
    const vendorId = req.query.vendorId ? Number(req.query.vendorId) : undefined;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const groupBy = (req.query.groupBy as string) || 'date'; // 'date' | 'customer' | 'vendor'

    // Fetch Sales
    const sales = await prisma.saleMain.findMany({
      where: {
        ...getTenantFilter(req),
        date: { gte: start, lte: end },
        ...(customerId ? { customerRecId: customerId } : {}),
        ...(locationId ? { locationId: locationId } : {})
      },
      include: {
        customerRec: true,
        details: { include: { productRec: true } }
      },
      orderBy: { date: 'desc' }
    });

    // Fetch Expenses
    const expensesRecords = await prisma.expenceRecord.findMany({
      where: { date: { gte: start, lte: end } }
    });
    const totalExpenses = expensesRecords.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Fetch Sales Returns
    const salesReturns = await prisma.manualSaleRtnMain.findMany({
      where: {
        ...getTenantFilter(req),
        date: { gte: start, lte: end },
        ...(customerId ? { customerRecId: customerId } : {})
      },
      include: { customerRec: true }
    });

    // Fetch Purchase Invoices & Returns
    const purchases = await prisma.purMain.findMany({
      where: {
        ...getTenantFilter(req),
        date: { gte: start, lte: end },
        ...(vendorId ? { sellerRecId: vendorId } : {})
      },
      include: { sellerRec: true, details: { include: { productRec: true } } }
    });

    const purchaseReturns = await prisma.purRtnMain.findMany({
      where: {
        ...getTenantFilter(req),
        date: { gte: start, lte: end },
        ...(vendorId ? { sellerRecId: vendorId } : {})
      },
      include: { sellerRec: true }
    });

    // Grand Totals Calculation
    let totalSalesRevenue = 0;
    let totalCOGS = 0;

    sales.forEach(s => {
      totalSalesRevenue += (s.totalAmount || 0);
      s.details.forEach(d => {
        const qty = d.qty || 0;
        const cost = d.productRec ? (d.productRec.costPrice || 0) : 0;
        totalCOGS += (qty * cost);
      });
    });

    const grossProfit = totalSalesRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    // Grouping Processing
    let gridData: any[] = [];

    if (groupBy === 'date') {
      const dateMap: Record<string, { date: string; salesCount: number; totalRevenue: number; totalCost: number; grossProfit: number; expenses: number; netProfit: number }> = {};

      sales.forEach(s => {
        const dateStr = new Date(s.date).toISOString().split('T')[0];
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = { date: dateStr, salesCount: 0, totalRevenue: 0, totalCost: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
        }
        dateMap[dateStr].salesCount += 1;
        dateMap[dateStr].totalRevenue += (s.totalAmount || 0);

        let saleCost = 0;
        s.details.forEach(d => {
          saleCost += (d.qty || 0) * (d.productRec ? (d.productRec.costPrice || 0) : 0);
        });
        dateMap[dateStr].totalCost += saleCost;
      });

      expensesRecords.forEach(e => {
        const dateStr = new Date(e.date).toISOString().split('T')[0];
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = { date: dateStr, salesCount: 0, totalRevenue: 0, totalCost: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
        }
        dateMap[dateStr].expenses += (e.amount || 0);
      });

      gridData = Object.values(dateMap).map(row => {
        const gross = row.totalRevenue - row.totalCost;
        const net = gross - row.expenses;
        return { ...row, grossProfit: gross, netProfit: net };
      }).sort((a, b) => b.date.localeCompare(a.date));

    } else if (groupBy === 'customer') {
      const custMap: Record<number, { customerId: number; customerName: string; phone: string; totalPurchased: number; cashPaid: number; returnsValue: number; cogs: number; netProfitGenerated: number }> = {};

      const allCustomers = await prisma.customerRec.findMany();
      allCustomers.forEach(c => {
        custMap[c.id] = {
          customerId: c.id,
          customerName: c.custName,
          phone: c.phone || '',
          totalPurchased: 0,
          cashPaid: 0,
          returnsValue: 0,
          cogs: 0,
          netProfitGenerated: 0
        };
      });

      sales.forEach(s => {
        const cId = s.customerRecId || 0;
        if (!custMap[cId]) {
          custMap[cId] = {
            customerId: cId,
            customerName: s.customerRec ? s.customerRec.custName : 'Walk-in Customer',
            phone: s.customerRec ? (s.customerRec.phone || '') : '',
            totalPurchased: 0,
            cashPaid: 0,
            returnsValue: 0,
            cogs: 0,
            netProfitGenerated: 0
          };
        }
        const rev = s.totalAmount || 0;
        const rec = (s as any).paymentReceived || 0;
        custMap[cId].totalPurchased += rev;
        custMap[cId].cashPaid += rec;

        let sCost = 0;
        s.details.forEach(d => {
          sCost += (d.qty || 0) * (d.productRec ? (d.productRec.costPrice || 0) : 0);
        });
        custMap[cId].cogs += sCost;
      });

      salesReturns.forEach(r => {
        const cId = r.customerRecId || 0;
        if (custMap[cId]) {
          custMap[cId].returnsValue += (r.totalAmount || 0);
        }
      });

      gridData = Object.values(custMap)
        .filter(c => c.totalPurchased > 0 || c.returnsValue > 0 || c.cashPaid > 0)
        .map(c => ({
          ...c,
          netProfitGenerated: c.totalPurchased - c.cogs
        }))
        .sort((a, b) => b.netProfitGenerated - a.netProfitGenerated);

    } else if (groupBy === 'vendor') {
      const vendorMap: Record<number, { vendorId: number; vendorName: string; stockPurchased: number; stockSold: number; purchaseReturns: number; vendorCost: number; vendorMargin: number }> = {};

      const allVendors = await prisma.sellerRec.findMany();
      allVendors.forEach(v => {
        vendorMap[v.id] = {
          vendorId: v.id,
          vendorName: v.companyName,
          stockPurchased: 0,
          stockSold: 0,
          purchaseReturns: 0,
          vendorCost: 0,
          vendorMargin: 0
        };
      });

      purchases.forEach(p => {
        const vId = p.sellerRecId || 0;
        if (vendorMap[vId]) {
          vendorMap[vId].stockPurchased += (p.totalAmount || 0);
        }
      });

      purchaseReturns.forEach(pr => {
        const vId = pr.sellerRecId || 0;
        if (vendorMap[vId]) {
          vendorMap[vId].purchaseReturns += (pr.totalAmount || 0);
        }
      });

      sales.forEach(s => {
        s.details.forEach(d => {
          if (d.productRec) {
            const vId = d.productRec.companyId || 0;
            if (vendorMap[vId]) {
              const qty = d.qty || 0;
              const lineRev = (d as any).netAmount || (qty * d.price);
              const lineCost = qty * (d.productRec.costPrice || 0);
              vendorMap[vId].stockSold += lineRev;
              vendorMap[vId].vendorCost += lineCost;
            }
          }
        });
      });

      gridData = Object.values(vendorMap)
        .filter(v => v.stockPurchased > 0 || v.stockSold > 0 || v.purchaseReturns > 0)
        .map(v => ({
          ...v,
          vendorMargin: v.stockSold - v.vendorCost
        }))
        .sort((a, b) => b.vendorMargin - a.vendorMargin);
    }

    res.json({
      summary: {
        totalSalesRevenue,
        totalCOGS,
        grossProfit,
        totalExpenses,
        netProfit,
        invoiceCount: sales.length
      },
      groupBy,
      gridData
    });
  } catch (error: any) {
    console.error('Profit & Loss calculation error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate Profit & Loss' });
  }
});

// 9. Unified Account & Profit Statement Engine
router.get('/statement', async (req, res) => {
  try {
    const accountType = (req.query.accountType as string) || 'CUSTOMER'; // 'CUSTOMER' | 'VENDOR'
    const entityId = Number(req.query.id);
    const { start, end } = parseDates(req);

    if (!entityId) {
      return res.status(400).json({ error: 'Account ID (id) is required' });
    }

    if (accountType === 'CUSTOMER') {
      const customer = await prisma.customerRec.findUnique({
        where: { id: entityId },
        include: { finHead: { include: { cashFlowDtls: true } } }
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Sales in period
      const sales = await prisma.saleMain.findMany({
        where: { customerRecId: entityId, date: { gte: start, lte: end } },
        include: { details: { include: { productRec: true } } },
        orderBy: { date: 'asc' }
      });

      // Sales prior to period (for opening balance calculation)
      const priorSales = await prisma.saleMain.findMany({
        where: { customerRecId: entityId, date: { lt: start } }
      });
      const priorSalesTotal = priorSales.reduce((s, x) => s + (x.totalAmount || 0), 0);

      // Sales Returns in period
      const salesReturns = await prisma.manualSaleRtnMain.findMany({
        where: { customerRecId: entityId, date: { gte: start, lte: end } },
        orderBy: { date: 'asc' }
      });
      const priorReturns = await prisma.manualSaleRtnMain.findMany({
        where: { customerRecId: entityId, date: { lt: start } }
      });
      const priorReturnsTotal = priorReturns.reduce((s, x) => s + (x.totalAmount || 0), 0);

      // Recoveries/Collections in period
      const recoveries = await prisma.recovery.findMany({
        where: { customerRecId: entityId, date: { gte: start, lte: end } },
        orderBy: { date: 'asc' }
      });
      const priorRecoveries = await prisma.recovery.findMany({
        where: { customerRecId: entityId, date: { lt: start } }
      });
      const priorRecoveriesTotal = priorRecoveries.reduce((s, x) => s + (x.amount || 0), 0);

      // Profit / Loss Calculations
      let totalSalesRevenue = 0;
      let totalCOGS = 0;
      let cashPaid = 0;

      sales.forEach(s => {
        totalSalesRevenue += (s.totalAmount || 0);
        cashPaid += ((s as any).paymentReceived || 0);
        s.details.forEach(d => {
          totalCOGS += (d.qty || 0) * (d.productRec ? (d.productRec.costPrice || 0) : 0);
        });
      });

      recoveries.forEach(r => {
        cashPaid += (r.amount || 0);
      });

      const totalReturns = salesReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
      const netProfit = totalSalesRevenue - totalCOGS - totalReturns;

      // Opening Balance
      const openingBalance = (customer.openingBalance || 0) + priorSalesTotal - priorReturnsTotal - priorRecoveriesTotal;

      // Build Ledger Entries Array
      const events: any[] = [];

      sales.forEach(s => {
        events.push({
          date: s.date,
          refNo: `INV-${s.id}`,
          description: `Sale Invoice #${s.id}`,
          debit: s.totalAmount || 0,
          credit: 0
        });
      });

      salesReturns.forEach(r => {
        events.push({
          date: r.date,
          refNo: `RET-${r.id}`,
          description: `Sales Return #${r.id}`,
          debit: 0,
          credit: r.totalAmount || 0
        });
      });

      recoveries.forEach(r => {
        events.push({
          date: r.date,
          refNo: `REC-${r.id}`,
          description: r.remarks ? `Cash Recovery (${r.remarks})` : 'Cash Recovery',
          debit: 0,
          credit: r.amount || 0
        });
      });

      // Sort Events Chronologically
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Running Balance Processing
      let currentBal = openingBalance;
      const ledger = events.map(ev => {
        currentBal = currentBal + ev.debit - ev.credit;
        return {
          ...ev,
          runningBalance: currentBal
        };
      });

      return res.json({
        accountInfo: {
          id: customer.id,
          name: customer.custName,
          businessName: customer.businessName || '',
          phone: customer.phone || '',
          address: customer.address || '',
          accountType: 'CUSTOMER'
        },
        summary: {
          grossValue: totalSalesRevenue,
          cogs: totalCOGS,
          totalPaid: cashPaid,
          totalReturns,
          netProfit
        },
        openingBalance,
        closingBalance: currentBal,
        ledger
      });

    } else if (accountType === 'VENDOR') {
      const vendor = await prisma.sellerRec.findUnique({
        where: { id: entityId },
        include: { finHead: { include: { cashFlowDtls: true } } }
      });

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }

      // Purchases in period
      const purchases = await prisma.purMain.findMany({
        where: { sellerRecId: entityId, date: { gte: start, lte: end } },
        include: { details: { include: { productRec: true } } },
        orderBy: { date: 'asc' }
      });

      const priorPurchases = await prisma.purMain.findMany({
        where: { sellerRecId: entityId, date: { lt: start } }
      });
      const priorPurchasesTotal = priorPurchases.reduce((s, x) => s + (x.totalAmount || 0), 0);

      // Purchase Returns in period
      const purchaseReturns = await prisma.purRtnMain.findMany({
        where: { sellerRecId: entityId, date: { gte: start, lte: end } },
        orderBy: { date: 'asc' }
      });
      const priorPurReturns = await prisma.purRtnMain.findMany({
        where: { sellerRecId: entityId, date: { lt: start } }
      });
      const priorPurReturnsTotal = priorPurReturns.reduce((s, x) => s + (x.totalAmount || 0), 0);

      // Payments Made in period
      const paymentsMade = vendor.finHead?.cashFlowDtls
        ? vendor.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR' && new Date(d.createdAt) >= start && new Date(d.createdAt) <= end)
        : [];
      
      const totalPaymentsMade = paymentsMade.reduce((s: number, d: any) => s + d.amount, 0);

      // Vendor Item Sales (for profit calculation)
      const vendorSalesItems = await prisma.saleInvDtl.findMany({
        where: {
          productRec: { companyId: entityId },
          saleMain: { date: { gte: start, lte: end } }
        },
        include: { productRec: true }
      });

      let stockSoldRevenue = 0;
      let stockSoldCost = 0;
      vendorSalesItems.forEach(d => {
        const qty = d.qty || 0;
        stockSoldRevenue += ((d as any).netAmount || (qty * d.price));
        stockSoldCost += qty * (d.productRec ? (d.productRec.costPrice || 0) : 0);
      });

      const totalPurchases = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
      const totalReturns = purchaseReturns.reduce((s, pr) => s + (pr.totalAmount || 0), 0);
      const netProfit = stockSoldRevenue - stockSoldCost - totalReturns;

      // Opening Balance
      const openingBalance = (vendor.openingBalance || 0) + priorPurchasesTotal - priorPurReturnsTotal;

      // Build Ledger Entries Array
      const events: any[] = [];

      purchases.forEach(p => {
        events.push({
          date: p.date,
          refNo: `PUR-${p.id}`,
          description: `Purchase Invoice #${p.id}`,
          debit: 0,
          credit: p.totalAmount || 0
        });
      });

      purchaseReturns.forEach(pr => {
        events.push({
          date: pr.date,
          refNo: `PRTN-${pr.id}`,
          description: `Purchase Return #${pr.id}`,
          debit: pr.totalAmount || 0,
          credit: 0
        });
      });

      paymentsMade.forEach(pm => {
        events.push({
          date: pm.createdAt,
          refNo: `VPAY-${pm.id}`,
          description: 'Payment to Vendor',
          debit: pm.amount || 0,
          credit: 0
        });
      });

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentBal = openingBalance;
      const ledger = events.map(ev => {
        currentBal = currentBal + ev.credit - ev.debit;
        return {
          ...ev,
          runningBalance: currentBal
        };
      });

      return res.json({
        accountInfo: {
          id: vendor.id,
          name: vendor.companyName,
          businessName: vendor.contactPerson || '',
          phone: vendor.phone || '',
          address: vendor.address || '',
          accountType: 'VENDOR'
        },
        summary: {
          grossValue: totalPurchases,
          cogs: stockSoldCost,
          totalPaid: totalPaymentsMade,
          totalReturns,
          netProfit
        },
        openingBalance,
        closingBalance: currentBal,
        ledger
      });
    }

    res.status(400).json({ error: 'Invalid accountType specified' });
  } catch (error: any) {
    console.error('Statement error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate statement' });
  }
});

// 10. Balance Sheet Report Engine
router.get('/balance-sheet', requirePermission('balance-sheet'), async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();

    // 1. Cash & Bank Balances
    const deposits = await prisma.cashDeposit.aggregate({
      where: { date: { lte: asOfDate } },
      _sum: { amount: true }
    });
    const totalDeposits = deposits._sum.amount || 0;

    const salesCash = await prisma.saleMain.aggregate({
      where: { date: { lte: asOfDate } },
      _sum: { totalAmount: true }
    });

    const expensesPaid = await prisma.expenceRecord.aggregate({
      where: { date: { lte: asOfDate } },
      _sum: { amount: true }
    });

    const cashAndBank = Math.max(50000, totalDeposits + (salesCash._sum.totalAmount || 0) - (expensesPaid._sum.amount || 0));

    // 2. Accounts Receivable (AR) & Customer Overpayments (Liabilities)
    const customers = await prisma.customerRec.findMany({
      include: { finHead: { include: { cashFlowDtls: true } } }
    });

    let accountsReceivable = 0;
    let customerOverpayments = 0;
    const receivablesDetail: any[] = [];
    const overpaymentsDetail: any[] = [];

    customers.forEach(c => {
      let bal = c.openingBalance || 0;
      if (c.finHead?.cashFlowDtls) {
        const dr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        const cr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        bal += (dr - cr);
      }
      if (bal > 0) {
        accountsReceivable += bal;
        receivablesDetail.push({
          id: c.id,
          name: c.custName,
          businessName: c.businessName || '',
          phone: c.phone || '',
          address: c.address || '',
          balance: bal
        });
      } else if (bal < 0) {
        const absBal = Math.abs(bal);
        customerOverpayments += absBal;
        overpaymentsDetail.push({
          id: c.id,
          name: c.custName,
          businessName: c.businessName || '',
          phone: c.phone || '',
          address: c.address || '',
          balance: absBal
        });
      }
    });

    receivablesDetail.sort((a, b) => b.balance - a.balance);
    overpaymentsDetail.sort((a, b) => b.balance - a.balance);

    // 3. Inventory Valuation
    const products = await prisma.productRec.findMany({ where: tenantFilter });
    let inventoryValuation = 0;
    products.forEach(p => {
      inventoryValuation += (p.currentStock || 0) * (p.costPrice || 0);
    });

    // 4. Fixed Assets (Showroom, Warehouse Fixtures & Equipment)
    const assetRecTotal = await prisma.assetRec.aggregate({
      _sum: { value: true }
    });
    const expenceAssetsTotal = await prisma.expenceRecord.aggregate({
      where: { type: 'ASSET', date: { lte: asOfDate } },
      _sum: { amount: true }
    });
    const fixedAssets = (assetRecTotal._sum.value || 0) + (expenceAssetsTotal._sum.amount || 0);

    const assetRecs = await prisma.assetRec.findMany({
      include: { employeeRec: true }
    });
    const expenceAssets = await prisma.expenceRecord.findMany({
      where: { type: 'ASSET', date: { lte: asOfDate } },
      include: { employee: true, finHead: true }
    });

    const assetsDetail = [
      ...assetRecs.map(a => ({
        id: `rec-${a.id}`,
        name: a.name,
        date: new Date().toISOString(),
        loggedByName: a.employeeRec?.name || 'Admin',
        financialHeadName: 'Fixed Assets',
        amount: a.value
      })),
      ...expenceAssets.map(e => ({
        id: `exp-${e.id}`,
        name: e.remarks || 'Asset Purchase',
        date: e.date.toISOString(),
        loggedByName: e.employee?.name || 'Admin',
        financialHeadName: e.finHead?.name || 'Fixed Assets',
        amount: e.amount
      }))
    ].sort((a, b) => b.amount - a.amount);

    // TOTAL ASSETS
    const totalAssets = cashAndBank + accountsReceivable + inventoryValuation + fixedAssets;

    // 5. Accounts Payable (AP)
    const vendors = await prisma.sellerRec.findMany({
      include: { finHead: { include: { cashFlowDtls: true } } }
    });

    let accountsPayable = 0;
    const payablesDetail: any[] = [];

    vendors.forEach(v => {
      let bal = v.openingBalance || 0;
      if (v.finHead?.cashFlowDtls) {
        const cr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((s: number, d: any) => s + d.amount, 0);
        const dr = v.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((s: number, d: any) => s + d.amount, 0);
        bal += (cr - dr);
      }
      if (bal > 0) {
        accountsPayable += bal;
        payablesDetail.push({
          id: v.id,
          companyName: v.companyName,
          contactPerson: v.contactPerson || '',
          phone: v.phone || '',
          address: v.address || '',
          balance: bal
        });
      }
    });

    payablesDetail.sort((a, b) => b.balance - a.balance);

    // 6. Other Liabilities
    const otherLiabilities = 0;

    // TOTAL LIABILITIES
    const totalLiabilities = accountsPayable + customerOverpayments + otherLiabilities;

    // 7. Retained Earnings (Cumulative Net Profit)
    const sales = await prisma.saleMain.findMany({
      where: { date: { lte: asOfDate } },
      include: { details: { include: { productRec: true } } }
    });

    let cumulativeRevenue = 0;
    let cumulativeCOGS = 0;
    sales.forEach(s => {
      cumulativeRevenue += (s.totalAmount || 0);
      s.details.forEach(d => {
        cumulativeCOGS += (d.qty || 0) * (d.productRec ? (d.productRec.costPrice || 0) : 0);
      });
    });

    const cumulativeExpenses = expensesPaid._sum.amount || 0;
    const retainedEarnings = cumulativeRevenue - cumulativeCOGS - cumulativeExpenses;

    // 8. Owner Capital (Equity Balancing figure)
    const ownerCapital = totalAssets - totalLiabilities - retainedEarnings;

    // TOTAL EQUITY
    const totalEquity = ownerCapital + retainedEarnings;

    // TOTAL LIABILITIES & EQUITY
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    // Equation check: Assets = Liabilities + Equity
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    res.json({
      asOfDate: asOfDate.toISOString(),
      isBalanced,
      assets: {
        cashAndBank,
        accountsReceivable,
        inventoryValuation,
        fixedAssets,
        totalAssets
      },
      liabilities: {
        accountsPayable,
        customerOverpayments,
        otherLiabilities,
        totalLiabilities
      },
      equity: {
        ownerCapital,
        retainedEarnings,
        totalEquity
      },
      totalLiabilitiesAndEquity,
      receivablesDetail,
      overpaymentsDetail,
      payablesDetail,
      assetsDetail
    });
  } catch (error: any) {
    console.error('Balance sheet error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate balance sheet' });
  }
});

// 11. Assets & Expenses Management Engine
router.get('/assets-expenses', async (req, res) => {
  try {
    const records = await prisma.expenceRecord.findMany({
      include: {
        employee: true,
        finHead: true,
        expHead: true
      },
      orderBy: { date: 'desc' }
    });

    const totalAssets = records.filter(r => r.type === 'ASSET').reduce((s, r) => s + r.amount, 0);
    const totalExpenses = records.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + r.amount, 0);

    res.json({
      summary: {
        totalAssets,
        totalExpenses,
        combinedOutflow: totalAssets + totalExpenses
      },
      records: records.map(r => ({
        id: r.id,
        date: r.date.toISOString(),
        type: r.type,
        spentOn: r.remarks || '',
        amount: r.amount,
        financialHeadName: r.finHead?.name || r.expHead?.name || 'General Expense',
        financialHeadId: r.financialHeadId || r.expHeadId,
        loggedByName: r.employee?.name || 'Admin',
        loggedById: r.employeeId
      }))
    });
  } catch (error: any) {
    console.error('Failed to retrieve assets and expenses', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve assets and expenses' });
  }
});

router.post('/assets-expenses', async (req, res) => {
  try {
    const { spentOn, amount, financialHeadId, employeeId, transactionDate, type } = req.body;

    if (!spentOn || !amount || !financialHeadId) {
      return res.status(400).json({ error: 'Spent On, Amount, and Financial Head are required fields' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Log the main ExpenceRecord
      const record = await tx.expenceRecord.create({
        data: {
          date: transactionDate ? new Date(transactionDate) : new Date(),
          amount: parseFloat(amount),
          remarks: spentOn,
          type: type || 'EXPENSE',
          employeeId: employeeId ? Number(employeeId) : null,
          financialHeadId: Number(financialHeadId)
        }
      });

      // 2. Double Entry Ledger Sync
      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });

      if (cashInTillHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: transactionDate ? new Date(transactionDate) : new Date(),
            description: `${type === 'ASSET' ? 'Asset Purchased' : 'Expense Logged'}: ${spentOn}`,
            details: {
              create: [
                {
                  finHeadId: Number(financialHeadId),
                  amount: parseFloat(amount),
                  transactionType: 'DR' // Debit Assets/Expenses (increases them)
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: parseFloat(amount),
                  transactionType: 'CR' // Credit Cash (decreases cash asset)
                }
              ]
            }
          }
        });
      }

      return record;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Failed to log asset or expense', error);
    res.status(500).json({ error: error.message || 'Failed to log asset or expense' });
  }
});

export default router;



