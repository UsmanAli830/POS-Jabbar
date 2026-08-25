import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runPosLedgerTest() {
  console.log('🧪 Starting Phase 23: POS Double-Entry Ledger & Sync Diagnostic Test...\n');

  try {
    // 1. Create a Test Customer
    const testCustName = `QA Ledger Test Customer ${Date.now()}`;
    const customer = await prisma.customerRec.create({
      data: {
        custName: testCustName,
        openingBalance: 0
      }
    });

    const custFinHead = await prisma.finHead.create({
      data: {
        name: `Customer: ${testCustName}`,
        customerRecId: customer.id
      }
    });

    console.log(`✅ Step 1: Created Test Customer (ID: ${customer.id}) with initial opening balance = 0`);

    // 2. Fetch or create a test product
    let product = await prisma.productRec.findFirst();
    if (!product) {
      const cat = await prisma.pCat.create({ data: { name: 'Ledger Test Cat' } });
      product = await prisma.productRec.create({
        data: {
          productCode: 'LTEST-01',
          productName: 'Ledger Test Product',
          pCatId: cat.id,
          retailPrice: 1000,
          currentStock: 500
        }
      });
    }

    // 3. Test Partial Payment Sale (Total = 34,312.50, Payment Received = 10,000.00)
    const invoiceTotal = 34312.50;
    const paymentReceived = 10000.00;

    const res = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refNumber: `QA-PARTIAL-${Date.now()}`,
        items: [{ productId: product.id, quantity: 1, unitPrice: invoiceTotal }],
        total: invoiceTotal,
        paymentReceived: paymentReceived,
        paymentMethod: 'Credit / Unpaid',
        customerId: customer.id
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sale API failed: ${errText}`);
    }

    const saleResult = await res.json();
    console.log(`✅ Step 2: Completed Sale via API (Total: Rs. ${invoiceTotal}, Payment: Rs. ${paymentReceived})`);

    // 4. Verify Double-Entry Records in CashFlowDTL
    const cashFlowEntries = await prisma.cashFlowMAIN.findMany({
      where: {
        description: { contains: saleResult.invoiceNumber || 'QA-PARTIAL' }
      },
      include: { details: true },
      orderBy: { id: 'asc' }
    });

    console.log(`\n📊 Analyzing CashFlow Ledger Entries generated for Invoice...`);
    let invoiceEntryFound = false;
    let paymentEntryFound = false;

    for (const main of cashFlowEntries) {
      for (const dtl of main.details) {
        if (dtl.finHeadId === custFinHead.id && dtl.transactionType === 'DR' && Math.abs(dtl.amount - invoiceTotal) < 0.01) {
          invoiceEntryFound = true;
          console.log(`  - Entry 1 (The Invoice): Debit Customer AR = Rs. ${dtl.amount} | Timestamp: ${dtl.createdAt?.toISOString()}`);
        }
        if (dtl.finHeadId === custFinHead.id && dtl.transactionType === 'CR' && Math.abs(dtl.amount - paymentReceived) < 0.01) {
          paymentEntryFound = true;
          console.log(`  - Entry 2 (The Payment): Credit Customer AR = Rs. ${dtl.amount} | Timestamp: ${dtl.createdAt?.toISOString()}`);
        }
      }
    }

    if (!invoiceEntryFound || !paymentEntryFound) {
      throw new Error('❌ DOUBLE-ENTRY FAILED: Did not find both Invoice (DR) and Payment (CR) ledger entries!');
    }

    // 5. Verify Customer Live Balance via /api/customers/:id/balance
    const balRes = await fetch(`http://localhost:3000/api/customers/${customer.id}/balance`);
    const balData = await balRes.json();
    const expectedBalance = invoiceTotal - paymentReceived; // 24,312.50

    if (Math.abs(balData.balance - expectedBalance) > 0.01) {
      throw new Error(`❌ BALANCE MISMATCH: Expected balance Rs. ${expectedBalance}, but got Rs. ${balData.balance}`);
    }
    console.log(`✅ Step 3: Verified Customer Live Balance API = Rs. ${balData.balance} (Expected: Rs. 24,312.50)`);

    // 6. Test Overpayment (Total = 10,000, Payment = 15,000)
    const overpayTotal = 10000;
    const overpayPayment = 15000;

    await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refNumber: `QA-OVERPAY-${Date.now()}`,
        items: [{ productId: product.id, quantity: 1, unitPrice: overpayTotal }],
        total: overpayTotal,
        paymentReceived: overpayPayment,
        paymentMethod: 'Credit / Unpaid',
        customerId: customer.id
      })
    });

    const balRes2 = await fetch(`http://localhost:3000/api/customers/${customer.id}/balance`);
    const balData2 = await balRes2.json();
    const newExpectedBalance = expectedBalance + (overpayTotal - overpayPayment); // 24312.5 + (-5000) = 19,312.50

    if (Math.abs(balData2.balance - newExpectedBalance) > 0.01) {
      throw new Error(`❌ OVERPAYMENT BALANCE MISMATCH: Expected Rs. ${newExpectedBalance}, got Rs. ${balData2.balance}`);
    }
    console.log(`✅ Step 4: Overpayment test passed! New Balance = Rs. ${balData2.balance} (Expected: Rs. 19,312.50)`);

    // Cleanup Test Data
    await prisma.customerRec.delete({ where: { id: customer.id } });
    console.log('\n======================================');
    console.log('🎉 Phase 23: POS Ledger Math & Sync PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPosLedgerTest();
