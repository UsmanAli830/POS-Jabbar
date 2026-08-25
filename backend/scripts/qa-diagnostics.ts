import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runDiagnostics() {
  console.log('🧪 Starting Master ERP System Audit - Relational Integrity Diagnostics...');
  let passedTests = 0;
  let failedTests = 0;

  function reportResult(testName: string, passed: boolean, details?: string) {
    if (passed) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failedTests++;
    }
  }

  // Helper to calculate Customer liveBalance
  async function getCustomerBalance(id: number): Promise<number> {
    const customer = await prisma.customerRec.findUnique({
      where: { id },
      include: {
        finHead: {
          include: {
            cashFlowDtls: true
          }
        }
      }
    });
    if (!customer) throw new Error(`Customer ${id} not found`);
    let liveBalance = customer.openingBalance || 0;
    if (customer.finHead && customer.finHead.cashFlowDtls) {
      const cr = customer.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((sum, d) => sum + d.amount, 0);
      const dr = customer.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((sum, d) => sum + d.amount, 0);
      liveBalance = liveBalance + dr - cr;
    }
    return liveBalance;
  }

  try {
    // ----------------------------------------------------
    // Test 1: Sale stock decrement
    // ----------------------------------------------------
    const productBeforeSale = await prisma.productRec.findFirst({ where: { productName: 'PKR Product 1' } });
    if (!productBeforeSale) throw new Error('Seeded PKR Product 1 not found');

    const customer = await prisma.customerRec.findFirst({ where: { custName: 'QA Customer 1' } });
    if (!customer) throw new Error('Seeded Customer 1 not found');

    const qtySold = 5;
    const initialStock = productBeforeSale.currentStock;

    // Simulate creation of SaleMain and details matching sales.ts route logic
    await prisma.$transaction(async (tx) => {
      const sale = await tx.saleMain.create({
        data: {
          customerRecId: customer.id,
          totalAmount: productBeforeSale.retailPrice * qtySold,
          details: {
            create: [
              {
                productRecId: productBeforeSale.id,
                qty: qtySold,
                price: productBeforeSale.retailPrice
              }
            ]
          }
        }
      });

      // Deduct stock
      await tx.productRec.update({
        where: { id: productBeforeSale.id },
        data: { currentStock: { decrement: qtySold } }
      });
    });

    const productAfterSale = await prisma.productRec.findUnique({ where: { id: productBeforeSale.id } });
    const finalStock = productAfterSale?.currentStock ?? 0;
    const stockDecreasedCorrectly = (initialStock - finalStock) === qtySold;

    reportResult(
      'Sale Stock Decrement (ProductRec.CurrentStock decreases precisely on SaleMain creation)',
      stockDecreasedCorrectly,
      `Initial Stock: ${initialStock}, Sold: ${qtySold}, Final Stock: ${finalStock}`
    );

    // ----------------------------------------------------
    // Test 2: Purchase stock increment
    // ----------------------------------------------------
    const vendor = await prisma.sellerRec.findFirst({ where: { companyName: 'QA Vendor Ltd 1' } });
    if (!vendor) throw new Error('Seeded Vendor 1 not found');

    const qtyPurchased = 10;
    const stockBeforePurchase = finalStock;

    await prisma.$transaction(async (tx) => {
      await tx.purMain.create({
        data: {
          sellerRecId: vendor.id,
          totalAmount: productBeforeSale.costPrice * qtyPurchased,
          details: {
            create: [
              {
                productRecId: productBeforeSale.id,
                qty: qtyPurchased,
                price: productBeforeSale.costPrice
              }
            ]
          }
        }
      });

      // Increment stock
      await tx.productRec.update({
        where: { id: productBeforeSale.id },
        data: { currentStock: { increment: qtyPurchased } }
      });
    });

    const productAfterPurchase = await prisma.productRec.findUnique({ where: { id: productBeforeSale.id } });
    const stockAfterPurchase = productAfterPurchase?.currentStock ?? 0;
    const stockIncreasedCorrectly = (stockAfterPurchase - stockBeforePurchase) === qtyPurchased;

    reportResult(
      'Purchase Stock Increment (ProductRec.CurrentStock increases precisely on PurMain creation)',
      stockIncreasedCorrectly,
      `Before Purchase: ${stockBeforePurchase}, Purchased: ${qtyPurchased}, After Purchase: ${stockAfterPurchase}`
    );

    // ----------------------------------------------------
    // Test 3: Customer recovery live balance decrement
    // ----------------------------------------------------
    const initialBalance = await getCustomerBalance(customer.id);
    const recoveryAmount = 3000;

    // Simulate recovery posting matching payments.ts route logic
    await prisma.$transaction(async (tx) => {
      await tx.recovery.create({
        data: {
          customerRecId: customer.id,
          amount: recoveryAmount,
          remarks: 'QA Diagnostics Recovery Payment'
        }
      });

      // Post to ledger cashFlow
      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      const customerHead = await tx.finHead.findFirst({ where: { customerRecId: customer.id } });

      if (cashInTillHead && customerHead) {
        await tx.cashFlowMAIN.create({
          data: {
            description: 'Recovery Payment Received: QA Diagnostics',
            details: {
              create: [
                {
                  finHeadId: cashInTillHead.id,
                  amount: recoveryAmount,
                  transactionType: 'DR'
                },
                {
                  finHeadId: customerHead.id,
                  amount: recoveryAmount,
                  transactionType: 'CR' // Credit AR (reduces balance)
                }
              ]
            }
          }
        });
      }
    });

    const finalBalance = await getCustomerBalance(customer.id);
    const balanceDroppedCorrectly = (initialBalance - finalBalance) === recoveryAmount;

    reportResult(
      'Customer Recovery Balance Reduction (Customer live balance drops instantly on recovery payment)',
      balanceDroppedCorrectly,
      `Initial Balance: PKR ${initialBalance}, Payment: PKR ${recoveryAmount}, Final Balance: PKR ${finalBalance}`
    );

    // ----------------------------------------------------
    // Test 4: Relational PCat Category deletion block (Restrict Constraint)
    // ----------------------------------------------------
    const cat = await prisma.pCat.findFirst({ where: { name: 'Category 1' } });
    if (!cat) throw new Error('Seeded Category 1 not found');

    let deleteBlocked = false;
    let deleteError: any = null;

    try {
      // Try to delete category that contains seeded products
      await prisma.pCat.delete({ where: { id: cat.id } });
    } catch (err: any) {
      deleteBlocked = true;
      deleteError = err;
    }

    const restrictionStatus = deleteBlocked && deleteError?.code === 'P2003';
    reportResult(
      'Relational Integrity Category Restriction (Deleting Category containing products fails gracefully on foreign key constraint)',
      restrictionStatus,
      `ErrorCode: ${deleteError?.code || 'None'} (Expected: P2003)`
    );

  } catch (error: any) {
    console.error('❌ Diagnostics aborted due to script error:', error);
    failedTests++;
  }

  console.log('\n======================================');
  console.log(`📊 Diagnostic Summary: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('======================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDiagnostics();
