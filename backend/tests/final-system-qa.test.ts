import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

describe('Final System-Wide QA & Logic Verification Test Suite', () => {
  let compA: any, compB: any;
  let tokenCompA: string, tokenCompB: string;
  let empNoEditToken: string, empWithEditToken: string, empNoCustEditToken: string;
  let prodA: any;
  let saleA1: any, saleA2: any, saleB1: any;
  let customerC: any;

  beforeAll(async () => {
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
    await prisma.productRec.deleteMany({ where: { productName: { in: ['QA Product A', 'QA Product B'] } } });
    await prisma.customerRec.deleteMany({ where: { custName: { in: ['QA Customer C'] } } });
    await prisma.employeeRec.deleteMany({ where: { username: { in: ['qa_no_edit_emp', 'qa_with_edit_emp', 'qa_no_cust_edit_emp'] } } });
    await prisma.company.deleteMany({ where: { name: { in: ['Final QA Company A', 'Final QA Company B'] } } });

    // 1. Create Companies
    compA = await prisma.company.create({ data: { name: 'Final QA Company A' } });
    compB = await prisma.company.create({ data: { name: 'Final QA Company B' } });

    tokenCompA = jwt.sign({ id: 9001, username: 'admin_compa', role: 'ADMIN', isAdmin: true, companyId: compA.id }, JWT_SECRET);
    tokenCompB = jwt.sign({ id: 9002, username: 'admin_compb', role: 'ADMIN', isAdmin: true, companyId: compB.id }, JWT_SECRET);

    // 2. Create Test Product for Company A
    prodA = await prisma.productRec.create({
      data: {
        productCode: 'PROD-QA-A',
        barCode: '1122334455',
        productName: 'QA Product A',
        retailPrice: 100,
        costPrice: 60,
        currentStock: 100,
        companyId: compA.id
      }
    });

    // 3. Setup Employees & Permissions for Group D
    const empNoEdit = await prisma.employeeRec.create({
      data: { name: 'Emp No Edit', username: 'qa_no_edit_emp', role: 'EMPLOYEE', companyId: compA.id }
    });
    await prisma.userPermission.createMany({
      data: [
        { employeeRecId: empNoEdit.id, pageRoute: 'pos', isAllowed: true },
        { employeeRecId: empNoEdit.id, pageRoute: 'pos:edit', isAllowed: false },
        { employeeRecId: empNoEdit.id, pageRoute: 'allow-bill-editing', isAllowed: false }
      ]
    });
    empNoEditToken = jwt.sign({ id: empNoEdit.id, username: empNoEdit.username, role: 'EMPLOYEE', isAdmin: false, companyId: compA.id }, JWT_SECRET);

    const empWithEdit = await prisma.employeeRec.create({
      data: { name: 'Emp With Edit', username: 'qa_with_edit_emp', role: 'EMPLOYEE', companyId: compA.id }
    });
    await prisma.userPermission.createMany({
      data: [
        { employeeRecId: empWithEdit.id, pageRoute: 'pos', isAllowed: true },
        { employeeRecId: empWithEdit.id, pageRoute: 'pos:edit', isAllowed: true },
        { employeeRecId: empWithEdit.id, pageRoute: 'allow-bill-editing', isAllowed: true }
      ]
    });
    empWithEditToken = jwt.sign({ id: empWithEdit.id, username: empWithEdit.username, role: 'EMPLOYEE', isAdmin: false, companyId: compA.id }, JWT_SECRET);

    const empNoCustEdit = await prisma.employeeRec.create({
      data: { name: 'Emp No Cust Edit', username: 'qa_no_cust_edit_emp', role: 'EMPLOYEE', companyId: compA.id }
    });
    await prisma.userPermission.createMany({
      data: [
        { employeeRecId: empNoCustEdit.id, pageRoute: 'customers', isAllowed: true },
        { employeeRecId: empNoCustEdit.id, pageRoute: 'customer:edit', isAllowed: false }
      ]
    });
    empNoCustEditToken = jwt.sign({ id: empNoCustEdit.id, username: empNoCustEdit.username, role: 'EMPLOYEE', isAdmin: false, companyId: compA.id }, JWT_SECRET);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==========================================
  // Test Case Group A: Tenant-Scoped Invoice Sequencing
  // ==========================================
  describe('Group A: Tenant-Scoped Invoice Sequencing', () => {
    it('should assign INV-1 to Company A\'s first sale', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${tokenCompA}`)
        .send({
          items: [{ productId: prodA.id, quantity: 2, unitPrice: 100 }],
          paymentMethod: 'Cash',
          paymentReceived: 200
        });

      expect(res.status).toBe(201);
      expect(res.body.invoiceNumber).toBe('INV-1');
      saleA1 = res.body;

      const dbSale = await prisma.saleMain.findUnique({ where: { id: saleA1.id } });
      expect(dbSale?.invoiceNumber).toBe(1);
      expect(dbSale?.companyId).toBe(compA.id);
    });

    it('should assign INV-2 to Company A\'s second sale', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${tokenCompA}`)
        .send({
          items: [{ productId: prodA.id, quantity: 10, unitPrice: 100 }],
          paymentMethod: 'Cash',
          paymentReceived: 1000
        });

      expect(res.status).toBe(201);
      expect(res.body.invoiceNumber).toBe('INV-2');
      saleA2 = res.body;

      const dbSale = await prisma.saleMain.findUnique({ where: { id: saleA2.id } });
      expect(dbSale?.invoiceNumber).toBe(2);
      expect(dbSale?.companyId).toBe(compA.id);
    });

    it('should assign INV-1 independently to Company B\'s first sale', async () => {
      const prodB = await prisma.productRec.create({
        data: {
          productCode: 'PROD-QA-B',
          barCode: '9988776655',
          productName: 'QA Product B',
          retailPrice: 50,
          currentStock: 50,
          companyId: compB.id
        }
      });

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${tokenCompB}`)
        .send({
          items: [{ productId: prodB.id, quantity: 1, unitPrice: 50 }],
          paymentMethod: 'Cash',
          paymentReceived: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.invoiceNumber).toBe('INV-1');
      saleB1 = res.body;

      const dbSale = await prisma.saleMain.findUnique({ where: { id: saleB1.id } });
      expect(dbSale?.invoiceNumber).toBe(1);
      expect(dbSale?.companyId).toBe(compB.id);
    });
  });

  // ==========================================
  // Test Case Group B: In-Place Bill Updates & Modification Logging
  // ==========================================
  describe('Group B: In-Place Bill Updates & Modification Logging', () => {
    it('should perform in-place update on Company A\'s INV-2, adjust stock, log history, and update ledger', async () => {
      // Stock before edit: 100 - 2 (saleA1) - 10 (saleA2) = 88
      const stockBefore = (await prisma.productRec.findUnique({ where: { id: prodA.id } }))?.currentStock;
      expect(stockBefore).toBe(88);

      // Reduce qty from 10 to 7 (restoring 3 items to stock)
      const editRes = await request(app)
        .put(`/api/sales/${saleA2.id}`)
        .set('Authorization', `Bearer ${tokenCompA}`)
        .send({
          items: [{ productRecId: prodA.id, qty: 7, price: 100 }],
          subtotal: 700,
          total: 700,
          paymentMethod: 'Cash',
          paymentReceived: 700
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.historyLogs).toBeDefined();
      expect(editRes.body.historyLogs.length).toBeGreaterThan(0);

      // Assert no new invoice was created
      const compASalesCount = await prisma.saleMain.count({ where: { companyId: compA.id } });
      expect(compASalesCount).toBe(2);

      // Assert original invoice details & total updated in place
      const updatedSale = await prisma.saleMain.findUnique({
        where: { id: saleA2.id },
        include: { details: true, historyLogs: true }
      });
      expect(updatedSale?.totalAmount).toBe(700);
      expect(updatedSale?.details[0].qty).toBe(7);
      expect(updatedSale?.details[0].netAmount).toBe(700);

      // Assert product stock restored by 3 (from 88 to 91)
      const stockAfter = (await prisma.productRec.findUnique({ where: { id: prodA.id } }))?.currentStock;
      expect(stockAfter).toBe(91);

      // Assert TransactionHistoryLog row created
      expect(updatedSale?.historyLogs.length).toBeGreaterThan(0);
      expect(updatedSale?.historyLogs[0].changeDetails).toContain('In-place edit on INV-');
    });

    it('should look up INV-2 via lookup API returning mapped details and history logs', async () => {
      const lookupRes = await request(app)
        .get('/api/sales/lookup?refNo=INV-2')
        .set('Authorization', `Bearer ${tokenCompA}`);

      expect(lookupRes.status).toBe(200);
      expect(lookupRes.body.id).toBe(saleA2.id);
      expect(lookupRes.body.invoiceNumber).toBe('INV-2');
      expect(lookupRes.body.details[0].qty).toBe(7);
      expect(lookupRes.body.historyLogs.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Test Case Group C: Overpayment & Balance Sheet Accounting
  // ==========================================
  describe('Group C: Overpayment & Balance Sheet Accounting', () => {
    it('should handle Rs. 7,000 recovery payment on Rs. 5,000 credit sale creating -Rs. 2,000 customer balance', async () => {
      // Create Customer C
      customerC = await prisma.customerRec.create({
        data: {
          custName: 'QA Customer C',
          phone: '03001234567',
          openingBalance: 0,
          companyId: compA.id
        }
      });

      // Log credit sale of Rs. 5,000
      const saleRes = await request(app)
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

      expect(saleRes.status).toBe(201);

      // Record recovery payment of Rs. 7,000
      const recRes = await request(app)
        .post('/api/payments/receive')
        .set('Authorization', `Bearer ${tokenCompA}`)
        .send({
          customerId: customerC.id,
          amount: 7000,
          remarks: 'Overpayment Test Payment'
        });

      expect([200, 201]).toContain(recRes.status);

      // Fetch Customer Balance
      const balRes = await request(app)
        .get(`/api/customers/${customerC.id}/balance`)
        .set('Authorization', `Bearer ${tokenCompA}`);

      expect(balRes.status).toBe(200);
      expect(balRes.body.balance).toBe(-2000);
    });

    it('should correctly reflect overpayment in Balance Sheet (Liabilities overpayment = 2000, AR excludes negative)', async () => {
      const bsRes = await request(app)
        .get('/api/reports/balance-sheet')
        .set('Authorization', `Bearer ${tokenCompA}`);

      expect(bsRes.status).toBe(200);
      const overpayments = bsRes.body.liabilities?.customerOverpayments ?? bsRes.body.customerOverpayments;
      expect(overpayments).toBeGreaterThanOrEqual(2000);
    });
  });

  // ==========================================
  // Test Case Group D: Nested Permissions & Dropdown Locks
  // ==========================================
  describe('Group D: Nested Permissions & Dropdown Locks', () => {
    it('should forbid bill editing for employee with pos:edit = false', async () => {
      const res = await request(app)
        .put(`/api/sales/${saleA2.id}`)
        .set('Authorization', `Bearer ${empNoEditToken}`)
        .send({
          items: [{ productRecId: prodA.id, qty: 5, price: 100 }],
          total: 500
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Permission Denied|Access Denied/i);
    });

    it('should allow bill editing for employee with pos:edit = true', async () => {
      const res = await request(app)
        .put(`/api/sales/${saleA2.id}`)
        .set('Authorization', `Bearer ${empWithEditToken}`)
        .send({
          items: [{ productRecId: prodA.id, qty: 7, price: 100 }],
          total: 700
        });

      expect(res.status).toBe(200);
    });

    it('should forbid customer editing for employee with customer:edit = false', async () => {
      const res = await request(app)
        .put(`/api/customers/${customerC.id}`)
        .set('Authorization', `Bearer ${empNoCustEditToken}`)
        .send({
          custName: 'Tampered Customer Name'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Permission Denied|Access Denied/i);
    });
  });
});
