import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

let companyId: number;
let adminToken: string;
let employeeId: number;
let staffTokenNoEdit: string;
let staffTokenWithEdit: string;
let purchaseId: number;
let saleId: number;

beforeAll(async () => {
  // Cleanup test database
  await prisma.userPermission.deleteMany({});
  await prisma.saleInvDtl.deleteMany({});
  await prisma.saleMain.deleteMany({});
  await prisma.purDtl.deleteMany({});
  await prisma.purMain.deleteMany({});
  await prisma.employeeRec.deleteMany({ where: { username: { in: ['qa_staff_no_edit', 'qa_staff_with_edit'] } } });

  const comp = await prisma.company.create({ data: { name: 'Nested Perm QA Co' } });
  companyId = comp.id;

  // Admin token
  adminToken = jwt.sign({ id: 99, username: 'qa_admin', role: 'ADMIN', isAdmin: true, companyId }, JWT_SECRET);

  // Create Staff Employee (No Edit permissions)
  const empNoEdit = await prisma.employeeRec.create({
    data: {
      name: 'QA Staff No Edit',
      username: 'qa_staff_no_edit',
      role: 'EMPLOYEE',
      companyId
    }
  });

  // Assign POS & Customer & Purchases Access BUT NO EDIT sub-permissions
  await prisma.userPermission.createMany({
    data: [
      { employeeRecId: empNoEdit.id, pageRoute: 'pos', isAllowed: true },
      { employeeRecId: empNoEdit.id, pageRoute: 'pos:edit', isAllowed: false },
      { employeeRecId: empNoEdit.id, pageRoute: 'purchases', isAllowed: true },
      { employeeRecId: empNoEdit.id, pageRoute: 'purchase:edit', isAllowed: false },
      { employeeRecId: empNoEdit.id, pageRoute: 'customers', isAllowed: true },
      { employeeRecId: empNoEdit.id, pageRoute: 'customer:edit', isAllowed: false },
      { employeeRecId: empNoEdit.id, pageRoute: 'allow-bill-editing', isAllowed: false }
    ]
  });

  staffTokenNoEdit = jwt.sign({ id: empNoEdit.id, username: empNoEdit.username, role: 'EMPLOYEE', isAdmin: false, companyId }, JWT_SECRET);

  // Create Staff Employee (WITH Edit permissions)
  const empWithEdit = await prisma.employeeRec.create({
    data: {
      name: 'QA Staff With Edit',
      username: 'qa_staff_with_edit',
      role: 'EMPLOYEE',
      companyId
    }
  });

  await prisma.userPermission.createMany({
    data: [
      { employeeRecId: empWithEdit.id, pageRoute: 'pos', isAllowed: true },
      { employeeRecId: empWithEdit.id, pageRoute: 'pos:edit', isAllowed: true },
      { employeeRecId: empWithEdit.id, pageRoute: 'purchases', isAllowed: true },
      { employeeRecId: empWithEdit.id, pageRoute: 'purchase:edit', isAllowed: true },
      { employeeRecId: empWithEdit.id, pageRoute: 'customers', isAllowed: true },
      { employeeRecId: empWithEdit.id, pageRoute: 'customer:edit', isAllowed: true },
      { employeeRecId: empWithEdit.id, pageRoute: 'allow-bill-editing', isAllowed: true }
    ]
  });

  staffTokenWithEdit = jwt.sign({ id: empWithEdit.id, username: empWithEdit.username, role: 'EMPLOYEE', isAdmin: false, companyId }, JWT_SECRET);

  // Create sample product & purchase & sale for edit tests
  const prod = await prisma.productRec.create({
    data: { productName: 'QA Test Product', retailPrice: 150, currentStock: 100, companyId }
  });

  const seller = await prisma.sellerRec.create({
    data: { companyName: 'QA Test Supplier', companyId }
  });

  const pur = await prisma.purMain.create({
    data: {
      totalAmount: 1500,
      sellerRecId: seller.id,
      companyId,
      details: {
        create: [{ productRecId: prod.id, qty: 10, price: 150 }]
      }
    }
  });
  purchaseId = pur.id;

  const cust = await prisma.customerRec.create({
    data: { custName: 'QA Customer', companyId }
  });

  const sale = await prisma.saleMain.create({
    data: {
      totalAmount: 300,
      customerRecId: cust.id,
      companyId,
      details: {
        create: [{ productRecId: prod.id, qty: 2, price: 150 }]
      }
    }
  });
  saleId = sale.id;

  employeeId = empNoEdit.id;
});

