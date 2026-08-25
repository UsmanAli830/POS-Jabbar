import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runSeparateDuesTest() {
  console.log('🧪 Starting Phase 27: Separate Dues Management Integration Test...\n');

  try {
    // ==========================================
    // 1. CUSTOMER DUES TEST
    // ==========================================
    const custName = `QA Dues Customer ${Date.now()}`;
    const customer = await prisma.customerRec.create({
      data: { custName, openingBalance: 10000 }
    });

    const custFinHead = await prisma.finHead.create({
      data: { name: `Customer: ${custName}`, customerRecId: customer.id }
    });

    console.log(`✅ Step 1: Created Test Customer (ID: ${customer.id}) with Opening Dues = Rs. 10,000`);

    // Submit Customer Payment Rs. 5,000
    const custPayRes = await fetch('http://localhost:3000/api/dues/customer/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer.id,
        amount: 5000,
        paymentMethod: 'Cash',
        remarks: 'Phase 27 QA Dues Payment Test'
      })
    });

    if (!custPayRes.ok) {
      const errText = await custPayRes.text();
      throw new Error(`Customer payment failed: ${errText}`);
    }

    const custPayData = await custPayRes.json();
    console.log(`✅ Step 2: Submitted Rs. 5,000 Payment via POST /api/dues/customer/payment`);
    console.log(`  - New Live Customer Balance = Rs. ${custPayData.newLiveBalance} (Expected: Rs. 5,000)`);

    if (Math.abs(custPayData.newLiveBalance - 5000) > 0.01) {
      throw new Error(`❌ CUSTOMER BALANCE MISMATCH: Expected 5000, got ${custPayData.newLiveBalance}`);
    }

    // Verify GET /api/dues/customer/:id/history
    const custHistRes = await fetch(`http://localhost:3000/api/dues/customer/${customer.id}/history`);
    const custHistData = await custHistRes.json();

    if (!custHistData.history || custHistData.history.length === 0) {
      throw new Error(`❌ CUSTOMER PAYMENT HISTORY EMPTY!`);
    }

    console.log(`✅ Step 3: Verified Customer Payment History Grid returned ${custHistData.history.length} record(s)`);
    console.log(`  - Record 1: Amount = Rs. ${custHistData.history[0].amount} | Timestamp: ${custHistData.history[0].date}`);

    // ==========================================
    // 2. VENDOR DUES TEST
    // ==========================================
    const vendorName = `QA Dues Vendor ${Date.now()}`;
    const vendor = await prisma.sellerRec.create({
      data: { companyName: vendorName, openingBalance: 12000 }
    });

    const vendorFinHead = await prisma.finHead.create({
      data: { name: `Vendor: ${vendorName}`, sellerRecId: vendor.id }
    });

    console.log(`\n✅ Step 4: Created Test Vendor (ID: ${vendor.id}) with Opening Payable Dues = Rs. 12,000`);

    // Submit Vendor Payment Rs. 4,000
    const vendPayRes = await fetch('http://localhost:3000/api/dues/vendor/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId: vendor.id,
        amount: 4000,
        paymentMethod: 'Bank Transfer',
        remarks: 'Phase 27 QA Vendor Dues Payment Test'
      })
    });

    if (!vendPayRes.ok) {
      const errText = await vendPayRes.text();
      throw new Error(`Vendor payment failed: ${errText}`);
    }

    const vendPayData = await vendPayRes.json();
    console.log(`✅ Step 5: Submitted Rs. 4,000 Payment via POST /api/dues/vendor/payment`);
    console.log(`  - New Live Vendor Balance = Rs. ${vendPayData.newLiveBalance} (Expected: Rs. 8,000)`);

    if (Math.abs(vendPayData.newLiveBalance - 8000) > 0.01) {
      throw new Error(`❌ VENDOR BALANCE MISMATCH: Expected 8000, got ${vendPayData.newLiveBalance}`);
    }

    // Verify GET /api/dues/vendor/:id/history
    const vendHistRes = await fetch(`http://localhost:3000/api/dues/vendor/${vendor.id}/history`);
    const vendHistData = await vendHistRes.json();

    if (!vendHistData.history || vendHistData.history.length === 0) {
      throw new Error(`❌ VENDOR PAYMENT HISTORY EMPTY!`);
    }

    console.log(`✅ Step 6: Verified Vendor Payment History Grid returned ${vendHistData.history.length} record(s)`);
    console.log(`  - Record 1: Amount = Rs. ${vendHistData.history[0].amount} | Timestamp: ${vendHistData.history[0].date}`);

    // Cleanup Test Data
    await prisma.customerRec.delete({ where: { id: customer.id } });
    await prisma.sellerRec.delete({ where: { id: vendor.id } });

    console.log('\n======================================');
    console.log('🎉 Phase 27: Separate Dues Management PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSeparateDuesTest();
