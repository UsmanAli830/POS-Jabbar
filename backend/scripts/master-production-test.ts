import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Set working directory to backend
const backendDir = path.resolve(__dirname, '..');
process.chdir(backendDir);

const testDbUrlForCli = 'file:./test.db';
const testDbUrl = 'file:./test.db';
const testDbFilePath = path.resolve(backendDir, 'prisma', 'test.db');
process.env.DATABASE_URL = testDbUrl;

// 1. Load dotenv without overwriting DATABASE_URL
dotenv.config({ path: path.resolve(backendDir, '.env') });
process.env.DATABASE_URL = testDbUrl;

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'wholesale_pos_super_secret_jwt_key_2026';
}
const jwtSecret = process.env.JWT_SECRET;

console.log('====================================================================');
console.log('       MASTER PRODUCTION VERIFICATION SUITE');
console.log('====================================================================');
console.log(`🔄 Re-creating fresh sandboxed test database (${testDbFilePath})...`);

if (fs.existsSync(testDbFilePath)) {
  try { fs.unlinkSync(testDbFilePath); } catch (e) {}
}
if (fs.existsSync(testDbFilePath + '-wal')) {
  try { fs.unlinkSync(testDbFilePath + '-wal'); } catch (e) {}
}
if (fs.existsSync(testDbFilePath + '-shm')) {
  try { fs.unlinkSync(testDbFilePath + '-shm'); } catch (e) {}
}

try {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: testDbUrlForCli, JWT_SECRET: jwtSecret },
    cwd: backendDir,
    stdio: 'pipe'
  });
  console.log('✅ Sandboxed test database force-reset and schema pushed successfully.\n');
} catch (e: any) {
  console.error('❌ Failed to push schema to test.db:', e.message);
  process.exit(1);
}

// 3. Dynamically import app & PrismaClient AFTER db push
process.env.DATABASE_URL = testDbUrl;
const request = require('supertest');
const appModule = require('../app');
const app = appModule.default || appModule;
const { prisma } = require('../db');
const jwt = require('jsonwebtoken');

function assert(condition: boolean, message: string, details?: any) {
  if (!condition) {
    if (details) console.error('Details:', details);
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`   ✅ ${message}`);
  }
}