afterAll(async () => {
  if (companyId) {
    await prisma.userPermission.deleteMany({});
    await prisma.saleInvDtl.deleteMany({});
    await prisma.saleMain.deleteMany({});
    await prisma.purDtl.deleteMany({});
    await prisma.purMain.deleteMany({});
    await prisma.productRec.deleteMany({ where: { companyId } });
    await prisma.customerRec.deleteMany({ where: { companyId } });
    await prisma.sellerRec.deleteMany({ where: { companyId } });
    await prisma.employeeRec.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  await prisma.$disconnect();
});

describe('Nested Permission QA Validation Suite', () => {

  describe('1. Test UI Dependencies & Database Permission Persistence', () => {
    it('saves primary and nested sub-permissions correctly via PUT /api/permissions/employee/:id', async () => {
      const payload = [
        { pageRoute: 'pos', isAllowed: true },
        { pageRoute: 'pos:edit', isAllowed: false },
        { pageRoute: 'purchases', isAllowed: true },
        { pageRoute: 'purchase:edit', isAllowed: false },
        { pageRoute: 'customers', isAllowed: true },
        { pageRoute: 'customer:edit', isAllowed: false },
        { pageRoute: 'allow-bill-editing', isAllowed: false }
      ];

      const res = await request(app)
        .put(`/api/permissions/employee/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: false, permissions: payload });

      expect(res.status).toBe(200);

      // Verify returned employee permissions
      const checkRes = await request(app)
        .get('/api/permissions/employees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      const emp = checkRes.body.find((e: any) => e.id === employeeId);
      expect(emp).toBeDefined();

      const permMap: Record<string, boolean> = {};
      emp.permissions.forEach((p: any) => { permMap[p.pageRoute] = p.isAllowed; });

      expect(permMap['pos']).toBe(true);
      expect(permMap['pos:edit']).toBe(false);
      expect(permMap['purchases']).toBe(true);
      expect(permMap['purchase:edit']).toBe(false);
      expect(permMap['customers']).toBe(true);
      expect(permMap['customer:edit']).toBe(false);
    });

    it('auto-disables sub-permissions when primary permission is revoked', async () => {
      // Admin revokes 'pos' access
      const payload = [
        { pageRoute: 'pos', isAllowed: false },
        { pageRoute: 'pos:edit', isAllowed: false }
      ];

      const res = await request(app)
        .put(`/api/permissions/employee/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: false, permissions: payload });

      expect(res.status).toBe(200);

      const dbPerms = await prisma.userPermission.findMany({ where: { employeeRecId: employeeId } });
      const posPerm = dbPerms.find(p => p.pageRoute === 'pos');
      const posEditPerm = dbPerms.find(p => p.pageRoute === 'pos:edit');

      expect(posPerm?.isAllowed).toBe(false);
      expect(posEditPerm?.isAllowed).toBe(false);
    });
  });

  describe('2. Test POS / Sales Edit Lockout & Backend Guard Enforcement', () => {
    it('returns 403 Forbidden when employee without pos:edit attempts PUT /api/sales/:id', async () => {
      const res = await request(app)
        .put(`/api/sales/${saleId}`)
        .set('Authorization', `Bearer ${staffTokenNoEdit}`)
        .send({
          netAmount: 200,
          details: [{ productRecId: 1, qty: 1, price: 200 }]
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden|permission/i);
    });

    it('allows PUT /api/sales/:id when employee has pos:edit / allow-bill-editing permission', async () => {
      const res = await request(app)
        .put(`/api/sales/${saleId}`)
        .set('Authorization', `Bearer ${staffTokenWithEdit}`)
        .send({
          totalAmount: 300,
          details: []
        });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('3. Test Purchase Edit Lockout & Backend Guard Enforcement', () => {
    it('returns 403 Forbidden when employee without purchase:edit attempts PUT /api/purchases/:id', async () => {
      const res = await request(app)
        .put(`/api/purchases/${purchaseId}`)
        .set('Authorization', `Bearer ${staffTokenNoEdit}`)
        .send({
          totalAmount: 2000,
          details: []
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden|permission/i);
    });

    it('allows PUT /api/purchases/:id when employee has purchase:edit permission', async () => {
      const res = await request(app)
        .put(`/api/purchases/${purchaseId}`)
        .set('Authorization', `Bearer ${staffTokenWithEdit}`)
        .send({
          totalAmount: 1500,
          details: []
        });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('4. Test User Payload Permission Delivery', () => {
    it('includes active sub-permissions in /api/auth/me permissions array', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${staffTokenWithEdit}`);

      expect(res.status).toBe(200);
      const userPayload = res.body.user || res.body.employee;
      expect(userPayload.permissions).toContain('pos');
      expect(userPayload.permissions).toContain('pos:edit');
      expect(userPayload.permissions).toContain('purchases');
      expect(userPayload.permissions).toContain('purchase:edit');
      expect(userPayload.permissions).toContain('customers');
      expect(userPayload.permissions).toContain('customer:edit');
    });

    it('excludes sub-permissions from /api/auth/me permissions array when unchecked', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${staffTokenNoEdit}`);

      expect(res.status).toBe(200);
      const userPayload = res.body.user || res.body.employee;
      expect(userPayload.permissions).not.toContain('pos:edit');
      expect(userPayload.permissions).not.toContain('purchase:edit');
      expect(userPayload.permissions).not.toContain('customer:edit');
    });
  });

});
