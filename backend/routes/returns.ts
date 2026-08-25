import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST process a customer return
router.post('/', async (req, res) => {
  try {
    const { productId, quantity, condition, refundAmount, locationId } = req.body;

    if (!productId || !quantity || quantity <= 0 || !locationId) {
      return res.status(400).json({ error: 'Valid product, quantity, and location are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Return Record
      const customerReturn = await tx.customerReturn.create({
        data: {
          productId: parseInt(productId),
          quantity: parseFloat(quantity),
          condition,
          refundAmount: parseFloat(refundAmount || 0)
        }
      });

      // 2. Handle Inventory
      if (condition === 'GOOD') {
        // Return to standard active inventory
        await tx.inventoryTransaction.create({
          data: {
            productId: parseInt(productId),
            locationId: parseInt(locationId),
            quantity: parseFloat(quantity),
            transactionType: 'IN',
            referenceNotes: `Customer Return #${customerReturn.id}`
          }
        });

        // Atomic Stock Increment
        await tx.product.update({
          where: { id: parseInt(productId) },
          data: { stockQty: { increment: parseFloat(quantity) } }
        });
      } else if (condition === 'DAMAGED') {
        // Quarantine to DamagedStock, bypass active inventory
        await tx.damagedStock.create({
          data: {
          companyId: getTenantCompanyId(req) || undefined,
          productId: parseInt(productId),
            locationId: parseInt(locationId),
            quantity: parseFloat(quantity),
            description: `Damaged Customer Return #${customerReturn.id}`,
            status: 'QUARANTINED'
          }
        });
      }

      // 3. Handle Financials
      if (parseFloat(refundAmount) > 0) {
        const cashInTillHead = await tx.accountHead.findUnique({ where: { headName: 'Cash in Till' } });
        const returnsHead = await tx.accountHead.findUnique({ where: { headName: 'Sales Returns & Refunds' } });

        if (cashInTillHead && returnsHead) {
          // Debit Sales Returns (Expense / Contra-Revenue)
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: returnsHead.id,
              description: `Refund for Return #${customerReturn.id}`,
              debit: parseFloat(refundAmount),
              credit: 0,
              referenceId: `RETURN-${customerReturn.id}`
            }
          });

          // Credit Cash (Money leaving the till)
          await tx.ledgerEntry.create({
            data: {
              accountHeadId: cashInTillHead.id,
              description: `Refund for Return #${customerReturn.id}`,
              debit: 0,
              credit: parseFloat(refundAmount),
              referenceId: `RETURN-${customerReturn.id}`
            }
          });
        }
      }

      return customerReturn;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process return' });
  }
});

