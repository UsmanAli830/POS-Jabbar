import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET all booking sheets
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const bookings = await prisma.bookingSheet.findMany({
      where: tenantFilter,
      include: {
        bookingItems: {
          include: {
            product: true
          }
        },
        customer: true,
        salesman: true,
        booker: true,
        location: true
      },
      orderBy: { date: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking sheets', details: error });
  }
});

// CREATE Booking Sheet (RESERVE INVENTORY ONLY)
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      invoiceNumber,
      subtotal,
      taxAmount,
      discountAmount,
      total,
      paymentMethod,
      locationId,
      customerId,
      bookerId,
      dueDate,
      items
    } = req.body;

    const salesmanId = req.user?.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create BookingSheet and BookingItems
      const booking = await tx.bookingSheet.create({
        data: {
          invoiceNumber,
          subtotal: Number(subtotal),
          taxAmount: Number(taxAmount),
          discountAmount: Number(discountAmount),
          total: Number(total),
          paymentMethod,
          locationId: Number(locationId),
          customerId: customerId ? Number(customerId) : null,
          salesmanId: salesmanId ? Number(salesmanId) : null,
          bookerId: bookerId ? Number(bookerId) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'OPEN',
          bookingItems: {
            create: items.map((item: any) => ({
              productId: Number(item.productId),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice),
              isBonus: Boolean(item.isBonus),
              isReplacement: Boolean(item.isReplacement),
              linkedToItemId: item.linkedToItemId ? Number(item.linkedToItemId) : null
            }))
          }
        }
      });

      // 2. Reserve inventory dynamically handling Formulas vs Standard
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: Number(item.productId) } });
        
        if (prod && prod.formulaId) {
          // It's a bundle. Reserve raw materials.
          const comps = await tx.formulaComponent.findMany({ where: { formulaId: prod.formulaId } });
          for (const comp of comps) {
            await tx.inventoryTransaction.create({
              data: {
                productId: comp.rawMaterialProductId,
                locationId: Number(locationId),
                quantity: Math.abs(Number(item.quantity) * comp.quantityRequired),
                transactionType: 'RESERVED',
                referenceNotes: `Booking Reservation for Bundle: ${invoiceNumber}`,
                bookingSheetId: booking.id
              }
            });
          }
        } else {
          // Standard product. Reserve directly.
          await tx.inventoryTransaction.create({
            data: {
              productId: Number(item.productId),
              locationId: Number(locationId),
              quantity: Math.abs(Number(item.quantity)),
              transactionType: 'RESERVED',
              referenceNotes: `Booking Reservation: ${invoiceNumber}`,
              bookingSheetId: booking.id
            }
          });
        }
      }

      return booking;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Failed to create booking', details: error });
  }
});

