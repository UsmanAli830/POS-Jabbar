import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting ERD Verification Test ---');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create a Product Category
      console.log('[1/4] Creating PCat...');
      const pcat = await tx.pCat.create({
        data: { name: 'Test Category - ' + Date.now() }
      });

      // Create a ProductRec
      console.log('      Creating ProductRec...');
      const product = await tx.productRec.create({
        data: {
          productName: 'Mock Verification Product',
          pCatId: pcat.id,
          retailPrice: 150,
          costPrice: 100,
          currentStock: 50,
          barCode: 'TEST-' + Date.now()
        }
      });

      // 2. Create CustomerRec with OpeningBalance
      console.log('[2/4] Creating CustomerRec...');
      const customer = await tx.customerRec.create({
        data: {
          custName: 'Mock Verification Customer',
          openingBalance: 500,
          businessName: 'Mock Business LLC',
          phone: '555-0100',
          zoneId: null
        }
      });

      // Create customer's FinHead
      console.log('      Creating Customer FinHead...');
      const customerFinHead = await tx.finHead.create({
        data: {
          name: `Customer: ${customer.custName}`,
          customerRecId: customer.id
        }
      });

      // Ensure 'Sales Revenue' and 'Cash in Till' exist for the ledger test
      let salesRev = await tx.finHead.findFirst({ where: { name: 'Sales Revenue' } });
      if (!salesRev) {
        salesRev = await tx.finHead.create({ data: { name: 'Sales Revenue' } });
      }

      // 3. Create SaleMain
      console.log('[3/4] Creating SaleMain...');
      const sale = await tx.saleMain.create({
        data: {
          customerRecId: customer.id,
          totalAmount: 150,
          details: {
            create: [
              {
                productRecId: product.id,
                qty: 1,
                price: 150
              }
            ]
          }
        },
        include: { details: true }
      });

      // 4. Create CashFlowMAIN and CashFlowDTL (Ledger Entries)
      console.log('[4/4] Creating CashFlowMAIN and CashFlowDTL...');
      const cashflow = await tx.cashFlowMAIN.create({
        data: {
          description: `Verification Sale ID ${sale.id}`,
          details: {
            create: [
              {
                finHeadId: salesRev.id,
                amount: 150,
                transactionType: 'CR' // Credit Revenue
              },
              {
                finHeadId: customerFinHead.id,
                amount: 150,
                transactionType: 'DR' // Debit AR
              }
            ]
          }
        },
        include: { details: true }
      });

      return { product, customer, sale, cashflow };
    });

    console.log('\n✅ Verification Test Passed Successfully!');
    console.log('Created Data:');
    console.dir(result, { depth: null });
    
  } catch (error) {
    console.error('\n❌ Verification Test Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
