import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter } from '../middleware/auth';

const router = Router();

// GET /api/payments/pending - Fetch all sales with outstanding balances
router.get('/pending', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const sales = await prisma.saleMain.findMany({
      where: {
        ...(tenantFilter.companyId ? { companyId: tenantFilter.companyId } : {}),
        totalAmount: { gt: 0 }
      },
      include: {
        customerRec: true
      },
      orderBy: { date: 'desc' }
    });

    const pendingSales = sales
      .filter(s => (s.paymentReceived || 0) < (s.totalAmount || 0))
      .map(s => {
        const total = s.totalAmount || 0;
        const paid = s.paymentReceived || 0;
        return {
          id: s.id,
          invoiceNumber: s.invoiceNumber ? `INV-${s.invoiceNumber}` : `INV-${s.id}`,
          date: s.date,
          customer: s.customerRec ? { id: s.customerRec.id, name: s.customerRec.custName } : { name: 'Walk-In Customer' },
          total,
          amountPaid: paid,
          paymentStatus: paid > 0 ? 'PARTIAL' : 'UNPAID'
        };
      });

    res.json(pendingSales);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch pending payments' });
  }
});

// POST receive payment from customer (Recovery / Invoice Settlement)
router.post('/receive', async (req, res) => {
  try {
    const { saleId, customerId, amount, paymentMethod, remarks } = req.body;

    if ((!saleId && !customerId) || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid saleId/customerId and positive amount are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetCustId = customerId;

      if (saleId) {
        const sale = await tx.saleMain.findUnique({ where: { id: Number(saleId) } });
        if (sale) {
          const newPaid = (sale.paymentReceived || 0) + Number(amount);
          await tx.saleMain.update({
            where: { id: sale.id },
            data: { paymentReceived: newPaid }
          });
          targetCustId = targetCustId || sale.customerRecId;
        }
      }

      if (targetCustId) {
        const customer = await tx.customerRec.findUnique({
          where: { id: Number(targetCustId) },
          include: { finHead: true }
        });

        if (customer) {
          // 1. Create Recovery Record
          await tx.recovery.create({
            data: {
              customerRecId: Number(targetCustId),
              amount: parseFloat(amount),
              remarks: remarks || `Invoice Recovery (${paymentMethod || 'Cash'})`
            }
          });

          // 2. Double Entry Ledger (CashFlowMAIN)
          const cashInTillHead = await tx.finHead.findFirst({ where: { name: { contains: 'Cash' } } });
          let crFinHeadId = customer.finHead?.id;
          if (!crFinHeadId) {
            const newFinHead = await tx.finHead.create({
              data: {
                name: `Customer: ${customer.custName}`,
                customerRecId: customer.id
              }
            });
            crFinHeadId = newFinHead.id;
          }

          if (cashInTillHead && crFinHeadId) {
            await tx.cashFlowMAIN.create({
              data: {
                description: `Pending Payment Received (${paymentMethod || 'Cash'}): ${remarks || ''}`,
                details: {
                  create: [
                    {
                      finHeadId: cashInTillHead.id,
                      amount: parseFloat(amount),
                      transactionType: 'DR'
                    },
                    {
                      finHeadId: crFinHeadId,
                      amount: parseFloat(amount),
                      transactionType: 'CR'
                    }
                  ]
                }
              }
            });
          }
        }
      }

      return { success: true };
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process payment' });
  }
});

// POST pay vendor bill
router.post('/pay', async (req, res) => {
  try {
    const { vendorId, amount, remarks } = req.body;

    if (!vendorId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid vendor ID and amount are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const vendor = await tx.sellerRec.findUnique({ 
        where: { id: parseInt(vendorId) },
        include: { finHead: true }
      });
      if (!vendor) throw new Error('Vendor not found');

      const cashInTillHead = await tx.finHead.findFirst({ where: { name: { contains: 'Cash' } } });
      
      let drFinHeadId = vendor.finHead?.id;
      if (!drFinHeadId) {
        const newFinHead = await tx.finHead.create({
          data: {
            name: `Vendor: ${vendor.companyName}`,
            sellerRecId: vendor.id
          }
        });
        drFinHeadId = newFinHead.id;
      }

      if (cashInTillHead && drFinHeadId) {
        await tx.cashFlowMAIN.create({
          data: {
            description: `Vendor Payment Paid: ${remarks || ''}`,
            details: {
              create: [
                {
                  finHeadId: drFinHeadId,
                  amount: parseFloat(amount),
                  transactionType: 'DR'
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: parseFloat(amount),
                  transactionType: 'CR'
                }
              ]
            }
          }
        });
      }

      return { success: true };
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process vendor payment' });
  }
});

export default router;
