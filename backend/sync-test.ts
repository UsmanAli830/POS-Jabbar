import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  console.log('--- STARTING AUDIT 2: SYNC TEST ---');

  // 1. Setup Test Data
  const loc = await prisma.location.findFirst();
  if (!loc) throw new Error('No location');

  // Find or create Vendor
  let vendor = await prisma.vendor.findFirst({ where: { companyName: 'SyncTest Vendor' } });
  if (!vendor) {
    const head = await prisma.accountHead.create({
      data: { headName: 'AP - SyncTest Vendor', headType: 'LIABILITY' }
    });
    vendor = await prisma.vendor.create({
      data: { companyName: 'SyncTest Vendor', accountHeadId: head.id }
    });
  }

  // Find or create Customer
  let customer = await prisma.customer.findFirst({ where: { name: 'SyncTest B2B' } });
  if (!customer) {
    const head = await prisma.accountHead.create({
      data: { headName: 'AR - SyncTest B2B', headType: 'ASSET' }
    });
    customer = await prisma.customer.create({
      data: { name: 'SyncTest B2B', phone: '123', accountHeadId: head.id }
    });
  }

  // Find or create Product
  let prod = await prisma.product.findFirst({ where: { productCode: 'SYNC-100' } });
  if (!prod) {
    prod = await prisma.product.create({
      data: { productCode: 'SYNC-100', barCode: 'SYNC-100', productName: 'Sync Item', salePrice: 100, costPrice: 50, stockQty: 0 }
    });
  } else {
    // Reset stock to 0 for test
    prod = await prisma.product.update({ where: { id: prod.id }, data: { stockQty: 0 } });
  }

  console.log(`Initial stock for ${prod.productName}: ${prod.stockQty}`);

  // 2. PROCUREMENT: Buy 100 units at $50 each = $5000 Liability
  console.log('1. Purchasing 100 units...');
  await prisma.$transaction(async (tx) => {
    await tx.inventoryTransaction.create({
      data: { productId: prod!.id, locationId: loc.id, quantity: 100, transactionType: 'PURCHASE_IN' }
    });
    await tx.product.update({ where: { id: prod!.id }, data: { stockQty: { increment: 100 } } });
    await tx.ledgerEntry.create({
      data: { accountHeadId: vendor!.accountHeadId, debit: 0, credit: 5000, description: 'Test Purchase' }
    });
  });

  prod = await prisma.product.findUnique({ where: { id: prod.id } });
  console.log(`Stock after purchase: ${prod?.stockQty} (Expected: 100)`);
  if (prod?.stockQty !== 100) throw new Error('Stock sync failed on purchase');

  const vLedger = await prisma.ledgerEntry.aggregate({
    where: { accountHeadId: vendor.accountHeadId }, _sum: { credit: true, debit: true }
  });
  console.log(`Vendor Liability: ${vLedger._sum.credit} (Expected: >= 5000)`);

  // 3. COMPLEX SALE: Sell 10 units at $100 = $1000. 10% discount = $100. Total = $900.
  // Freight expense $50.
  console.log('2. Selling 10 units on credit with discount and freight...');
  await prisma.$transaction(async (tx) => {
    // Deduct stock
    const updatedProd = await tx.product.update({ where: { id: prod!.id }, data: { stockQty: { decrement: 10 } } });
    if (updatedProd.stockQty < 0) throw new Error('Negative stock logic triggered!');

    await tx.inventoryTransaction.create({
      data: { productId: prod!.id, locationId: loc.id, quantity: 10, transactionType: 'OUT' }
    });

    const salesRevHead = await tx.accountHead.findFirst({ where: { headName: 'Sales Revenue' } });
    const discountHead = await tx.accountHead.findFirst({ where: { headName: 'Sales Discounts' } });
    
    // Credit Revenue: 900
    await tx.ledgerEntry.create({
      data: { accountHeadId: salesRevHead!.id, debit: 0, credit: 900, description: 'Test Sale' }
    });
    // Debit Discount: 100
    if (discountHead) {
      await tx.ledgerEntry.create({
        data: { accountHeadId: discountHead.id, debit: 100, credit: 0, description: 'Test Sale Discount' }
      });
    }
    // Debit Customer AR: 900
    await tx.ledgerEntry.create({
      data: { accountHeadId: customer!.accountHeadId, debit: 900, credit: 0, description: 'Test Sale' }
    });
  });

  prod = await prisma.product.findUnique({ where: { id: prod.id } });
  console.log(`Stock after sale: ${prod?.stockQty} (Expected: 90)`);
  if (prod?.stockQty !== 90) throw new Error('Stock sync failed on sale');

  const cLedger = await prisma.ledgerEntry.aggregate({
    where: { accountHeadId: customer.accountHeadId }, _sum: { credit: true, debit: true }
  });
  console.log(`Customer AR: ${cLedger._sum.debit} (Expected: >= 900)`);

  // 4. RETURN 1 Damaged unit
  console.log('3. Returning 1 damaged unit...');
  await prisma.$transaction(async (tx) => {
    await tx.damagedStock.create({
      data: { productId: prod!.id, locationId: loc.id, quantity: 1, description: 'Test Damaged', status: 'QUARANTINED' }
    });
    // NO stock increment because it is DAMAGED (quarantined)
  });

  prod = await prisma.product.findUnique({ where: { id: prod.id } });
  console.log(`Stock after damaged return: ${prod?.stockQty} (Expected: 90)`);
  if (prod?.stockQty !== 90) throw new Error('Stock sync failed on return');

  console.log('--- SYNC TEST SUCCESSFUL ---');
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
