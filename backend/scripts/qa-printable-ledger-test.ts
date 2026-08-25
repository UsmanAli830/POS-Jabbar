import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runPrintableLedgerTest() {
  console.log('🧪 Starting Phase 24: Printable Ledger Engine Integration Test...\n');

  try {
    // 1. Create a Test Customer with opening balance = 5000
    const testCustName = `QA Printable Ledger Customer ${Date.now()}`;
    const customer = await prisma.customerRec.create({
      data: {
        custName: testCustName,
        openingBalance: 5000
      }
    });

    const custFinHead = await prisma.finHead.create({
      data: {
        name: `Customer: ${testCustName}`,
        customerRecId: customer.id
      }
    });

    const salesRevHead = await prisma.finHead.findFirst({ where: { name: 'Sales Revenue' } });
    const cashHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } });

    console.log(`✅ Step 1: Created Test Customer (ID: ${customer.id}) with Base Opening Balance = Rs. 5,000`);

    // 2. Insert Prior Transaction BEFORE 2026-08-01 (Debit 10,000 on 2026-07-15)
    await prisma.cashFlowMAIN.create({
      data: {
        date: new Date('2026-07-15T10:00:00.000Z'),
        description: 'Prior Invoice: INV-JULY-01',
        details: {
          create: [
            { finHeadId: custFinHead.id, amount: 10000, transactionType: 'DR' },
            { finHeadId: salesRevHead?.id || custFinHead.id, amount: 10000, transactionType: 'CR' }
          ]
        }
      }
    });

    // 3. Insert Period Transactions WITHIN 2026-08-01 to 2026-08-31
    // Tx 1: August Invoice (Debit 20,000 on 2026-08-10)
    await prisma.cashFlowMAIN.create({
      data: {
        date: new Date('2026-08-10T12:00:00.000Z'),
        description: 'August Sale Against Inv # 262',
        details: {
          create: [
            { finHeadId: custFinHead.id, amount: 20000, transactionType: 'DR' },
            { finHeadId: salesRevHead?.id || custFinHead.id, amount: 20000, transactionType: 'CR' }
          ]
        }
      }
    });

    // Tx 2: August Payment (Credit 15,000 on 2026-08-15)
    await prisma.cashFlowMAIN.create({
      data: {
        date: new Date('2026-08-15T14:00:00.000Z'),
        description: 'Payment Received: Inv # 262',
        details: {
          create: [
            { finHeadId: custFinHead.id, amount: 15000, transactionType: 'CR' },
            { finHeadId: cashHead?.id || custFinHead.id, amount: 15000, transactionType: 'DR' }
          ]
        }
      }
    });

    console.log(`✅ Step 2: Inserted Prior (July) and Period (August) CashFlow transactions`);

    // 4. Query API GET /api/ledger/customer/:id?startDate=2026-08-01&endDate=2026-08-31
    const res = await fetch(`http://localhost:3000/api/ledger/customer/${customer.id}?startDate=2026-08-01&endDate=2026-08-31`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ledger API request failed: ${errText}`);
    }

    const data = await res.json();
    console.log(`\n📊 API Response Summary:`);
    console.log(`  - Customer: ${data.customer.name}`);
    console.log(`  - Period Opening Balance (Base 5k + July DR 10k): Rs. ${data.periodOpeningBalance}`);
    console.log(`  - Transactions Returned: ${data.transactions.length}`);

    // Assert Period Opening Balance
    if (Math.abs(data.periodOpeningBalance - 15000) > 0.01) {
      throw new Error(`❌ PERIOD OPENING BAL MISMATCH: Expected Rs. 15,000, got Rs. ${data.periodOpeningBalance}`);
    }

    if (data.transactions.length !== 2) {
      throw new Error(`❌ TRANSACTION COUNT MISMATCH: Expected 2 transactions, got ${data.transactions.length}`);
    }

    // Verify Row-by-Row Running Balance
    let runBal = data.periodOpeningBalance;
    for (const t of data.transactions) {
      runBal += (t.debit - t.credit);
      console.log(`  - Row: ${new Date(t.date).toLocaleDateString()} | ${t.description} | DR: ${t.debit} | CR: ${t.credit} | Running Bal: ${runBal}`);
    }

    if (Math.abs(runBal - 20000) > 0.01) {
      throw new Error(`❌ ENDING BALANCE MISMATCH: Expected Rs. 20,000, got Rs. ${runBal}`);
    }
    console.log(`✅ Step 3: Verified Period Opening Balance (Rs. 15,000) & Ending Running Balance (Rs. 20,000)`);

    // Cleanup Test Data
    await prisma.customerRec.delete({ where: { id: customer.id } });
    console.log('\n======================================');
    console.log('🎉 Phase 24: Printable Ledger Generation PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPrintableLedgerTest();
