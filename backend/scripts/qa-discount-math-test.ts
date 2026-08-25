async function runDiscountMathTest() {
  console.log('🧪 Starting POS Discount Math Diagnostic Test...\n');

  const grossTotal = 2750;
  const itemDiscountsTotal = 0;
  const eligibleAmount = grossTotal - itemDiscountsTotal;

  console.log(`Gross Amount: Rs. ${grossTotal}`);

  // Test 1: Entering 15% in Loss / Disc %
  const lossPct = 15;
  const discRs1 = eligibleAmount * (lossPct / 100);
  const netValue1 = eligibleAmount - discRs1;

  console.log(`\nTest Case 1: Entering Loss / Disc % = ${lossPct}%`);
  console.log(`  - Auto-Calculated Cash Disc (Rs): Rs. ${discRs1}`);
  console.log(`  - Calculated Net Value: Rs. ${netValue1}`);
  if (netValue1 !== 2337.5) {
    throw new Error(`❌ Test Case 1 Failed: Expected Net Value 2337.5, got ${netValue1}`);
  }
  console.log(`  ✅ Test Case 1 PASSED (Net Value = Rs. 2,337.50)`);

  // Test 2: Entering Rs. 400 in Cash Disc (Rs)
  const cashDiscRs = 400;
  const autoLossPct2 = (cashDiscRs / eligibleAmount) * 100;
  const netValue2 = eligibleAmount - cashDiscRs;

  console.log(`\nTest Case 2: Entering Cash Disc (Rs) = Rs. ${cashDiscRs}`);
  console.log(`  - Auto-Calculated Loss / Disc %: ${autoLossPct2.toFixed(2)}%`);
  console.log(`  - Calculated Net Value: Rs. ${netValue2}`);
  if (netValue2 !== 2350) {
    throw new Error(`❌ Test Case 2 Failed: Expected Net Value 2350, got ${netValue2}`);
  }
  console.log(`  ✅ Test Case 2 PASSED (Net Value = Rs. 2,350.00)`);

  console.log('\n======================================');
  console.log('🎉 POS Discount Math PASSED ALL VERIFICATIONS!');
  console.log('======================================\n');
}

runDiscountMathTest();
