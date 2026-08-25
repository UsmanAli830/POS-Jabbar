const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING PHASE 16 QA ---');
  
  try {
    // 1. Create Raw Materials
    const rm1 = await prisma.product.create({
      data: {
        productCode: 'RM-001',
        barCode: 'RM001',
        productName: 'Raw Material 1',
        salePrice: 10,
        costPrice: 5
      }
    });
    
    const rm2 = await prisma.product.create({
      data: {
        productCode: 'RM-002',
        barCode: 'RM002',
        productName: 'Raw Material 2',
        salePrice: 20,
        costPrice: 8
      }
    });

    console.log('Raw Materials created.');

    // 2. Create Formula
    const formula = await prisma.formula.create({
      data: {
        name: 'Test Formula Kit',
        components: {
          create: [
            { rawMaterialProductId: rm1.id, quantityRequired: 2 }, // Needs 2 of RM1
            { rawMaterialProductId: rm2.id, quantityRequired: 1 }  // Needs 1 of RM2
          ]
        }
      }
    });

    console.log('Formula created.');

    // 3. Create Bundled Product
    const bundle = await prisma.product.create({
      data: {
        productCode: 'BUN-001',
        barCode: 'BUN001',
        productName: 'Test Bundle Product',
        salePrice: 50,
        costPrice: 18, // 2*5 + 1*8
        formulaId: formula.id
      }
    });

    console.log('Bundle Product created and linked to formula.');

    // 4. Create Booking Sheet
    const fetch = (await import('node-fetch')).default;
    const bookingRes = await fetch('http://localhost:3000/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: 'BKG-1001',
        subtotal: 50,
        taxAmount: 0,
        discountAmount: 0,
        total: 50,
        paymentMethod: 'Cash',
        locationId: 1,
        items: [
          {
            productId: bundle.id,
            quantity: 3, // Selling 3 bundles
            unitPrice: 50,
            totalPrice: 150,
            isBonus: false,
            isReplacement: false
          }
        ]
      })
    });

    const booking = await bookingRes.json();
    if (!bookingRes.ok) throw new Error(JSON.stringify(booking));

    console.log('Booking Sheet created (Status: OPEN).');

    // 5. Verify Reserved Inventory
    const invTxs = await prisma.inventoryTransaction.findMany({
      where: { bookingSheetId: booking.id }
    });

    // Should have 2 transactions: RM1 (qty 6) and RM2 (qty 3)
    if (invTxs.length !== 2) throw new Error('Expected 2 inventory transactions for bundle reservation.');
    console.log('RESERVED inventory verified. Correct number of components deducted.');

    // 6. Fulfill Booking
    const fulfillRes = await fetch(`http://localhost:3000/api/bookings/${booking.id}/fulfill`, {
      method: 'POST'
    });
    
    const fulfilled = await fulfillRes.json();
    if (!fulfillRes.ok) throw new Error(JSON.stringify(fulfilled));

    console.log('Booking Sheet fulfilled and converted to Sale.');

    // 7. Verify Ledgers and Inventory Status
    const sale = await prisma.sale.findFirst({ where: { invoiceNumber: 'INV-BKG-1001' } });
    if (!sale) throw new Error('Sale record not generated from booking.');
    console.log('Sale record successfully generated.');

    const updatedInvTxs = await prisma.inventoryTransaction.findMany({
      where: { bookingSheetId: booking.id }
    });
    const allOut = updatedInvTxs.every(tx => tx.transactionType === 'OUT');
    if (!allOut) throw new Error('Inventory transactions not updated to OUT.');
    console.log('Inventory successfully converted from RESERVED to OUT.');

    console.log('--- ALL TESTS PASSED ---');

  } catch (e) {
    console.error('TEST FAILED:', e);
  } finally {
    // Cleanup
    await prisma.inventoryTransaction.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.bookingItem.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
    await prisma.bookingSheet.deleteMany({});
    await prisma.product.deleteMany({ where: { productCode: { in: ['RM-001', 'RM-002', 'BUN-001'] } } });
    await prisma.formulaComponent.deleteMany({});
    await prisma.formula.deleteMany({ where: { name: 'Test Formula Kit' } });
    await prisma.$disconnect();
  }
}

runTests();
