import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter } from '../middleware/auth';

const router = Router();

// GET /api/ledger/customer/:id?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/customer/:id', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const { startDate, endDate } = req.query;

    const customer = await prisma.customerRec.findUnique({
      where: { id: customerId },
      include: { finHead: true }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let start = startDate ? new Date(String(startDate)) : new Date('2000-01-01');
    start.setHours(0, 0, 0, 0);

    let end = endDate ? new Date(String(endDate)) : new Date('2099-12-31');
    end.setHours(23, 59, 59, 999);

    const baseOpeningBalance = customer.openingBalance || 0;

    if (!customer.finHead) {
      return res.json({
        customer: { id: customer.id, name: customer.custName },
        periodOpeningBalance: baseOpeningBalance,
        transactions: []
      });
    }

    // 1. Calculate Period Opening Balance (Base Opening Balance + Net sum of transactions BEFORE startDate)
    const priorDtls = await prisma.cashFlowDTL.findMany({
      where: {
        finHeadId: customer.finHead.id,
        cashFlowMain: {
          date: { lt: start }
        }
      }
    });

    const priorDebitSum = priorDtls.filter(d => d.transactionType === 'DR').reduce((sum, d) => sum + d.amount, 0);
    const priorCreditSum = priorDtls.filter(d => d.transactionType === 'CR').reduce((sum, d) => sum + d.amount, 0);
    const periodOpeningBalance = baseOpeningBalance + priorDebitSum - priorCreditSum;

    // 2. Fetch Transactions WITHIN date range
    const periodDtls = await prisma.cashFlowDTL.findMany({
      where: {
        finHeadId: customer.finHead.id,
        cashFlowMain: {
          date: { gte: start, lte: end }
        }
      },
      include: {
        cashFlowMain: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    const transactions = periodDtls.map(d => ({
      id: d.id,
      date: d.cashFlowMain.date,
      description: d.cashFlowMain.description || 'Transaction',
      debit: d.transactionType === 'DR' ? d.amount : 0,
      credit: d.transactionType === 'CR' ? d.amount : 0
    }));

    res.json({
      customer: { id: customer.id, name: customer.custName },
      periodOpeningBalance,
      transactions
    });
  } catch (error: any) {
    console.error('Ledger calculation error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer ledger' });
  }
});
// GET /api/ledger/vendor/:id?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/vendor/:id', async (req, res) => {
  try {
    const vendorId = Number(req.params.id);
    const { startDate, endDate } = req.query;

    const vendor = await prisma.sellerRec.findUnique({
      where: { id: vendorId },
      include: { finHead: true }
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    let start = startDate ? new Date(String(startDate)) : new Date('2000-01-01');
    start.setHours(0, 0, 0, 0);

    let end = endDate ? new Date(String(endDate)) : new Date('2099-12-31');
    end.setHours(23, 59, 59, 999);

    const baseOpeningBalance = vendor.openingBalance || 0;

    if (!vendor.finHead) {
      return res.json({
        vendor: { id: vendor.id, name: vendor.companyName },
        periodOpeningBalance: baseOpeningBalance,
        transactions: []
      });
    }

    const priorDtls = await prisma.cashFlowDTL.findMany({
      where: {
        finHeadId: vendor.finHead.id,
        cashFlowMain: {
          date: { lt: start }
        }
      }
    });

    const priorCreditSum = priorDtls.filter(d => d.transactionType === 'CR').reduce((sum, d) => sum + d.amount, 0);
    const priorDebitSum = priorDtls.filter(d => d.transactionType === 'DR').reduce((sum, d) => sum + d.amount, 0);
    const periodOpeningBalance = baseOpeningBalance + priorCreditSum - priorDebitSum; // For vendors, CR increases balance, DR decreases balance

    const periodDtls = await prisma.cashFlowDTL.findMany({
      where: {
        finHeadId: vendor.finHead.id,
        cashFlowMain: {
          date: { gte: start, lte: end }
        }
      },
      include: {
        cashFlowMain: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    const transactions = periodDtls.map(d => ({
      id: d.id,
      date: d.cashFlowMain.date,
      description: d.cashFlowMain.description || 'Transaction',
      remarks: d.cashFlowMain.description || 'Transaction', // Also return remarks for backward compatibility in the script
      debit: d.transactionType === 'DR' ? d.amount : 0,
      credit: d.transactionType === 'CR' ? d.amount : 0
    }));

    res.json({
      vendor: { id: vendor.id, name: vendor.companyName },
      periodOpeningBalance,
      transactions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch vendor ledger' });
  }
});

export default router;
