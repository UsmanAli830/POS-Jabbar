import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();

// GET all active Financial Heads with Chart of Accounts Groups
router.get('/heads', async (req, res) => {
  try {
    // 1. Ensure Chart of Accounts Main Groups exist
    const defaultGroups = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
    for (const groupName of defaultGroups) {
      const exists = await prisma.finHeadMainGroup.findFirst({ where: { name: groupName } });
      if (!exists) {
        await prisma.finHeadMainGroup.create({ data: { name: groupName } });
      }
    }

    const groups = await prisma.finHeadMainGroup.findMany();
    const assetGroup = groups.find(g => g.name === 'Asset');
    const liabilityGroup = groups.find(g => g.name === 'Liability');
    const equityGroup = groups.find(g => g.name === 'Equity');
    const incomeGroup = groups.find(g => g.name === 'Income');
    const expenseGroup = groups.find(g => g.name === 'Expense');

    // 2. Ensure default heads exist with group mapping
    const defaultHeads = [
      { name: 'Cash in Till', groupId: assetGroup?.id },
      { name: 'Bank HBL', groupId: assetGroup?.id },
      { name: 'Accounts Receivable', groupId: assetGroup?.id },
      { name: 'Inventory', groupId: assetGroup?.id },
      { name: 'Fixed Assets', groupId: assetGroup?.id },
      { name: 'Accounts Payable', groupId: liabilityGroup?.id },
      { name: 'Loans / Payables', groupId: liabilityGroup?.id },
      { name: 'Tax Payable', groupId: liabilityGroup?.id },
      { name: 'Owner Capital', groupId: equityGroup?.id },
      { name: 'Retained Earnings', groupId: equityGroup?.id },
      { name: 'Sales Revenue', groupId: incomeGroup?.id },
      { name: 'Service Revenue', groupId: incomeGroup?.id },
      { name: 'Other Income', groupId: incomeGroup?.id },
      { name: 'Cost of Goods Sold (COGS)', groupId: expenseGroup?.id },
      { name: 'Salaries & Wages', groupId: expenseGroup?.id }
    ];

    for (const dh of defaultHeads) {
      const exists = await prisma.finHead.findFirst({ where: { name: dh.name } });
      if (!exists) {
        await prisma.finHead.create({
          data: { name: dh.name, finHeadMainGroupId: dh.groupId }
        });
      } else if (!exists.finHeadMainGroupId && dh.groupId) {
        await prisma.finHead.update({
          where: { id: exists.id },
          data: { finHeadMainGroupId: dh.groupId }
        });
      }
    }

    const heads = await prisma.finHead.findMany({
      include: {
        customerRec: true,
        sellerRec: true,
        finHeadMainGroup: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(heads);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch financial heads' });
  }
});

// POST create new Financial Head
router.post('/heads', async (req, res) => {
  try {
    const { name, mainGroupId, headType } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Financial Head Name is required.' });
    }

    const existing = await prisma.finHead.findFirst({
      where: { name: { equals: name.trim() } }
    });

    if (existing) {
      return res.status(400).json({ error: 'Financial Head with this name already exists.' });
    }

    let targetGroupId = mainGroupId ? Number(mainGroupId) : undefined;
    if (!targetGroupId && headType) {
      const grp = await prisma.finHeadMainGroup.findFirst({ where: { name: headType } });
      if (grp) targetGroupId = grp.id;
    }

    const newHead = await prisma.finHead.create({
      data: {
        name: name.trim(),
        finHeadMainGroupId: targetGroupId
      },
      include: {
        finHeadMainGroup: true
      }
    });

    res.status(201).json(newHead);
  } catch (error: any) {
    console.error('Failed to create financial head', error);
    res.status(500).json({ error: error.message || 'Failed to create financial head' });
  }
});

// GET the Master General Ledger
router.get('/ledger', async (req, res) => {
  try {
    const { finHeadId, customerId, vendorId, startDate, endDate } = req.query;

    const whereClause: any = {};
    
    // Filter by specific FinHead
    if (finHeadId) {
      whereClause.finHeadId = Number(finHeadId);
    }

    // Filter by Customer (Resolves to their FinHead)
    if (customerId) {
      const customer = await prisma.customerRec.findUnique({
        where: { id: Number(customerId) },
        include: { finHead: true }
      });
      if (customer?.finHead) {
        whereClause.finHeadId = customer.finHead.id;
      } else {
        return res.json([]); // No ledger history for this customer
      }
    }

    // Filter by Vendor (Resolves to their FinHead)
    if (vendorId) {
      const vendor = await prisma.sellerRec.findUnique({
        where: { id: Number(vendorId) },
        include: { finHead: true }
      });
      if (vendor?.finHead) {
        whereClause.finHeadId = vendor.finHead.id;
      } else {
        return res.json([]);
      }
    }

    // Filter by Date Range on the parent CashFlowMAIN
    let mainWhereClause: any = {};
    if (startDate || endDate) {
      mainWhereClause.date = {};
      if (startDate) mainWhereClause.date.gte = new Date(startDate as string);
      if (endDate) {
        const ed = new Date(endDate as string);
        ed.setHours(23, 59, 59, 999);
        mainWhereClause.date.lte = ed;
      }
    }

    const transactions = await prisma.cashFlowDTL.findMany({
      where: {
        ...whereClause,
        cashFlowMain: mainWhereClause
      },
      include: {
        finHead: true,
        cashFlowMain: true
      },
      orderBy: {
        cashFlowMain: { date: 'asc' }
      }
    });

    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch ledger transactions' });
  }
});

// GET summary of balances for all customers
router.get('/balances/customers', async (req, res) => {
  try {
    // A raw query might be faster, but let's use Prisma aggregation for safety
    const tenantFilter = getTenantFilter(req);
    const customers = await prisma.customerRec.findMany({
      where: tenantFilter,
      include: { finHead: true }
    });

    const balances = await Promise.all(customers.map(async (customer) => {
      if (!customer.finHead) return { ...customer, balance: 0 };
      
      const aggregate = await prisma.cashFlowDTL.groupBy({
        by: ['transactionType'],
        where: { finHeadId: customer.finHead.id },
        _sum: { amount: true }
      });

      let debit = 0;
      let credit = 0;
      aggregate.forEach(agg => {
        if (agg.transactionType === 'DR') debit = agg._sum.amount || 0;
        if (agg.transactionType === 'CR') credit = agg._sum.amount || 0;
      });

      // Customer Balance = Debit - Credit
      return {
        id: customer.id,
        custName: customer.custName,
        phone: customer.phone,
        balance: debit - credit
      };
    }));

    res.json(balances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET summary of balances for all vendors
router.get('/balances/vendors', async (req, res) => {
  try {
    const vendors = await prisma.sellerRec.findMany({
      include: { finHead: true }
    });

    const balances = await Promise.all(vendors.map(async (vendor) => {
      if (!vendor.finHead) return { ...vendor, balance: 0 };
      
      const aggregate = await prisma.cashFlowDTL.groupBy({
        by: ['transactionType'],
        where: { finHeadId: vendor.finHead.id },
        _sum: { amount: true }
      });

      let debit = 0;
      let credit = 0;
      aggregate.forEach(agg => {
        if (agg.transactionType === 'DR') debit = agg._sum.amount || 0;
        if (agg.transactionType === 'CR') credit = agg._sum.amount || 0;
      });

      // Vendor Balance = Credit - Debit
      return {
        id: vendor.id,
        companyName: vendor.companyName,
        balance: credit - debit
      };
    }));

    res.json(balances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
