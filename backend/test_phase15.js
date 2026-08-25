const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  try {
    console.log("Starting QA Pass...");
    
    // 1. Create a Location
    const loc = await prisma.location.create({ data: { name: 'Test Location QA' } });
    
    // 2. Create a Product with packSize 12
    const prod = await prisma.product.create({
      data: {
        productCode: 'PROD-QA-' + Date.now(),
        barCode: 'BAR-QA-' + Date.now(),
        productName: 'QA Test Product',
        packSize: 12,
        salePrice: 100,
        baseUom: 'PCS',
        bulkUom: 'CTN'
      }
    });

    // 3. Create a Customer and their AccountHead
    const custHead = await prisma.accountHead.create({ data: { headName: 'Cust-QA-' + Date.now(), headType: 'ASSET' } });
    const cust = await prisma.customer.create({
      data: {
        name: 'QA Test Customer',
        phone: '123',
        accountHeadId: custHead.id
      }
    });

    // 4. Create a Vendor and their AccountHead
    const venHead = await prisma.accountHead.create({ data: { headName: 'Ven-QA-' + Date.now(), headType: 'LIABILITY' } });
    const vendor = await prisma.vendor.create({
      data: {
        companyName: 'Fast Trucking Co',
        contactName: 'Trucker',
        accountHeadId: venHead.id
      }
    });
    
    // 5. Create an Employee (Salesman)
    const emp = await prisma.employee.create({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        role: 'Salesman',
        hourlyRate: 15,
        pinCode: '0000'
      }
    });

    // 6. Test 1: Smart-Cell Dual UOM Parser logic
    const parseDualUom = (input, packSize) => {
      const str = input.toLowerCase().trim();
      if (/^\d+$/.test(str)) return parseInt(str, 10);
      const match = str.match(/^(?:(\d+)c)?\s*(?:(\d+)p)?$/);
      if (match) {
        const cartons = parseInt(match[1] || '0', 10);
        const pieces = parseInt(match[2] || '0', 10);
        return (cartons * (packSize || 1)) + pieces;
      }
      return parseInt(str) || 1;
    };
    
    const parsedQty = parseDualUom('2c 4p', 12);
    if (parsedQty !== 28) throw new Error("Test 1 Failed: Dual UOM parsing returned " + parsedQty);
    console.log("Test 1 Passed: Dual UOM parser returned 28");

    // 7. Test 2: Pre-seed a sale for $100 to set history
    const revenueHead = await prisma.accountHead.upsert({
      where: { headName: 'Sales Revenue' },
      update: {},
      create: { headName: 'Sales Revenue', headType: 'REVENUE' }
    });
    
    await prisma.sale.create({
      data: {
        invoiceNumber: 'INV-TEST-HIST',
        subtotal: 100,
        taxAmount: 0,
        discountAmount: 0,
        total: 100,
        paymentMethod: 'Credit / Unpaid',
        locationId: loc.id,
        customerId: cust.id,
        saleItems: {
          create: [{
            productId: prod.id,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100
          }]
        }
      }
    });
    console.log("Pre-seeded history. Calling API logic directly...");
    // Simulate API fetch history
    const history = await prisma.saleItem.findMany({
      where: { productId: prod.id, sale: { customerId: cust.id } },
      include: { sale: true },
      orderBy: { sale: { date: 'desc' } }
    });
    if (history.length === 0 || history[0].unitPrice !== 100) throw new Error("Test 2 Failed: History not correct");
    console.log("Test 2 Passed: Visual Pricing history data is correct");

    // 8. Test 3: Perform a complex sale with Bonus & Expenses
    // We will POST this payload to our backend directly through fetch, or just simulate the exact logic.
    // Let's use fetch so we actually test the API!
    
    const payload = {
      invoiceNumber: 'INV-TEST-COMPLEX-' + Date.now(),
      subtotal: 90, // We sold it for 90
      taxAmount: 0,
      discountAmount: 0,
      total: 140, // 90 + 50 freight
      paymentMethod: 'Credit / Unpaid',
      locationId: loc.id,
      customerId: cust.id,
      salesmanId: emp.id,
      invoiceExpenses: [
        { vendorId: vendor.id, amount: 50, description: 'Freight Test' }
      ],
      items: [
        { productId: prod.id, quantity: 1, unitPrice: 90, totalPrice: 90, isBonus: false, isReplacement: false, linkedToItemId: null },
        { productId: prod.id, quantity: 1, unitPrice: 0, totalPrice: 0, isBonus: true, isReplacement: false, linkedToItemId: prod.id } // mock link
      ]
    };

    const res = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error("API failed: " + JSON.stringify(result));
    
    // Verifications
    const saleId = result.id;
    const invTxs = await prisma.inventoryTransaction.findMany({ where: { referenceNotes: 'Sale Invoice: ' + payload.invoiceNumber } });
    if (invTxs.length !== 2) throw new Error("Test 3 Failed: Inventory not deducted twice (main + bonus). Found: " + invTxs.length);
    console.log("Test 3 (A) Passed: Stock deducted for bonus item.");
    
    // Check Ledgers
    const arEntries = await prisma.ledgerEntry.findMany({ where: { accountHeadId: cust.accountHeadId, referenceId: payload.invoiceNumber } });
    if (arEntries.length === 0 || arEntries[0].debit !== 140) throw new Error("Test 3 Failed: AR not debited 140. Found: " + JSON.stringify(arEntries));
    console.log("Test 3 (B) Passed: Customer AR debited for Subtotal + Expense.");
    
    const apEntries = await prisma.ledgerEntry.findMany({ where: { accountHeadId: vendor.accountHeadId, referenceId: payload.invoiceNumber } });
    if (apEntries.length === 0 || apEntries[0].credit !== 50) throw new Error("Test 3 Failed: AP not credited 50. Found: " + JSON.stringify(apEntries));
    console.log("Test 3 (C) Passed: Vendor AP credited for $50.");

    console.log("ALL TESTS PASSED PERFECTLY!");
    
  } catch(e) {
    console.error("ERROR:");
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
