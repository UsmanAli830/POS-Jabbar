import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

async function runFinalQA() {
  console.log('=====================================================');
  console.log('🚀 STARTING FINAL SYSTEM-WIDE QA & LOGIC VERIFICATION');
  console.log('=====================================================\n');

  try {
    // Cleanup prior test records
    await prisma.transactionHistoryLog.deleteMany({});
    await prisma.cashFlowDTL.deleteMany({});
    await prisma.cashFlowMAIN.deleteMany({});
    await prisma.recovery.deleteMany({});
    await prisma.saleInvDtl.deleteMany({});
    await prisma.saleMain.deleteMany({});
    await prisma.purDtl.deleteMany({});
    await prisma.purMain.deleteMany({});
    await prisma.userPermission.deleteMany({});
    await prisma.productRec.deleteMany({ where: { productName: { in: ['Script QA Product A', 'Script QA Product B'] } } });
    await prisma.customerRec.deleteMany({ where: { custName: { in: ['Script QA Customer C'] } } });
    await prisma.employeeRec.deleteMany({ where: { username: { in: ['script_no_edit_emp', 'script_with_edit_emp', 'script_no_cust_edit_emp'] } } });
    await prisma.company.deleteMany({ where: { name: { in: ['Script QA Company A', 'Script QA Company B'] } } });

    // 1. Create Companies
    const compA = await prisma.company.create({ data: { name: 'Script QA Company A' } });
    const compB = await prisma.company.create({ data: { name: 'Script QA Company B' } });

    const tokenCompA = jwt.sign({ id: 9101, username: 'admin_compa', role: 'ADMIN', isAdmin: true, companyId: compA.id }, JWT_SECRET);
    const tokenCompB = jwt.sign({ id: 9102, username: 'admin_compb', role: 'ADMIN', isAdmin: true, companyId: compB.id }, JWT_SECRET);

    // 2. Create Test Product for Company A
    const prodA = await prisma.productRec.create({
      data: {
        productCode: 'PROD-SCRIPT-A',
        barCode: '1122334455',
        productName: 'Script QA Product A',
        retailPrice: 100,
        costPrice: 60,
        currentStock: 100,
        companyId: compA.id
      }
    });

    console.log('✔ Phase 1: Test Environment Setup Complete.');

    // -----------------------------------------------------------------
    // TEST GROUP A: Tenant-Scoped Invoice Sequencing
    // -----------------------------------------------------------------
    console.log('\n--- Test Case Group A: Tenant-Scoped Invoice Sequencing ---');
    
    // Company A - Sale 1
    const resA1 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenCompA}`)
      .send({
        items: [{ productId: prodA.id, quantity: 2, unitPrice: 100 }],
        paymentMethod: 'Cash',
        paymentReceived: 200
      });
    if (resA1.body.invoiceNumber !== 'INV-1') throw new Error(`Expected INV-1 for Company A Sale 1, got ${resA1.body.invoiceNumber}`);
    console.log('  PASS: Company A Sale 1 assigned INV-1 cleanly.');

    // Company A - Sale 2
    const resA2 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenCompA}`)
      .send({
        items: [{ productId: prodA.id, quantity: 10, unitPrice: 100 }],
        paymentMethod: 'Cash',
        paymentReceived: 1000
      });
    if (resA2.body.invoiceNumber !== 'INV-2') throw new Error(`Expected INV-2 for Company A Sale 2, got ${resA2.body.invoiceNumber}`);
    console.log('  PASS: Company A Sale 2 assigned INV-2 cleanly.');

    // Company B - Sale 1
    const prodB = await prisma.productRec.create({
      data: {
        productCode: 'PROD-SCRIPT-B',
        barCode: '9988776655',
        productName: 'Script QA Product B',
        retailPrice: 50,
        currentStock: 50,
        companyId: compB.id
      }
    });
    const resB1 = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenCompB}`)
      .send({
        items: [{ productId: prodB.id, quantity: 1, unitPrice: 50 }],
        paymentMethod: 'Cash',
        paymentReceived: 50
      });
    if (resB1.body.invoiceNumber !== 'INV-1') throw new Error(`Expected INV-1 for Company B Sale 1, got ${resB1.body.invoiceNumber}`);
    console.log('  PASS: Company B Sale 1 assigned INV-1 independently per company.');

    // -----------------------------------------------------------------
    // TEST GROUP B: In-Place Bill Updates & Modification Logging
    // -----------------------------------------------------------------
    console.log('\n--- Test Case Group B: In-Place Bill Updates & Modification Logging ---');
    const saleA2Id = resA2.body.id;

    // Reduce qty from 10 to 7
    const editRes = await request(app)
      .put(`/api/sales/${saleA2Id}`)
      .set('Authorization', `Bearer ${tokenCompA}`)
      .send({
        items: [{ productRecId: prodA.id, qty: 7, price: 100 }],
        subtotal: 700,
        total: 700,
        paymentMethod: 'Cash',
        paymentReceived: 700
      });

    if (editRes.status !== 200) throw new Error('In-place bill edit failed with status ' + editRes.status);
    
    // Assert DB check: count of SaleMain for CompA is still 2
    const salesCount = await prisma.saleMain.count({ where: { companyId: compA.id } });
    if (salesCount !== 2) throw new Error(`Expected 2 sales, found ${salesCount} (duplicate created)`);
    console.log('  PASS: Direct database modification verified (no duplicate invoice created).');

    // Assert product stock restored by 3 (from 88 to 91)
    const stockAfter = (await prisma.productRec.findUnique({ where: { id: prodA.id } }))?.currentStock;
    if (stockAfter !== 91) throw new Error(`Expected stock 91, got ${stockAfter}`);
    console.log('  PASS: Product stock incremented in-place by +3.');

    // Assert History Log
    const logs = await prisma.transactionHistoryLog.findMany({ where: { saleMainId: saleA2Id } });
    if (logs.length === 0) throw new Error('No TransactionHistoryLog recorded.');
    console.log(`  PASS: TransactionHistoryLog written: "${logs[0].changeDetails}".`);

    // -----------------------------------------------------------------
    // TEST GROUP C: Overpayment & Balance Sheet Accounting
    // -----------------------------------------------------------------
    console.log('\n--- Test Case Group C: Overpayment & Balance Sheet Accounting ---');
    const customerC = await prisma.customerRec.create({
      data: { custName: 'Script QA Customer C', phone: '03001234567', openingBalance: 0, companyId: compA.id }
    });

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenCompA}`)
      .send({
        customerId: customerC.id,
        items: [{ productId: prodA.id, quantity: 50, unitPrice: 100 }],
        subtotal: 5000,
        total: 5000,
        paymentMethod: 'Credit / Unpaid',
        paymentReceived: 0
      });

    await request(app)
      .post('/api/payments/receive')
      .set('Authorization', `Bearer ${tokenCompA}`)
      .send({ customerId: customerC.id, amount: 7000, remarks: 'Script Overpayment Test' });

    const balRes = await request(app)
      .get(`/api/customers/${customerC.id}/balance`)
      .set('Authorization', `Bearer ${tokenCompA}`);

    if (balRes.body.balance !== -2000) throw new Error(`Expected -2000 balance, got ${balRes.body.balance}`);
    console.log('  PASS: Customer Credit Balance computed as -Rs. 2,000.');

    const bsRes = await request(app)
      .get('/api/reports/balance-sheet')
      .set('Authorization', `Bearer ${tokenCompA}`);

    const overpayments = bsRes.body.liabilities?.customerOverpayments ?? bsRes.body.customerOverpayments;
    if (!overpayments || overpayments < 2000) throw new Error('Balance sheet did not report customer overpayments.');
    console.log(`  PASS: Balance sheet reported Customer Overpayments under Liabilities: Rs. ${overpayments.toLocaleString()}.`);

    // -----------------------------------------------------------------
    // TEST GROUP D: Nested Permissions & Dropdown Locks
    // -----------------------------------------------------------------
    console.log('\n--- Test Case Group D: Nested Permissions & Dropdown Locks ---');
    
    // Employee with NO edit permission
    const empNoEdit = await prisma.employeeRec.create({
      data: { name: 'Script Emp No Edit', username: 'script_no_edit_emp', role: 'EMPLOYEE', companyId: compA.id }
    });
    await prisma.userPermission.createMany({
      data: [
        { employeeRecId: empNoEdit.id, pageRoute: 'pos', isAllowed: true },
        { employeeRecId: empNoEdit.id, pageRoute: 'pos:edit', isAllowed: false }
      ]
    });
    const tokenNoEdit = jwt.sign({ id: empNoEdit.id, username: empNoEdit.username, role: 'EMPLOYEE', isAdmin: false, companyId: compA.id }, JWT_SECRET);

    const forbiddenRes = await request(app)
      .put(`/api/sales/${saleA2Id}`)
      .set('Authorization', `Bearer ${tokenNoEdit}`)
      .send({ items: [{ productId: prodA.id, quantity: 5, unitPrice: 100 }], total: 500 });

    if (forbiddenRes.status !== 403) throw new Error(`Expected 403 Forbidden for unauthorized edit, got ${forbiddenRes.status}`);
    console.log('  PASS: Nested permission check successfully blocked unauthorized bill edit (HTTP 403).');

    console.log('\n=====================================================');
    console.log('🎉 ALL SYSTEM-WIDE QA & LOGIC VERIFICATIONS PASSED!');
    console.log('=====================================================\n');
  } catch (err: any) {
    console.error('\n❌ FINAL QA SCRIPT FAILED:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFinalQA();
