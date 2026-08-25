import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runPOSCorrectionsTest() {
  console.log('🧪 Starting Phase 29: POS UI Corrections Integration Test...\n');

  try {
    // 1. Create a Test Customer
    const custName = `QA POS Corrections Customer ${Date.now()}`;
    const customer = await prisma.customerRec.create({
      data: { custName, openingBalance: 0 }
    });

    let prod = await prisma.productRec.findFirst();
    if (!prod) {
      const cat = await prisma.pCat.create({ data: { name: 'Corrections Test Cat' } });
      prod = await prisma.productRec.create({
        data: {
          productCode: 'CORR-PROD-01',
          productName: 'Corrections Test Product',
          pCatId: cat.id,
          retailPrice: 1000,
          currentStock: 100
        }
      });
    }

    // 2. Submit Sale via API with Cash Discount
    const res = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            productId: prod.id,
            productCode: prod.productCode,
            productName: prod.productName,
            quantity: 5,
            unitPrice: 1000,
            totalPrice: 4500, // 5000 Gross - 500 Cash Discount = 4500 Net
            discountAmount: 500
          }
        ],
        customerId: customer.id,
        subtotal: 5000,
        discountAmount: 500,
        taxAmount: 0,
        total: 4500,
        paymentMethod: 'Cash',
        paymentReceived: 4500,
        refNumber: `CORR-INV-${Date.now().toString().slice(-6)}`
      })
    });

    if (!res.ok) {
      throw new Error(`POST /api/sales failed: ${await res.text()}`);
    }

    const saleResult = await res.json();
    console.log(`✅ Step 1: Processed Checkout with Cash Discount (Net Total: Rs. ${saleResult.total})`);

    // 3. Query Customer History for Bottom Tab
    const histRes = await fetch(`http://localhost:3000/api/sales/customer-history/${customer.id}`);
    if (!histRes.ok) {
      throw new Error(`Customer history query failed: ${await histRes.text()}`);
    }

    const history = await histRes.json();
    console.log(`✅ Step 2: Bottom Tab API returned ${history.length} historical record(s) for Customer ID ${customer.id}`);

    if (history.length === 0) {
      throw new Error('❌ CUSTOMER HISTORY EMPTY FOR BOTTOM TAB!');
    }

    console.log(`  - Record 1: Product = "${history[0].productName}" | Qty = ${history[0].quantity} | Rate = Rs. ${history[0].rate} | Total = Rs. ${history[0].totalPrice}`);

    // Cleanup
    await prisma.customerRec.delete({ where: { id: customer.id } });

    console.log('\n======================================');
    console.log('🎉 Phase 29: POS UI Corrections PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPOSCorrectionsTest();
