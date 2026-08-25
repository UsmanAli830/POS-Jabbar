import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runExactBottomPanelTest() {
  console.log('🧪 Starting Phase 30: Exact Bottom Panel Integration Test...\n');

  try {
    // 1. Create Test Customer & Products
    const custName = `QA Bottom Panel Customer ${Date.now()}`;
    const customer = await prisma.customerRec.create({
      data: { custName, openingBalance: 0 }
    });

    const cat = await prisma.pCat.create({ data: { name: `Cat ${Date.now()}` } });

    const prodA = await prisma.productRec.create({
      data: {
        productCode: `P-A-${Date.now().toString().slice(-4)}`,
        productName: 'Sanitary Tap Mixer (Product A)',
        pCatId: cat.id,
        retailPrice: 1500,
        currentStock: 50
      }
    });

    const prodB = await prisma.productRec.create({
      data: {
        productCode: `P-B-${Date.now().toString().slice(-4)}`,
        productName: 'Marble Wash Basin (Product B)',
        pCatId: cat.id,
        retailPrice: 3200,
        currentStock: 30
      }
    });

    // 2. Submit 2 Separate Past Sales
    const sale1 = await prisma.saleMain.create({
      data: {
        customerRecId: customer.id,
        totalAmount: 4500,
        details: {
          create: [{ productRecId: prodA.id, qty: 3, price: 1500 }]
        }
      }
    });

    const sale2 = await prisma.saleMain.create({
      data: {
        customerRecId: customer.id,
        totalAmount: 6400,
        details: {
          create: [{ productRecId: prodB.id, qty: 2, price: 3200 }]
        }
      }
    });

    console.log(`✅ Step 1: Created Customer (ID: ${customer.id}) and 2 Sales (Prod A: Rs 1500, Prod B: Rs 3200)`);

    // 3. Test Dynamic Filter: Customer wise Product History for Product A ONLY
    const prodAFilterRes = await fetch(`http://localhost:3000/api/sales/customer-product-history?customerId=${customer.id}&productId=${prodA.id}`);
    if (!prodAFilterRes.ok) throw new Error(`Product A filter failed: ${await prodAFilterRes.text()}`);

    const prodAHistory = await prodAFilterRes.json();
    console.log(`✅ Step 2: Tested "Customer wise Product History" filter for Product A -> Returned ${prodAHistory.length} record(s)`);

    if (prodAHistory.length !== 1 || prodAHistory[0].productId !== prodA.id) {
      throw new Error(`❌ DYNAMIC FILTER ERROR: Expected 1 record for Product A, got ${prodAHistory.length}`);
    }
    console.log(`  - Returned Record: Item = "${prodAHistory[0].productName}" | Qty = ${prodAHistory[0].quantity} | Rate = Rs. ${prodAHistory[0].rate}`);

    // 4. Test Filter: All Records for Customer
    const allRecordsRes = await fetch(`http://localhost:3000/api/sales/customer-product-history?customerId=${customer.id}`);
    if (!allRecordsRes.ok) throw new Error(`All records query failed: ${await allRecordsRes.text()}`);

    const allHistory = await allRecordsRes.json();
    console.log(`✅ Step 3: Tested "All Record" checkbox -> Returned ${allHistory.length} record(s)`);

    if (allHistory.length !== 2) {
      throw new Error(`❌ ALL RECORDS ERROR: Expected 2 records for customer, got ${allHistory.length}`);
    }

    // Cleanup Test Data
    await prisma.saleMain.delete({ where: { id: sale1.id } });
    await prisma.saleMain.delete({ where: { id: sale2.id } });
    await prisma.customerRec.delete({ where: { id: customer.id } });
    await prisma.productRec.delete({ where: { id: prodA.id } });
    await prisma.productRec.delete({ where: { id: prodB.id } });
    await prisma.pCat.delete({ where: { id: cat.id } });

    console.log('\n======================================');
    console.log('🎉 Phase 30: Exact Bottom Panel PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runExactBottomPanelTest();
