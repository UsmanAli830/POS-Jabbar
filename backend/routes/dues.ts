import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to calculate Customer Live Balance
async function getCustomerLiveBalance(customerId: number) {
  const customer = await prisma.customerRec.findUnique({
    where: { id: customerId },
    include: { finHead: true }
  });

  if (!customer) return 0;
  const baseOpening = customer.openingBalance || 0;
  if (!customer.finHead) return baseOpening;

  const dtls = await prisma.cashFlowDTL.findMany({
    where: { finHeadId: customer.finHead.id }
  });

  const drSum = dtls.filter(d => d.transactionType === 'DR').reduce((acc, d) => acc + d.amount, 0);
  const crSum = dtls.filter(d => d.transactionType === 'CR').reduce((acc, d) => acc + d.amount, 0);

  return baseOpening + drSum - crSum;
}

// Helper to calculate Vendor Live Balance (Credit - Debit + Opening)
async function getVendorLiveBalance(vendorId: number) {
  const vendor = await prisma.sellerRec.findUnique({
    where: { id: vendorId },
    include: { finHead: true }
  });

  if (!vendor) return 0;
  const baseOpening = vendor.openingBalance || 0;
  if (!vendor.finHead) return baseOpening;

  const dtls = await prisma.cashFlowDTL.findMany({
    where: { finHeadId: vendor.finHead.id }
  });

  const drSum = dtls.filter(d => d.transactionType === 'DR').reduce((acc, d) => acc + d.amount, 0);
  const crSum = dtls.filter(d => d.transactionType === 'CR').reduce((acc, d) => acc + d.amount, 0);

  return baseOpening + crSum - drSum;
}

// ============================================================================
// CUSTOMER DUES ENDPOINTS
// ============================================================================

// GET /api/dues/customer/:id/history
router.get('/customer/:id/history', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const customer = await prisma.customerRec.findUnique({
      where: { id: customerId },
      include: { finHead: true }
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const liveBalance = await getCustomerLiveBalance(customerId);

    if (!customer.finHead) {
      return res.json({
        customer: { id: customer.id, name: customer.custName },
        liveBalance,
        history: []
      });
    }

    // Fetch payments received from customer (CR on customer FinHead)
    const dtls = await prisma.cashFlowDTL.findMany({
      where: {
        finHeadId: customer.finHead.id,
        transactionType: 'CR'
      },
      include: {
        cashFlowMain: true
      },
      orderBy: {
        id: 'desc'
      }
    });

    const history = dtls.map(d => ({
      id: d.id,
      date: d.cashFlowMain.date || (d as any).createdAt || new Date(),
      description: d.cashFlowMain.description || 'Payment Received',
      amount: d.amount,
      remarks: d.cashFlowMain.description
    }));

    res.json({
      customer: { id: customer.id, name: customer.custName },
      liveBalance,
      history
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer dues history' });
  }
});

// POST /api/dues/customer/payment
router.post('/customer/payment', async (req, res) => {
  try {
    const { customerId, amount, paymentMethod, finHeadId, remarks, paymentDate } = req.body;

    if (!customerId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Customer and valid payment amount are required.' });
    }

    const customer = await prisma.customerRec.findUnique({
      where: { id: Number(customerId) },
      include: { finHead: true }
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Find or create customer FinHead
    let custFinHead = customer.finHead;
    if (!custFinHead) {
      custFinHead = await prisma.finHead.create({
        data: {
          name: `Customer: ${customer.custName}`,
          customerRecId: customer.id
        }
      });
    }

    // Destination FinHead (Cash in Till / Bank)
    let destFinHeadId = finHeadId ? Number(finHeadId) : null;
    if (!destFinHeadId) {
      const cashHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } });
      destFinHeadId = cashHead?.id || custFinHead.id;
    }

    const paymentAmount = Number(amount);
    const note = remarks || `Payment Received from Customer (${paymentMethod || 'Cash'})`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create CashFlowMAIN record
      const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
      const main = await tx.cashFlowMAIN.create({
        data: {
          date: effectiveDate,
          description: note,
          companyId: getTenantCompanyId(req) || undefined,
          details: {
            create: [
              // Entry 1: Credit Customer AR (reduces debt)
              { finHeadId: custFinHead!.id, amount: paymentAmount, transactionType: 'CR' },
              // Entry 2: Debit Cash / Bank (increases cash balance)
              { finHeadId: destFinHeadId!, amount: paymentAmount, transactionType: 'DR' }
            ]
          }
        },
        include: { details: true }
      });

      return main;
    });

    const newLiveBalance = await getCustomerLiveBalance(customer.id);

    res.status(201).json({
      message: 'Payment received successfully',
      cashFlowMain: result,
      newLiveBalance
    });
  } catch (error: any) {
    console.error('Customer payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to process customer payment' });
  }
});