async function runMasterProductionTest() {
  try {
    // Setup Master Super Admin & Core Companies
    const compA = await prisma.company.create({ data: { name: 'Company A' } });
    const compB = await prisma.company.create({ data: { name: 'Company B' } });

    const superadmin = await prisma.employeeRec.upsert({
      where: { username: 'superadmin' },
      update: { companyId: compA.id },
      create: {
        name: 'Super Admin',
        username: 'superadmin',
        role: 'SUPER_ADMIN',
        isAdmin: true,
        companyId: compA.id
      }
    });

    const adminTokenA = jwt.sign(
      { id: superadmin.id, username: 'superadmin', role: 'SUPER_ADMIN', isAdmin: true, companyId: compA.id },
      jwtSecret
    );
    const adminTokenB = jwt.sign(
      { id: superadmin.id, username: 'superadmin', role: 'SUPER_ADMIN', isAdmin: true, companyId: compB.id },
      jwtSecret
    );

    // Initialize required financial heads for sales and accounting
    await prisma.finHead.create({ data: { name: 'Sales Revenue' } });
    await prisma.finHead.create({ data: { name: 'Cash in Till' } });
    await prisma.finHead.create({ data: { name: 'Inventory Asset' } });

    // =======================================================================
    // MODULE 1: Master Data CRUD & Gap-Reuse Sequence
    // =======================================================================
    console.log('--------------------------------------------------------------------');
    console.log('MODULE 1: Master Data CRUD & Gap-Reuse Sequence');
    console.log('--------------------------------------------------------------------');

    // 1A. Customer Gap Reuse
    const resNextCust1 = await request(app).get('/api/customers/next-code').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resNextCust1.body.nextCode === '1', 'Initial Customer nextCode is 1', resNextCust1.body);

    const c1 = await prisma.customerRec.create({ data: { custName: 'Customer 1', phone: '111', companyId: compA.id } });
    const c2 = await prisma.customerRec.create({ data: { custName: 'Customer 2', phone: '222', companyId: compA.id } });
    const c3 = await prisma.customerRec.create({ data: { custName: 'Customer 3', phone: '333', companyId: compA.id } });

    assert(c1.id === 1 && c2.id === 2 && c3.id === 3, 'Created 3 customers with IDs 1, 2, 3', { c1: c1.id, c2: c2.id, c3: c3.id });

    // Delete customer 1 (gap created at ID 1)
    await prisma.customerRec.delete({ where: { id: c1.id } });

    const resNextCustGap = await request(app).get('/api/customers/next-code').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resNextCustGap.body.nextCode === '1', 'Customer gap reuse correctly identifies ID 1', resNextCustGap.body);

    // Update customer 2
    const resUpdateCust = await request(app)
      .put(`/api/customers/${c2.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ custName: 'Customer 2 Updated', phone: '999888' });
    assert(resUpdateCust.status === 200 && resUpdateCust.body.custName === 'Customer 2 Updated', 'Customer update persists correctly', resUpdateCust.body);

    // 1B. Vendor Gap Reuse
    const resNextVend1 = await request(app).get('/api/vendors/next-code').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resNextVend1.body.nextCode === '1', 'Initial Vendor nextCode is 1', resNextVend1.body);

    const v1 = await prisma.sellerRec.create({ data: { companyName: 'Vendor 1', phone: '111', companyId: compA.id } });
    const v2 = await prisma.sellerRec.create({ data: { companyName: 'Vendor 2', phone: '222', companyId: compA.id } });
    const v3 = await prisma.sellerRec.create({ data: { companyName: 'Vendor 3', phone: '333', companyId: compA.id } });

    assert(v1.id === 1 && v2.id === 2 && v3.id === 3, 'Created 3 vendors with IDs 1, 2, 3', { v1: v1.id, v2: v2.id, v3: v3.id });

    await prisma.sellerRec.delete({ where: { id: v1.id } });
    const resNextVendGap = await request(app).get('/api/vendors/next-code').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resNextVendGap.body.nextCode === '1', 'Vendor gap reuse correctly identifies ID 1', resNextVendGap.body);

    const resUpdateVend = await request(app)
      .put(`/api/vendors/${v2.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ companyName: 'Vendor 2 Updated', contactPerson: 'John Manager' });
    assert(resUpdateVend.status === 200 && resUpdateVend.body.companyName === 'Vendor 2 Updated', 'Vendor update persists correctly', resUpdateVend.body);

    // 1C. Product Gap Reuse
    const pCat = await prisma.pCat.create({ data: { name: 'General Category' } });
    const resNextProd1 = await request(app).get('/api/products/next-code').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resNextProd1.body.nextCode === '1', 'Initial Product nextCode is 1', resNextProd1.body);

    const p1 = await prisma.productRec.create({ data: { productName: 'Product 1', productCode: '1', retailPrice: 100, costPrice: 60, currentStock: 50, pCatId: pCat.id, companyId: compA.id } });
    const p2 = await prisma.productRec.create({ data: { productName: 'Product 2', productCode: '2', retailPrice: 150, costPrice: 90, currentStock: 50, pCatId: pCat.id, companyId: compA.id } });
    const p3 = await prisma.productRec.create({ data: { productName: 'Product 3', productCode: '3', retailPrice: 200, costPrice: 120, currentStock: 50, pCatId: pCat.id, companyId: compA.id } });

    assert(p1.productCode === '1' && p2.productCode === '2' && p3.productCode === '3', 'Created 3 products with sequential codes 1, 2, 3');

    await prisma.productRec.delete({ where: { id: p1.id } });
    const resNextProdGap = await request(app).get('/api/products/next-code').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resNextProdGap.body.nextCode === '1', 'Product gap reuse correctly identifies code 1', resNextProdGap.body);

    const resUpdateProd = await request(app)
      .put(`/api/products/${p2.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ productName: 'Product 2 Premium', retailPrice: 175 });
    assert(resUpdateProd.status === 200 && resUpdateProd.body.productName === 'Product 2 Premium', 'Product update persists correctly', resUpdateProd.body);

    // =======================================================================
    // MODULE 2: Sales, Invoicing & Multi-Tenant Sequencing
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 2: Sales, Invoicing & Multi-Tenant Sequencing');
    console.log('--------------------------------------------------------------------');

    // Re-create Customer 1 for Company A and Customer 1 for Company B
    const custCompA = await prisma.customerRec.create({ data: { custName: 'Company A Customer', companyId: compA.id } });
    const custCompB = await prisma.customerRec.create({ data: { custName: 'Company B Customer', companyId: compB.id } });

    const prodCompA = await prisma.productRec.create({ data: { productName: 'Comp A Item', productCode: '10', retailPrice: 500, costPrice: 300, currentStock: 20, companyId: compA.id } });
    const prodCompB = await prisma.productRec.create({ data: { productName: 'Comp B Item', productCode: '20', retailPrice: 500, costPrice: 300, currentStock: 20, companyId: compB.id } });

    // Sale on Company A
    const saleCompA = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        customerId: custCompA.id,
        paymentMethod: 'Credit / Unpaid',
        items: [{ productId: prodCompA.id, quantity: 2, unitPrice: 500, grossAmount: 1000 }]
      });
    assert(saleCompA.status === 200 || saleCompA.status === 201, 'Sale on Company A created successfully', saleCompA.body);
    assert(saleCompA.body.invoiceNumber === 'INV-1' || saleCompA.body.id === 1, 'Company A first invoice sequence is 1 (INV-1)', saleCompA.body);

    // Sale on Company B
    const saleCompB = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .send({
        customerId: custCompB.id,
        paymentMethod: 'Credit / Unpaid',
        items: [{ productId: prodCompB.id, quantity: 1, unitPrice: 500, grossAmount: 500 }]
      });
    assert(saleCompB.status === 200 || saleCompB.status === 201, 'Sale on Company B created successfully', saleCompB.body);
    assert(saleCompB.body.invoiceNumber === 'INV-1' || saleCompB.body.id === 1, 'Company B isolated invoice sequence starts at 1 (INV-1)', saleCompB.body);

    // Test Discount Order Math: CASH_FIRST vs PERCENT_FIRST
    // Product gross = 1000. Cash Disc = 100, Disc % = 10%
    // CASH_FIRST: (1000 - 100) = 900 -> 900 - (900 * 10%) = 810 net
    const saleDiscOrder = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        customerId: custCompA.id,
        paymentMethod: 'Credit / Unpaid',
        items: [
          {
            productId: prodCompA.id,
            quantity: 2,
            unitPrice: 500,
            grossAmount: 1000,
            cashDiscount: 100,
            discPercent: 10,
            discountOrder: 'CASH_FIRST'
          }
        ]
      });
    assert(saleDiscOrder.status === 200 || saleDiscOrder.status === 201, 'Sale with line-item discounts processed', saleDiscOrder.body);
    const lineNet = saleDiscOrder.body.details[0].netAmount;
    assert(lineNet === 810, `Order of operations math CASH_FIRST correct: expected 810, got ${lineNet}`, saleDiscOrder.body);

    // Confirm item stock decreases automatically
    const prodAfterSale = await prisma.productRec.findUnique({ where: { id: prodCompA.id } });
    assert(prodAfterSale?.currentStock === 16, `Stock decreased from 20 to 16 after sales (2 + 2 = 4 sold)`);

    // =======================================================================
    // MODULE 3: Stock Selling Modes (Standard & Negative Stock)
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 3: Stock Selling Modes (Standard & Negative Stock)');
    console.log('--------------------------------------------------------------------');

    const zeroStockProd = await prisma.productRec.create({
      data: { productName: 'Zero Stock Item', productCode: 'ZERO-1', retailPrice: 200, costPrice: 100, currentStock: 0, companyId: compA.id }
    });

    // Positive stock valuation check
    const stockValPositive = prodAfterSale!.currentStock * prodAfterSale!.costPrice;
    assert(stockValPositive === 16 * 300, 'Positive Stock Value = CurrentStock * CostPrice');

    // Sell 2 units from 0 stock
    const saleZeroStock = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        customerId: custCompA.id,
        paymentMethod: 'Credit / Unpaid',
        items: [{ productId: zeroStockProd.id, quantity: 2, unitPrice: 200 }]
      });
    assert(saleZeroStock.status === 200 || saleZeroStock.status === 201, 'Zero/Negative stock sale allowed', saleZeroStock.body);

    const negProdAfter = await prisma.productRec.findUnique({ where: { id: zeroStockProd.id } });
    assert(negProdAfter?.currentStock === -2, 'CurrentStock correctly evaluates to negative (-2)');

    // Verify Balance Sheet Inventory Valuation with negative stock
    const resBSVal = await request(app).get('/api/reports/balance-sheet').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resBSVal.status === 200, 'Balance Sheet fetched', resBSVal.body);
    const expectedTotalInvValuation = (16 * 300) + (50 * 90) + (50 * 120) + (-2 * 100);
    assert(resBSVal.body.assets.inventoryValuation === expectedTotalInvValuation, `Balance Sheet inventory valuation evaluates negative stock (-200) properly`, resBSVal.body);

    // =======================================================================
    // MODULE 4: Vendor Purchases & Split Settlements
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 4: Vendor Purchases & Split Settlements');
    console.log('--------------------------------------------------------------------');

    const vendorSettlement = await prisma.sellerRec.create({ data: { companyName: 'Split Vendor', companyId: compA.id } });
    const purchaseProd = await prisma.productRec.create({ data: { productName: 'Pur Item', productCode: 'PUR-1', retailPrice: 1000, costPrice: 500, currentStock: 0, companyId: compA.id } });

    // Vendor purchase of Rs. 50,000. Cash Paid = 20,000.
    const resPur = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        vendorId: vendorSettlement.id,
        cashPaid: 20000,
        items: [{ productId: purchaseProd.id, quantity: 100, costPrice: 500 }] // 100 * 500 = 50,000
      });

    assert(resPur.status === 200 || resPur.status === 201, 'Vendor purchase of Rs. 50,000 created', resPur.body);

    // Confirm Vendor's live payable balance is 30,000
    const resVendors = await request(app).get('/api/vendors').set('Authorization', `Bearer ${adminTokenA}`);
    const vLive = resVendors.body.find((v: any) => v.id === vendorSettlement.id);
    assert(vLive && vLive.liveBalance === 30000, `Vendor live payable balance correctly set to Rs. 30,000`, vLive);

    // Verify CashFlowDTL double entries
    const vendorFinHead = await prisma.finHead.findFirst({ where: { sellerRecId: vendorSettlement.id } });
    assert(vendorFinHead !== null, 'Vendor FinHead created');

    const invAssetHead = await prisma.finHead.findFirst({ where: { name: 'Inventory Asset' } });
    const cashHead = await prisma.finHead.findFirst({ where: { name: { contains: 'Cash' } } });

    const drInvEntry = await prisma.cashFlowDTL.findFirst({ where: { finHeadId: invAssetHead!.id, amount: 50000, transactionType: 'DR' } });
    assert(drInvEntry !== null, 'CashFlowDTL DR Inventory Asset Rs. 50,000 exists');

    const crCashEntry = await prisma.cashFlowDTL.findFirst({ where: { finHeadId: cashHead!.id, amount: 20000, transactionType: 'CR' } });
    assert(crCashEntry !== null, 'CashFlowDTL CR Cash in Till Rs. 20,000 exists');

    const crAPEntry = await prisma.cashFlowDTL.findFirst({ where: { finHeadId: vendorFinHead!.id, amount: 30000, transactionType: 'CR' } });
    assert(crAPEntry !== null, 'CashFlowDTL CR Accounts Payable Rs. 30,000 exists');

    // =======================================================================
    // MODULE 5: In-Place Returns & Modification History Logs
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 5: In-Place Returns & Modification History Logs');
    console.log('--------------------------------------------------------------------');

    // Create a sale with 3 items @ Rs. 100 = 300
    const returnCust = await prisma.customerRec.create({ data: { custName: 'Return Cust', companyId: compA.id } });
    const returnProd = await prisma.productRec.create({ data: { productName: 'Return Item', productCode: 'RET-1', retailPrice: 100, costPrice: 60, currentStock: 10, companyId: compA.id } });

    const targetSale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        customerId: returnCust.id,
        paymentMethod: 'Credit / Unpaid',
        items: [{ productId: returnProd.id, quantity: 3, unitPrice: 100 }]
      });
    
    const targetSaleId = targetSale.body.id;

    // Lookup invoice
    const resLookup = await request(app).get(`/api/sales/lookup/${targetSaleId}`).set('Authorization', `Bearer ${adminTokenA}`);
    assert(resLookup.status === 200, `Invoice INV-${targetSaleId} found via lookup`, resLookup.body);

    // Modify line quantity in-place (return 1 item, quantity reduced from 3 to 2)
    const resEdit = await request(app)
      .put(`/api/sales/${targetSaleId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        customerId: returnCust.id,
        total: 200,
        items: [{ productId: returnProd.id, qty: 2, price: 100, netAmount: 200 }]
      });

    assert(resEdit.status === 200, 'In-place sale modification response 200 OK', resEdit.body);
    assert(resEdit.body.id === targetSaleId, 'Original SaleMain record updated in-place (same ID)');
    assert(resEdit.body.totalAmount === 200, 'Sale total updated to Rs. 200');

    // Check stock incremented by 1
    const returnProdAfter = await prisma.productRec.findUnique({ where: { id: returnProd.id } });
    assert(returnProdAfter?.currentStock === 8, 'Stock restored by 1 unit (10 - 3 + 1 = 8)');

    // Check TransactionHistoryLog
    const historyLogs = await prisma.transactionHistoryLog.findMany({ where: { saleMainId: targetSaleId } });
    assert(historyLogs.length > 0, 'TransactionHistoryLog entry written for modified invoice');
    assert(historyLogs[0].changeDetails.includes('In-place edit'), 'Transaction history log contains edit details');

    // =======================================================================
    // MODULE 6: Customer Overpayment & Balance Sheet Liabilities
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 6: Customer Overpayment & Balance Sheet Liabilities');
    console.log('--------------------------------------------------------------------');

    // Debt of Rs. 8,000
    const overpaidCust = await prisma.customerRec.create({ data: { custName: 'Overpaid Customer', openingBalance: 8000, companyId: compA.id } });
    const overpaidFinHead = await prisma.finHead.create({ data: { name: 'Customer: Overpaid Customer', customerRecId: overpaidCust.id } });

    // Payment of Rs. 10,000 received
    const resRec = await request(app)
      .post('/api/payments/receive')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        customerId: overpaidCust.id,
        amount: 10000,
        remarks: 'Overpayment test'
      });
    assert(resRec.status === 200 || resRec.status === 201, 'Customer recovery of Rs. 10,000 recorded', resRec.body);

    // Assert customer live balance is -Rs. 2,000
    const resCusts = await request(app).get('/api/customers').set('Authorization', `Bearer ${adminTokenA}`);
    const cOver = resCusts.body.find((c: any) => c.id === overpaidCust.id);
    assert(cOver && cOver.liveBalance === -2000, 'Customer live balance evaluates to -2000', cOver);

    // Assert Balance Sheet moves Rs. 2,000 into Liabilities under Customer Credit Balances
    const resBSOver = await request(app).get('/api/reports/balance-sheet').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resBSOver.body.liabilities.customerOverpayments === 2000, 'Balance sheet reports Rs. 2,000 under Liabilities (Customer Credit Balances)', resBSOver.body);

    // =======================================================================
    // MODULE 7: Granular Employee Permissions (RBAC)
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 7: Granular Employee Permissions (RBAC)');
    console.log('--------------------------------------------------------------------');

    const empStaff = await prisma.employeeRec.create({
      data: {
        name: 'Staff Employee',
        username: 'staff_user',
        role: 'EMPLOYEE',
        companyId: compA.id
      }
    });

    // Grant POS access but pos:edit = false / allow-bill-editing = false
    await prisma.userPermission.createMany({
      data: [
        { employeeRecId: empStaff.id, pageRoute: 'pos', isAllowed: true },
        { employeeRecId: empStaff.id, pageRoute: 'allow-bill-editing', isAllowed: false },
        { employeeRecId: empStaff.id, pageRoute: 'customer:edit', isAllowed: false }
      ]
    });

    const staffTokenNoEdit = jwt.sign(
      { id: empStaff.id, username: empStaff.username, role: 'EMPLOYEE', isAdmin: false, companyId: compA.id },
      jwtSecret
    );

    // Attempting bill update should be rejected with 403 Forbidden
    const resNoPermEdit = await request(app)
      .put(`/api/sales/${targetSaleId}`)
      .set('Authorization', `Bearer ${staffTokenNoEdit}`)
      .send({ total: 150 });
    assert(resNoPermEdit.status === 403, 'Sale edit rejected with 403 Forbidden when allow-bill-editing is false', resNoPermEdit.body);

    // Enable allow-bill-editing = true
    await prisma.userPermission.updateMany({
      where: { employeeRecId: empStaff.id, pageRoute: 'allow-bill-editing' },
      data: { isAllowed: true }
    });

    const staffTokenWithEdit = jwt.sign(
      { id: empStaff.id, username: empStaff.username, role: 'EMPLOYEE', isAdmin: false, companyId: compA.id },
      jwtSecret
    );

    const resPermEditSuccess = await request(app)
      .put(`/api/sales/${targetSaleId}`)
      .set('Authorization', `Bearer ${staffTokenWithEdit}`)
      .send({
        customerId: returnCust.id,
        total: 200,
        items: [{ productId: returnProd.id, qty: 2, price: 100, netAmount: 200 }]
      });
    assert(resPermEditSuccess.status === 200, 'Sale edit permitted with 200 OK when allow-bill-editing is true', resPermEditSuccess.body);

    // Unchecking edit sub-permissions for Customer page rejects edit with 403 Forbidden
    const resCustEditNoPerm = await request(app)
      .put(`/api/customers/${returnCust.id}`)
      .set('Authorization', `Bearer ${staffTokenNoEdit}`)
      .send({ custName: 'Unauthorized Edit' });
    assert(resCustEditNoPerm.status === 403, 'Customer edit rejected with 403 Forbidden when customer:edit sub-permission is false', resCustEditNoPerm.body);

    // =======================================================================
    // MODULE 8: Accounting Equation Reconciliation
    // =======================================================================
    console.log('\n--------------------------------------------------------------------');
    console.log('MODULE 8: Accounting Equation Reconciliation');
    console.log('--------------------------------------------------------------------');

    const resBSFinal = await request(app).get('/api/reports/balance-sheet').set('Authorization', `Bearer ${adminTokenA}`);
    assert(resBSFinal.status === 200, 'Fetched final Balance Sheet', resBSFinal.body);

    const totalAssets = resBSFinal.body.assets.totalAssets;
    const totalLiabilities = resBSFinal.body.liabilities.totalLiabilities;
    const totalEquity = resBSFinal.body.equity.totalEquity;

    const calculatedLiabilitiesAndEquity = totalLiabilities + totalEquity;

    console.log(`   - Total Assets: Rs. ${totalAssets.toLocaleString()}`);
    console.log(`   - Total Liabilities: Rs. ${totalLiabilities.toLocaleString()}`);
    console.log(`   - Total Equity: Rs. ${totalEquity.toLocaleString()}`);
    console.log(`   - Total Liabilities & Equity: Rs. ${calculatedLiabilitiesAndEquity.toLocaleString()}`);

    assert(Math.abs(totalAssets - calculatedLiabilitiesAndEquity) < 0.01, 'Accounting Equation Holds True: Assets = Liabilities + Equity');

    console.log('\n====================================================================');
    console.log('       ALL 8 MODULES PASSED WITH 100% SUCCESS! (0 FAILURES)');
    console.log('====================================================================\n');
  } catch (error: any) {
    console.error('\n❌ MASTER PRODUCTION TEST SUITE FAILED:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMasterProductionTest();
