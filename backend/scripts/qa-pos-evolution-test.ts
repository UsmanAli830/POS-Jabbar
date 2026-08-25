import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runPOSEvolutionTest() {
  console.log('🧪 Starting Phase 28: POS Evolution Integration Test...\n');

  try {
    // 1. Verify GET /api/finance/heads Chart of Accounts Seeding & Inclusion
    const headsRes = await fetch('http://localhost:3000/api/finance/heads');
    if (!headsRes.ok) {
      throw new Error(`Failed to fetch /api/finance/heads: ${await headsRes.text()}`);
    }

    const heads = await headsRes.json();
    console.log(`✅ Step 1: Fetched ${heads.length} Financial Heads from /api/finance/heads`);

    const headsWithGroup = heads.filter((h: any) => h.finHeadMainGroup && h.finHeadMainGroup.name);
    console.log(`  - ${headsWithGroup.length} Financial Heads successfully mapped to Chart of Accounts Main Groups`);

    if (headsWithGroup.length === 0) {
      throw new Error('❌ CHART OF ACCOUNTS MAPPING ERROR: No financial heads have finHeadMainGroup populated!');
    }

    // 2. Test Customer Past Purchase History API GET /api/sales/customer-history/:customerId
    const custName = `QA POS Evolution Customer ${Date.now()}`;
    const customer = await prisma.customerRec.create({
      data: { custName, openingBalance: 0 }
    });

    let prod = await prisma.productRec.findFirst();
    if (!prod) {
      const cat = await prisma.pCat.create({ data: { name: 'Evolution Test Cat' } });
      prod = await prisma.productRec.create({
        data: {
          productCode: 'EVO-PROD-01',
          productName: 'Evolution Test Product',
          pCatId: cat.id,
          retailPrice: 2500,
          currentStock: 100
        }
      });
    }

    // Submit a Sale
    const saleMain = await prisma.saleMain.create({
      data: {
        customerRecId: customer.id,
        totalAmount: 5000,
        details: {
          create: [
            {
              productRecId: prod.id,
              qty: 2,
              price: 2500
            }
          ]
        }
      }
    });

    console.log(`✅ Step 2: Created Test Customer (ID: ${customer.id}) and Sale Transaction (ID: ${saleMain.id})`);

    // Call GET /api/sales/customer-history/:customerId
    const histRes = await fetch(`http://localhost:3000/api/sales/customer-history/${customer.id}`);
    if (!histRes.ok) {
      throw new Error(`Customer history API failed: ${await histRes.text()}`);
    }

    const history = await histRes.json();
    console.log(`✅ Step 3: Verified Customer Past Purchase History API returned ${history.length} record(s)`);

    if (history.length === 0) {
      throw new Error('❌ CUSTOMER HISTORY EMPTY!');
    }

    console.log(`  - Record 1: Product = "${history[0].productName}" | Qty = ${history[0].quantity} | Rate = Rs. ${history[0].rate} | Total = Rs. ${history[0].totalPrice}`);

    // Cleanup Test Data
    await prisma.saleMain.delete({ where: { id: saleMain.id } });
    await prisma.customerRec.delete({ where: { id: customer.id } });

    console.log('\n======================================');
    console.log('🎉 Phase 28: POS Evolution PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPOSEvolutionTest();