// POST /api/returns/sales (Phase 46 — Split Settlement)
router.post('/sales', async (req, res) => {
  try {
    const { saleMainId, customerRecId, returnDate, remarks, items, refundMode, cashReturned, additionalCashReceived } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No return items specified.' });
    }

    const effectiveDate = returnDate ? new Date(returnDate) : new Date();
    const parsedCustId = customerRecId ? Number(customerRecId) : null;
    
    const calculateItemNet = (i: any) => {
      const gross = Number(i.qty) * Number(i.price);
      const pct = Math.min(100, Math.max(0, Number(i.discPercent || 0)));
      const cash = Math.max(0, Number(i.cashDiscount || 0));
      const order = i.discountOrder;

      if (order === 'CASH_FIRST') {
        const subtotal = Math.max(0, gross - cash);
        return Math.max(0, subtotal - (subtotal * (pct / 100)));
      } else if (order === 'PERCENT_FIRST') {
        const subtotal = Math.max(0, gross - (gross * (pct / 100)));
        return Math.max(0, subtotal - cash);
      } else {
        if (pct > 0) return Math.max(0, gross - (gross * (pct / 100)));
        if (cash > 0) return Math.max(0, gross - cash);
        return gross;
      }
    };

    const totalRefundAmount = items.reduce((sum: number, i: any) => sum + calculateItemNet(i), 0);

    // Parse split settlement amounts
    const parsedCashReturned = Math.max(0, Math.min(totalRefundAmount, Number(cashReturned || 0)));
    const balanceAdjustment = totalRefundAmount - parsedCashReturned;
    const parsedAdditionalCash = Math.max(0, Number(additionalCashReceived || 0));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create ManualSaleRtnMain record
      const rtnMain = await tx.manualSaleRtnMain.create({
        data: {
          date: effectiveDate,
          customerRecId: parsedCustId,
          totalAmount: totalRefundAmount,
          details: {
            create: items.map((i: any) => ({
              productRecId: Number(i.productRecId),
              qty: Number(i.qty),
              price: Number(i.price)
            }))
          }
        },
        include: { details: true }
      });

      const returnRef = `RET-${rtnMain.id}`;

      // 2. Original Invoice Update (Fix 1)
      if (saleMainId) {
        const targetSaleId = Number(saleMainId);
        const originalSale = await tx.saleMain.findUnique({
          where: { id: targetSaleId },
          include: { details: true }
        });

        if (originalSale) {
          for (const item of items) {
            const returnedQty = Math.abs(Number(item.qty));
            const prodId = Number(item.productRecId);
            const matchingDtl = originalSale.details.find(d => d.productRecId === prodId);
            if (matchingDtl) {
              const newQty = Math.max(0, matchingDtl.qty - returnedQty);
              const newGross = newQty * matchingDtl.price;
              const lineRefund = calculateItemNet(item);
              const newNet = Math.max(0, matchingDtl.netAmount - lineRefund);

              await tx.saleInvDtl.update({
                where: { id: matchingDtl.id },
                data: {
                  qty: newQty,
                  grossAmount: newGross,
                  netAmount: newNet
                }
              });
            }
          }

          await tx.saleMain.update({
            where: { id: targetSaleId },
            data: {
              totalAmount: Math.max(0, originalSale.totalAmount - totalRefundAmount),
              returnAmount: (originalSale.returnAmount || 0) + totalRefundAmount
            }
          });
        }
      }

      // 3. Inventory Handling
      const defaultLoc = await tx.location.findFirst();
      const locId = defaultLoc?.id || 1;

      for (const item of items) {
        const qty = Math.abs(Number(item.qty));
        const prodId = Number(item.productRecId);

        if (item.isDamaged) {
          await tx.damagedStock.create({
            data: {
              productId: prodId,
              locationId: locId,
              quantity: qty,
              description: `Damaged Sales Return #${rtnMain.id} (${remarks || 'Customer return'})`,
              status: 'QUARANTINED',
              dateReported: effectiveDate
            }
          });
        } else {
          await tx.productRec.update({
            where: { id: prodId },
            data: { currentStock: { increment: qty } }
          });
        }
      }

      // 3. Financial Ledger Entries (Split Settlement)
      let salesReturnsHead = await tx.finHead.findFirst({ where: { name: 'Sales Returns & Refunds' } });
      if (!salesReturnsHead) {
        salesReturnsHead = await tx.finHead.findFirst({ where: { name: 'Sales Revenue' } });
      }
      const cashHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });

      // Resolve or create Customer FinHead
      let custFinHeadId: number | null = null;
      if (parsedCustId) {
        const customer = await tx.customerRec.findUnique({
          where: { id: parsedCustId },
          include: { finHead: true }
        });
        custFinHeadId = customer?.finHead?.id || null;
        if (!custFinHeadId && customer) {
          const newHead = await tx.finHead.create({
            data: { name: `Customer: ${customer.custName}`, customerRecId: customer.id }
          });
          custFinHeadId = newHead.id;
        }
      }

      // ENTRY A: Cash Refund Portion (if cash is physically returned)
      if (parsedCashReturned > 0 && cashHead && salesReturnsHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Sales Return ${returnRef}: Cash Refund Rs. ${parsedCashReturned.toLocaleString()} (INV-${saleMainId || rtnMain.id})`,
            details: {
              create: [
                {
                  finHeadId: cashHead.id,
                  amount: parsedCashReturned,
                  transactionType: 'CR' // Cash going OUT of till
                },
                {
                  finHeadId: salesReturnsHead.id,
                  amount: parsedCashReturned,
                  transactionType: 'DR' // Debit Sales Returns (Contra-Revenue)
                }
              ]
            }
          }
        });
      }

      // ENTRY B: Balance Adjustment Portion (credited to customer's account)
      if (balanceAdjustment > 0 && custFinHeadId && salesReturnsHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Sales Return ${returnRef}: Balance Adjustment Rs. ${balanceAdjustment.toLocaleString()} (INV-${saleMainId || rtnMain.id})`,
            details: {
              create: [
                {
                  finHeadId: custFinHeadId,
                  amount: balanceAdjustment,
                  transactionType: 'CR' // Credit Customer AR (Reduces Debt)
                },
                {
                  finHeadId: salesReturnsHead.id,
                  amount: balanceAdjustment,
                  transactionType: 'DR' // Debit Sales Returns (Contra-Revenue)
                }
              ]
            }
          }
        });
      }

      // ENTRY C: Additional Cash Received from Customer (extra payment on top of return)
      if (parsedAdditionalCash > 0 && custFinHeadId && cashHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Sales Return ${returnRef}: Additional Cash Received Rs. ${parsedAdditionalCash.toLocaleString()} from Customer`,
            details: {
              create: [
                {
                  finHeadId: cashHead.id,
                  amount: parsedAdditionalCash,
                  transactionType: 'DR' // Cash coming IN to till
                },
                {
                  finHeadId: custFinHeadId,
                  amount: parsedAdditionalCash,
                  transactionType: 'CR' // Credit Customer AR (Reduces Debt further)
                }
              ]
            }
          }
        });
      }

      // Fallback: If no customer and full refund is cash-only (walk-in scenario)
      if (!parsedCustId && parsedCashReturned === 0 && cashHead && salesReturnsHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Sales Return ${returnRef}: Walk-in Cash Refund Rs. ${totalRefundAmount.toLocaleString()}`,
            details: {
              create: [
                { finHeadId: cashHead.id, amount: totalRefundAmount, transactionType: 'CR' },
                { finHeadId: salesReturnsHead.id, amount: totalRefundAmount, transactionType: 'DR' }
              ]
            }
          }
        });
      }

      return {
        ...rtnMain,
        settlement: {
          totalRefund: totalRefundAmount,
          cashReturned: parsedCashReturned,
          balanceAdjustment,
          additionalCashReceived: parsedAdditionalCash
        }
      };
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Sales Return Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process sales return' });
  }
});
// POST /api/returns/purchases (Phase 46 — Split Settlement)
router.post('/purchases', async (req, res) => {
  try {
    const { sellerRecId, returnDate, remarks, items, cashReceivedFromVendor, additionalCashPaid } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No return items specified.' });
    }

    const effectiveDate = returnDate ? new Date(returnDate) : new Date();
    const parsedSellerId = sellerRecId ? Number(sellerRecId) : null;
    
    const totalRefundAmount = items.reduce((sum: number, i: any) => sum + (Number(i.qty) * Number(i.price)), 0);

    // Parse split settlement amounts
    const parsedCashReceived = Math.max(0, Math.min(totalRefundAmount, Number(cashReceivedFromVendor || 0)));
    const balanceAdjustment = totalRefundAmount - parsedCashReceived;
    const parsedAdditionalCashPaid = Math.max(0, Number(additionalCashPaid || 0));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create PurRtnMain record
      const rtnMain = await tx.purRtnMain.create({
        data: {
          companyId: getTenantCompanyId(req) || undefined,
          date: effectiveDate,
          sellerRecId: parsedSellerId,
          totalAmount: totalRefundAmount,
          details: {
            create: items.map((i: any) => ({
              productRecId: Number(i.productRecId),
              qty: Number(i.qty),
              price: Number(i.price)
            }))
          }
        },
        include: { details: true }
      });

      const returnRef = `PRTN-${rtnMain.id}`;

      // 2. Inventory Reduction
      for (const item of items) {
        const qty = Math.abs(Number(item.qty));
        const prodId = Number(item.productRecId);

        await tx.productRec.update({
          where: { id: prodId },
          data: { currentStock: { decrement: qty } }
        });
      }

      // 3. Financial Ledger Entries (Split Settlement)
      let invAssetHead = await tx.finHead.findFirst({ where: { name: 'Inventory Asset' } });
      const cashHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });

      // Resolve or create Vendor FinHead
      let venFinHeadId: number | null = null;
      if (parsedSellerId) {
        const vendor = await tx.sellerRec.findUnique({
          where: { id: parsedSellerId },
          include: { finHead: true }
        });
        venFinHeadId = vendor?.finHead?.id || null;
        if (!venFinHeadId && vendor) {
          const newHead = await tx.finHead.create({
            data: { name: `Vendor: ${vendor.companyName}`, sellerRecId: vendor.id }
          });
          venFinHeadId = newHead.id;
        }
      }

      // ENTRY A: Cash Received from Vendor
      if (parsedCashReceived > 0 && cashHead && invAssetHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Purchase Return ${returnRef}: Cash Received Rs. ${parsedCashReceived.toLocaleString()} from Vendor`,
            details: {
              create: [
                {
                  finHeadId: cashHead.id,
                  amount: parsedCashReceived,
                  transactionType: 'DR' // Cash coming IN to till
                },
                {
                  finHeadId: invAssetHead.id,
                  amount: parsedCashReceived,
                  transactionType: 'CR' // Credit Inventory Asset
                }
              ]
            }
          }
        });
      }

      // ENTRY B: Balance Adjustment (reduces what we owe the vendor)
      if (balanceAdjustment > 0 && venFinHeadId && invAssetHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Purchase Return ${returnRef}: Balance Adjustment Rs. ${balanceAdjustment.toLocaleString()} (Vendor AP Reduced)`,
            details: {
              create: [
                {
                  finHeadId: venFinHeadId,
                  amount: balanceAdjustment,
                  transactionType: 'DR' // Debit Vendor AP (Reduces Liability)
                },
                {
                  finHeadId: invAssetHead.id,
                  amount: balanceAdjustment,
                  transactionType: 'CR' // Credit Inventory Asset
                }
              ]
            }
          }
        });
      }

      // ENTRY C: Additional Cash Paid to Vendor (if we need to pay vendor extra, e.g., return fee)
      if (parsedAdditionalCashPaid > 0 && venFinHeadId && cashHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Purchase Return ${returnRef}: Additional Cash Paid Rs. ${parsedAdditionalCashPaid.toLocaleString()} to Vendor`,
            details: {
              create: [
                {
                  finHeadId: venFinHeadId,
                  amount: parsedAdditionalCashPaid,
                  transactionType: 'DR' // Debit Vendor AP
                },
                {
                  finHeadId: cashHead.id,
                  amount: parsedAdditionalCashPaid,
                  transactionType: 'CR' // Cash going OUT
                }
              ]
            }
          }
        });
      }

      // Fallback: No vendor selected, pure cash refund
      if (!parsedSellerId && parsedCashReceived === 0 && cashHead && invAssetHead) {
        await tx.cashFlowMAIN.create({
          data: {
            date: effectiveDate,
            description: `Purchase Return ${returnRef}: Cash Refund Rs. ${totalRefundAmount.toLocaleString()}`,
            details: {
              create: [
                { finHeadId: cashHead.id, amount: totalRefundAmount, transactionType: 'DR' },
                { finHeadId: invAssetHead.id, amount: totalRefundAmount, transactionType: 'CR' }
              ]
            }
          }
        });
      }

      return {
        ...rtnMain,
        settlement: {
          totalRefund: totalRefundAmount,
          cashReceived: parsedCashReceived,
          balanceAdjustment,
          additionalCashPaid: parsedAdditionalCashPaid
        }
      };
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Purchase Return Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process purchase return' });
  }
});

export default router;