// ============================================================================
// VENDOR DUES ENDPOINTS
// ============================================================================

// GET /api/dues/vendor/:id/history
router.get('/vendor/:id/history', async (req, res) => {
  try {
    const vendorId = Number(req.params.id);
    const vendor = await prisma.sellerRec.findUnique({
      where: { id: vendorId },
      include: { finHead: true }
    });

    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const liveBalance = await getVendorLiveBalance(vendorId);

    if (!vendor.finHead) {
      return res.json({
        vendor: { id: vendor.id, companyName: vendor.companyName },
        liveBalance,
        history: []
      });
    }

    // Fetch payments made to vendor (DR on vendor FinHead)
    const dtls = await prisma.cashFlowDTL.findMany({
      where: {
        finHeadId: vendor.finHead.id,
        transactionType: 'DR'
      },
      include: {
        cashFlowMain: true
      },
      orderBy: {
        id: 'desc'
      }
    });

    const history = dtls.map(d => ({
      id: d.id,
      date: d.cashFlowMain.date || (d as any).createdAt || new Date(),
      description: d.cashFlowMain.description || 'Payment Made to Vendor',
      amount: d.amount,
      remarks: d.cashFlowMain.description
    }));

    res.json({
      vendor: { id: vendor.id, companyName: vendor.companyName },
      liveBalance,
      history
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to fetch vendor dues history' });
  }
});

// POST /api/dues/vendor/payment
router.post('/vendor/payment', async (req, res) => {
  try {
    const { vendorId, amount, paymentMethod, finHeadId, remarks, paymentDate } = req.body;

    if (!vendorId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Vendor and valid payment amount are required.' });
    }

    const vendor = await prisma.sellerRec.findUnique({
      where: { id: Number(vendorId) },
      include: { finHead: true }
    });

    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    let vendorFinHead = vendor.finHead;
    if (!vendorFinHead) {
      vendorFinHead = await prisma.finHead.create({
        data: {
          name: `Vendor: ${vendor.companyName}`,
          sellerRecId: vendor.id
        }
      });
    }

    let sourceFinHeadId = finHeadId ? Number(finHeadId) : null;
    if (!sourceFinHeadId) {
      const cashHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } });
      sourceFinHeadId = cashHead?.id || vendorFinHead.id;
    }

    const paymentAmount = Number(amount);
    const note = remarks || `Payment Made to Vendor (${paymentMethod || 'Cash'})`;

    const result = await prisma.$transaction(async (tx) => {
      const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
      const main = await tx.cashFlowMAIN.create({
        data: {
          date: effectiveDate,
          description: note,
          companyId: getTenantCompanyId(req) || undefined,
          details: {
            create: [
              // Entry 1: Debit Vendor AP (reduces payable liability)
              { finHeadId: vendorFinHead!.id, amount: paymentAmount, transactionType: 'DR' },
              // Entry 2: Credit Cash / Bank (reduces cash balance)
              { finHeadId: sourceFinHeadId!, amount: paymentAmount, transactionType: 'CR' }
            ]
          }
        },
        include: { details: true }
      });

      return main;
    });

    const newLiveBalance = await getVendorLiveBalance(vendor.id);

    res.status(201).json({
      message: 'Vendor payment processed successfully',
      cashFlowMain: result,
      newLiveBalance
    });
  } catch (error: any) {
    console.error('Vendor payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to process vendor payment' });
  }
});

export default router;