// FULFILL Booking Sheet (Convert RESERVED to OUT, hit ledgers)
router.post('/:id/fulfill', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const booking = await prisma.bookingSheet.findUnique({
      where: { id },
      include: { bookingItems: true, inventoryTx: true, customer: true }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'OPEN') return res.status(400).json({ error: 'Booking is already fulfilled or cancelled' });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark Booking as FULFILLED
      await tx.bookingSheet.update({
        where: { id },
        data: { status: 'FULFILLED' }
      });

      // 2. Convert RESERVED inventory transactions to OUT
      for (const invTx of booking.inventoryTx) {
        await tx.inventoryTransaction.update({
          where: { id: invTx.id },
          data: {
            transactionType: 'OUT',
            referenceNotes: `Fulfilled Booking: ${booking.invoiceNumber}`
          }
        });
      }

      // 3. Create the actual Sale record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber: `INV-${booking.invoiceNumber}`, // Generate an invoice number from booking
          billNumber: String(((await tx.sale.findFirst({ orderBy: { id: 'desc' } }))?.id || 0) + 1),
          date: new Date(),
          subtotal: booking.subtotal,
          taxAmount: booking.taxAmount,
          discountAmount: booking.discountAmount,
          total: booking.total,
          paymentMethod: booking.paymentMethod,
          amountPaid: booking.amountPaid,
          paymentStatus: booking.paymentStatus,
          dueDate: booking.dueDate,
          locationId: booking.locationId,
          customerId: booking.customerId,
          salesmanId: booking.salesmanId,
          bookerId: booking.bookerId,
          saleItems: {
            create: booking.bookingItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              isBonus: item.isBonus,
              isReplacement: item.isReplacement,
              linkedToItemId: item.linkedToItemId
            }))
          }
        }
      });

      // 4. Financial Ledgers (Cash, AR, Revenue, COGS, InventoryAsset)
      const location = await tx.location.findUnique({ where: { id: booking.locationId } });
      
      const salesRevHead = await tx.accountHead.upsert({
        where: { headName: 'Sales Revenue' },
        update: {},
        create: { headName: 'Sales Revenue', headType: 'REVENUE' }
      });

      const invAssetHead = await tx.accountHead.upsert({
        where: { headName: 'Inventory Asset' },
        update: {},
        create: { headName: 'Inventory Asset', headType: 'ASSET' }
      });

      const cogsHead = await tx.accountHead.upsert({
        where: { headName: 'Cost of Goods Sold' },
        update: {},
        create: { headName: 'Cost of Goods Sold', headType: 'EXPENSE' }
      });

      // Determine Debit Account (Cash or Customer AR)
      let debitAccountHeadId = 0;
      if (booking.paymentMethod === 'Cash' || booking.paymentMethod === 'Card') {
        const cashHead = await tx.accountHead.upsert({
          where: { headName: `Cash - ${location?.name || 'Default'}` },
          update: {},
          create: { headName: `Cash - ${location?.name || 'Default'}`, headType: 'ASSET' }
        });
        debitAccountHeadId = cashHead.id;
      } else {
        if (!booking.customer || !booking.customer.accountHeadId) {
          throw new Error('Credit sale requires a customer with a linked AccountHead');
        }
        debitAccountHeadId = booking.customer.accountHeadId;
      }

      // Debit Cash/AR
      await tx.ledgerEntry.create({
        data: {
          accountHeadId: debitAccountHeadId,
          description: `Sale Invoice from Booking: ${sale.invoiceNumber}`,
          debit: booking.total,
          credit: 0,
          referenceId: sale.invoiceNumber
        }
      });

      // Credit Revenue
      await tx.ledgerEntry.create({
        data: {
          accountHeadId: salesRevHead.id,
          description: `Sale Revenue: ${sale.invoiceNumber}`,
          debit: 0,
          credit: booking.total,
          referenceId: sale.invoiceNumber
        }
      });

      // Calculate exact COGS dynamically based on what was deducted
      let totalCost = 0;
      for (const inv of booking.inventoryTx) {
        const prod = await tx.product.findUnique({ where: { id: inv.productId } });
        if (prod) {
          totalCost += (prod.costPrice || 0) * inv.quantity;
        }
      }

      if (totalCost > 0) {
        // Debit COGS
        await tx.ledgerEntry.create({
          data: {
            accountHeadId: cogsHead.id,
            description: `COGS for ${sale.invoiceNumber}`,
            debit: totalCost,
            credit: 0,
            referenceId: sale.invoiceNumber
          }
        });

        // Credit Inventory Asset
        await tx.ledgerEntry.create({
          data: {
            accountHeadId: invAssetHead.id,
            description: `Inventory reduction for ${sale.invoiceNumber}`,
            debit: 0,
            credit: totalCost,
            referenceId: sale.invoiceNumber
          }
        });
      }

      return sale;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Fulfillment error:', error);
    res.status(500).json({ error: 'Failed to fulfill booking', details: error });
  }
});

// CANCEL Booking Sheet
router.post('/:id/cancel', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const booking = await prisma.bookingSheet.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'OPEN') return res.status(400).json({ error: 'Cannot cancel fulfilled or already cancelled booking' });

    await prisma.$transaction(async (tx) => {
      // 1. Mark as CANCELLED
      await tx.bookingSheet.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
      // 2. Delete RESERVED inventory transactions to release stock
      await tx.inventoryTransaction.deleteMany({
        where: { bookingSheetId: id }
      });
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking', details: error });
  }
});

export default router;
