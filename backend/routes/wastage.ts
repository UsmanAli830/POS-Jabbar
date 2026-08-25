import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET all damaged stock
router.get('/', async (req, res) => {
  try {
    const stock = await prisma.damagedStock.findMany({
      include: {
        product: true,
        location: true,
        vendor: true
      },
      orderBy: { dateReported: 'desc' }
    });
    res.json(stock);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch damaged stock' });
  }
});

// POST quarantine stock
router.post('/quarantine', async (req, res) => {
  try {
    const { productId, locationId, vendorId, quantity, description } = req.body;

    if (!productId || !locationId || !quantity) {
      return res.status(400).json({ error: 'Product, location, and quantity are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct from Inventory (Create negative transaction)
      await tx.inventoryTransaction.create({
        data: {
          productId: parseInt(productId),
          locationId: parseInt(locationId),
          quantity: -parseFloat(quantity),
          transactionType: 'QUARANTINE_OUT',
          referenceNotes: 'WASTAGE'
        }
      });

      // 2. Create DamagedStock record
      const damagedRecord = await tx.damagedStock.create({
        data: {
          productId: parseInt(productId),
          locationId: parseInt(locationId),
          vendorId: vendorId ? parseInt(vendorId) : null,
          quantity: parseFloat(quantity),
          description,
          status: 'QUARANTINED'
        }
      });

      return damagedRecord;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to quarantine stock' });
  }
});

// PUT resolve quarantined stock
router.put('/resolve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scrapSaleAmount, quantity } = req.body; // 'RETURNED', 'WRITTEN_OFF', or 'SCRAP_SALE'

    if (status !== 'RETURNED' && status !== 'WRITTEN_OFF' && status !== 'SCRAP_SALE') {
      return res.status(400).json({ error: 'Invalid resolution status' });
    }

    const damagedStock = await prisma.damagedStock.findUnique({
      where: { id: parseInt(id) }
    });

    if (!damagedStock || damagedStock.status !== 'QUARANTINED') {
      return res.status(400).json({ error: 'Item not found or already resolved' });
    }

    const resolveQty = quantity ? parseFloat(quantity) : damagedStock.quantity;
    if (resolveQty <= 0 || resolveQty > damagedStock.quantity) {
      return res.status(400).json({ error: 'Invalid quantity to resolve' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedRecord;
      
      // 1. Update status or split record
      if (resolveQty < damagedStock.quantity) {
        await tx.damagedStock.update({
          where: { id: parseInt(id) },
          data: { quantity: damagedStock.quantity - resolveQty }
        });
        
        updatedRecord = await tx.damagedStock.create({
          data: {
            productId: damagedStock.productId,
            locationId: damagedStock.locationId,
            vendorId: damagedStock.vendorId,
            quantity: resolveQty,
            description: damagedStock.description,
            status: status
          }
        });
      } else {
        updatedRecord = await tx.damagedStock.update({
          where: { id: parseInt(id) },
          data: { status }
        });
      }

      // 2. Handle Ledger impact using resolveQty
      if (status === 'RETURNED') {
        if (!damagedStock.vendorId) {
          throw new Error('Cannot return to vendor without an associated Vendor ID');
        }
        
        const vendor = await tx.vendor.findUnique({ where: { id: damagedStock.vendorId } });
        if (!vendor) throw new Error('Vendor not found');

        // Product Cost
        const product = await tx.product.findUnique({ where: { id: damagedStock.productId } });
        const value = (product?.costPrice || 0) * resolveQty;

        // Debit Vendor Account (Reduces Liability)
        await tx.ledgerEntry.create({
          data: {
            accountHeadId: vendor.accountHeadId,
            description: `Return of damaged goods: ${resolveQty} units`,
            debit: value,
            credit: 0,
            referenceId: `DAMAGED-${updatedRecord.id}`
          }
        });

      } else if (status === 'WRITTEN_OFF') {
        // Find Inventory Loss Expense Account
        const lossAccount = await tx.accountHead.findFirst({
          where: { headName: 'Inventory Loss', headType: 'EXPENSE' }
        });

        if (!lossAccount) {
          throw new Error('Inventory Loss account head not found');
        }

        // Product Cost
        const product = await tx.product.findUnique({ where: { id: damagedStock.productId } });
        const value = (product?.costPrice || 0) * resolveQty;

        // Debit Expense Account
        await tx.ledgerEntry.create({
          data: {
            accountHeadId: lossAccount.id,
            description: `Written off damaged goods: ${resolveQty} units`,
            debit: value,
            credit: 0,
            referenceId: `DAMAGED-${updatedRecord.id}`
          }
        });
      } else if (status === 'SCRAP_SALE') {
        const amount = parseFloat(scrapSaleAmount) || 0;
        
        // 1. Create a Sale record for Scrap
        const sale = await tx.sale.create({
          data: {
            invoiceNumber: `SCRAP-${updatedRecord.id}-${Date.now()}`,
            billNumber: String(((await tx.sale.findFirst({ orderBy: { id: 'desc' } }))?.id || 0) + 1),
            subtotal: amount,
            taxAmount: 0,
            discountAmount: 0,
            total: amount,
            paymentMethod: 'Cash',
            locationId: damagedStock.locationId,
            amountPaid: amount,
            paymentStatus: 'PAID',
            saleItems: {
              create: {
                productId: damagedStock.productId,
                quantity: resolveQty,
                unitPrice: amount / resolveQty,
                totalPrice: amount
              }
            }
          }
        });

        // 2. Debit Cash
        const cashInTillHead = await tx.accountHead.findUnique({ where: { headName: 'Cash in Till' } });
        if (cashInTillHead) {
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: cashInTillHead.id,
              description: `Scrap Sale: ${resolveQty} units`,
              debit: amount,
              credit: 0,
              referenceId: sale.invoiceNumber
            }
          });
        }

        // 3. Credit Scrap Revenue (or Sales Revenue)
        const revenueHead = await tx.accountHead.findFirst({
          where: { headName: 'Sales Revenue' } // Or Scrap Revenue if you create one
        });
        if (revenueHead) {
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: revenueHead.id,
              description: `Scrap Sale: ${resolveQty} units`,
              debit: 0,
              credit: amount,
              referenceId: sale.invoiceNumber
            }
          });
        }
      }

      return updatedRecord;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to resolve damaged stock' });
  }
});

