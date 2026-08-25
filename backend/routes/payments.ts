import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST receive payment from customer (Recovery)
router.post('/receive', async (req, res) => {
  try {
    const { customerId, amount, remarks } = req.body;

    if (!customerId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid customer ID and amount are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customerRec.findUnique({ 
        where: { id: parseInt(customerId) },
        include: { finHead: true }
      });
      if (!customer) throw new Error('Customer not found');

      // 1. Create Recovery Record
      const recovery = await tx.recovery.create({
        data: {
          customerRecId: parseInt(customerId),
          amount: parseFloat(amount),
          remarks
        }
      });

      // 2. Double Entry Ledger (CashFlowMAIN)
      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      
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
            description: `Recovery Payment Received: ${remarks || ''}`,
            details: {
              create: [
                {
                  finHeadId: cashInTillHead.id,
                  amount: parseFloat(amount),
                  transactionType: 'DR' // Debit Cash (money in)
                },
                {
                  finHeadId: crFinHeadId,
                  amount: parseFloat(amount),
                  transactionType: 'CR' // Credit AR (reduce debt)
                }
              ]
            }
          }
        });
      }

      return recovery;
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

      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      
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
                  transactionType: 'DR' // Debit AP (reduce liability)
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: parseFloat(amount),
                  transactionType: 'CR' // Credit Cash (money out)
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
