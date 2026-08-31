import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

let adminToken: string;
let companyId: number;

beforeAll(async () => {
  await prisma.cashFlowDTL.deleteMany({});
  await prisma.cashFlowMAIN.deleteMany({});
  await prisma.recovery.deleteMany({});
  await prisma.manualSaleRtnDtl.deleteMany({});
  await prisma.manualSaleRtnMain.deleteMany({});
  await prisma.purRtnDtl.deleteMany({});
  await prisma.purRtnMain.deleteMany({});
  await prisma.saleInvDtl.deleteMany({});
  await prisma.purDtl.deleteMany({});
  await prisma.damagedStock.deleteMany({});
  await prisma.saleMain.deleteMany({});
  await prisma.purMain.deleteMany({});
  await prisma.productRec.deleteMany({});
  await prisma.customerRec.deleteMany({});
  await prisma.sellerRec.deleteMany({});

  const comp = await prisma.company.create({ data: { name: 'Feature Testing Co' } });
  companyId = comp.id;
  adminToken = jwt.sign({ id: 10, username: 'test_admin', role: 'ADMIN', isAdmin: true, companyId }, JWT_SECRET);
});

afterAll(async () => {
  if (companyId) {
    await prisma.cashFlowDTL.deleteMany({});
    await prisma.cashFlowMAIN.deleteMany({});
    await prisma.manualSaleRtnDtl.deleteMany({});
    await prisma.manualSaleRtnMain.deleteMany({});
    await prisma.purRtnDtl.deleteMany({});
    await prisma.purRtnMain.deleteMany({});
    await prisma.damagedStock.deleteMany({});
    await prisma.saleInvDtl.deleteMany({});
    await prisma.purDtl.deleteMany({});
    await prisma.saleMain.deleteMany({});
    await prisma.purMain.deleteMany({});
    await prisma.productRec.deleteMany({});
    await prisma.customerRec.deleteMany({});
    await prisma.sellerRec.deleteMany({});
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  await prisma.$disconnect();
});

describe('New Requirements Validation', () => {
  describe('1. Reusable Sequential Codes (Gap Filling)', () => {
    it('returns lowest missing integer when gaps exist', async () => {
      // Clear any existing products for this company
      await prisma.productRec.deleteMany({ where: { companyId } });

      // Create products with codes 2, 3, 4 (gap at 1)
      await prisma.productRec.create({ data: { productName: 'Prod 2', productCode: '2', retailPrice: 100, companyId } });
      await prisma.productRec.create({ data: { productName: 'Prod 3', productCode: '3', retailPrice: 100, companyId } });
      await prisma.productRec.create({ data: { productName: 'Prod 4', productCode: '4', retailPrice: 100, companyId } });

      const res = await request(app)
        .get('/api/products/next-code')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.nextCode).toBe('1');
    });

    it('returns 1 for next customer code when no customers exist', async () => {
      await prisma.customerRec.deleteMany({ where: { companyId } });

      const res = await request(app)
        .get('/api/customers/next-code')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.nextCode).toBe('1');
    });
  });

  describe('2. Customer Overpayments & Balance Sheet Liabilities', () => {
    it('excludes overpaid customers from AR and reports under Customer Credit Balances', async () => {
      await prisma.customerRec.deleteMany({ where: { companyId } });

      // Customer 1: Positive balance (AR Asset = 500)
      await prisma.customerRec.create({ data: { custName: 'Debtor Cust', openingBalance: 500, companyId } });
      // Customer 2: Overpaid balance (Credit Balance Liability = 200)
      await prisma.customerRec.create({ data: { custName: 'Overpaid Cust', openingBalance: -200, companyId } });

      const res = await request(app)
        .get('/api/reports/balance-sheet')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.accountsReceivable).toBe(500);
      expect(res.body.liabilities.customerOverpayments).toBe(200);
    });
  });

  describe('3. In-Place Invoice Editing on Returns', () => {
    it('edits original sale invoice line items, totals, and updatedAt directly', async () => {
      const prod = await prisma.productRec.create({
        data: { productName: 'Return Test Prod', productCode: '99', retailPrice: 100, costPrice: 50, currentStock: 20, companyId }
      });

      const sale = await prisma.saleMain.create({
        data: {
          grossAmount: 200,
          discountAmount: 0,
          totalAmount: 200,
          companyId,
          details: {
            create: [
              { productRecId: prod.id, qty: 2, price: 100, grossAmount: 200, netAmount: 200 }
            ]
          }
        },
        include: { details: true }
      });

      const oldUpdatedAt = sale.updatedAt;

      // Process a return of 1 unit
      const returnRes = await request(app)
        .post('/api/returns/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          saleMainId: sale.id,
          items: [
            { productRecId: prod.id, qty: 1, price: 100 }
          ]
        });

      expect([200, 201]).toContain(returnRes.status);

      // Verify original sale was modified in-place
      const updatedSale = await prisma.saleMain.findUnique({
        where: { id: sale.id },
        include: { details: true }
      });

      expect(updatedSale).not.toBeNull();
      expect(updatedSale?.totalAmount).toBe(100);
      expect(updatedSale?.grossAmount).toBe(100);
      expect(updatedSale?.details.length).toBe(1);
      expect(updatedSale?.details[0].qty).toBe(1);
      expect(new Date(updatedSale!.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(oldUpdatedAt).getTime());
    });
  });
});
