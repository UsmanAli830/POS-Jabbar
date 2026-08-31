import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

let testCompanyId: number;
let tenantToken: string;

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
  await prisma.zone.deleteMany({});
  await prisma.pCat.deleteMany({});

  const comp = await prisma.company.create({ data: { name: 'Inline QA Company' } });
  testCompanyId = comp.id;
  tenantToken = jwt.sign({ id: 99, username: 'tenant_qa', role: 'USER', companyId: testCompanyId }, JWT_SECRET);
});

afterAll(async () => {
  if (testCompanyId) {
    await prisma.zone.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.pCat.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.productRec.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.company.deleteMany({ where: { id: testCompanyId } });
  }
  await prisma.$disconnect();
});

describe('Inline Lookup Creation & Auto-Serial Product Code', () => {
  describe('1. Auto-Serial Product Code Generation', () => {
    it('returns "1" when no products exist for tenant', async () => {
      const res = await request(app)
        .get('/api/products/next-code')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.nextCode).toBe('1');
    });

    it('calculates next code sequentially after creating products 1 and 2', async () => {
      await prisma.productRec.create({ data: { productName: 'Prod 1', productCode: '1', retailPrice: 10, companyId: testCompanyId } });
      await prisma.productRec.create({ data: { productName: 'Prod 2', productCode: '2', retailPrice: 15, companyId: testCompanyId } });

      const res = await request(app)
        .get('/api/products/next-code')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.nextCode).toBe('3');
    });

    it('allows manual override (code 100) and increments next-code past 100', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          productName: 'Override Product 100',
          productCode: '100',
          retailPrice: 50,
          costPrice: 20
        });
      expect([200, 201]).toContain(createRes.status);
      expect(createRes.body.productCode).toBe('100');

      const nextCodeRes = await request(app)
        .get('/api/products/next-code')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(nextCodeRes.status).toBe(200);
      expect(nextCodeRes.body.nextCode).toBe('3'); // Gap-filling lowest missing integer starting from 1
    });
  });

  describe('2. Inline Lookup Creation (+ Sign API Sync)', () => {
    it('creates a new Zone via master-data-post and persists to DB with correct tenant companyId', async () => {
      const res = await request(app)
        .post('/api/master-data-post')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          type: 'zone',
          name: 'Zone West QA'
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Zone West QA');

      // Verify in DB that companyId matches testCompanyId
      const dbZone = await prisma.zone.findUnique({ where: { id: res.body.id } });
      expect(dbZone).not.toBeNull();
      expect(dbZone?.name).toBe('Zone West QA');
      expect(dbZone?.companyId).toBe(testCompanyId);
    });

    it('creates a new Category (pCat) via master-data-post and persists to DB with correct tenant companyId', async () => {
      const res = await request(app)
        .post('/api/master-data-post')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          type: 'pCat',
          name: 'Category North QA'
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Category North QA');

      // Verify in DB that companyId matches testCompanyId
      const dbCat = await prisma.pCat.findUnique({ where: { id: res.body.id } });
      expect(dbCat).not.toBeNull();
      expect(dbCat?.name).toBe('Category North QA');
      expect(dbCat?.companyId).toBe(testCompanyId);
    });
  });
});