// PUT revert resolved stock
router.put('/revert/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const damagedStock = await prisma.damagedStock.findUnique({
      where: { id: parseInt(id) }
    });

    if (!damagedStock || damagedStock.status === 'QUARANTINED') {
      return res.status(400).json({ error: 'Item not found or not resolved' });
    }

    const previousStatus = damagedStock.status;
    const qty = damagedStock.quantity;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update status back to QUARANTINED
      const revertedRecord = await tx.damagedStock.update({
        where: { id: parseInt(id) },
        data: { status: 'QUARANTINED' }
      });

      // 2. Reverse Ledger impact
      if (previousStatus === 'RETURNED') {
        const vendor = await tx.vendor.findUnique({ where: { id: damagedStock.vendorId! } });
        const product = await tx.product.findUnique({ where: { id: damagedStock.productId } });
        const value = (product?.costPrice || 0) * qty;

        if (vendor) {
          // Reverse: Credit Vendor Account
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: vendor.accountHeadId,
              description: `REVERSAL: Return of damaged goods: ${qty} units`,
              debit: 0,
              credit: value,
              referenceId: `DAMAGED-${damagedStock.id}-REV`
            }
          });
        }
      } else if (previousStatus === 'WRITTEN_OFF') {
        const lossAccount = await tx.accountHead.findFirst({
          where: { headName: 'Inventory Loss', headType: 'EXPENSE' }
        });
        const product = await tx.product.findUnique({ where: { id: damagedStock.productId } });
        const value = (product?.costPrice || 0) * qty;

        if (lossAccount) {
          // Reverse: Credit Expense Account
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: lossAccount.id,
              description: `REVERSAL: Written off damaged goods: ${qty} units`,
              debit: 0,
              credit: value,
              referenceId: `DAMAGED-${damagedStock.id}-REV`
            }
          });
        }
      } else if (previousStatus === 'SCRAP_SALE') {
        // Find the sale. It should start with SCRAP-${id}- or SCRAP-
        const sale = await tx.sale.findFirst({
          where: { 
            invoiceNumber: { startsWith: 'SCRAP-' },
            saleItems: { some: { productId: damagedStock.productId, quantity: qty } }
          },
          orderBy: { date: 'desc' }
        });
        
        const amount = sale ? sale.total : 0;

        const cashInTillHead = await tx.accountHead.findUnique({ where: { headName: 'Cash in Till' } });
        const revenueHead = await tx.accountHead.findFirst({ where: { headName: 'Sales Revenue' } });

        if (cashInTillHead && amount > 0) {
          // Reverse: Credit Cash
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: cashInTillHead.id,
              description: `REVERSAL: Scrap Sale: ${qty} units`,
              debit: 0,
              credit: amount,
              referenceId: `SCRAP-${damagedStock.id}-REV`
            }
          });
        }

        if (revenueHead && amount > 0) {
          // Reverse: Debit Revenue
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: revenueHead.id,
              description: `REVERSAL: Scrap Sale: ${qty} units`,
              debit: amount,
              credit: 0,
              referenceId: `SCRAP-${damagedStock.id}-REV`
            }
          });
        }
        
        // Optional: cancel the sale if we found it
        if (sale) {
           await tx.sale.update({
             where: { id: sale.id },
             data: { paymentStatus: 'REFUNDED' }
           });
        }
      }

      return revertedRecord;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to revert damaged stock resolution' });
  }
});

export default router;
