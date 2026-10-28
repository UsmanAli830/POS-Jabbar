/**
 * Security regression suite. Each test corresponds to a vulnerability that was
 * found and fixed during the delivery hardening pass. If any of these start
 * failing, a security fix has regressed.
 */
import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

let adminAToken: string;
let companyAId: number;
let companyBId: number;
let productAId: number;
let vendorBId: number;
let postId: number;

beforeAll(async () => {
  const tag = Date.now();
  const pw = await bcrypt.hash('Secret123!', 10);
  const post = await prisma.postRec.create({ data: { title: 'Sec Post ' + tag } });
  postId = post.id;

  const coA = await prisma.company.create({ data: { name: 'Sec Store A ' + tag } });
  const coB = await prisma.company.create({ data: { name: 'Sec Store B ' + tag } });
  companyAId = coA.id;
  companyBId = coB.id;
  const future = new Date(Date.now() + 365 * 864e5);
  await prisma.softwareLicense.create({ data: { companyId: coA.id, expiresAt: future, isLocked: false } });
  await prisma.softwareLicense.create({ data: { companyId: coB.id, expiresAt: future, isLocked: false } });

  const adminA = await prisma.employeeRec.create({
    data: { name: 'Sec A Admin', username: 'sec_a_' + tag, password: pw, role: 'ADMIN', isAdmin: true, companyId: coA.id, postRecId: post.id }
  });
  adminAToken = jwt.sign(
    { id: adminA.id, name: adminA.name, username: adminA.username, role: 'ADMIN', isAdmin: true, companyId: coA.id },
    JWT_SECRET
  );

  const prodA = await prisma.productRec.create({ data: { productName: 'Sec A Widget', currentStock: 10, companyId: coA.id } });
  productAId = prodA.id;
  const vendB = await prisma.sellerRec.create({ data: { companyName: 'Sec B Supplier', companyId: coB.id } });
  vendorBId = vendB.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Authentication gate', () => {
  it('rejects unauthenticated reads of protected resources (401)', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated store-settings overwrite (401)', async () => {
    const res = await request(app).put('/api/settings').send({ storeName: 'HACKED' });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated employee bulk delete (401)', async () => {
    const res = await request(app).delete('/api/hr/employees/bulk').send({ ids: [1] });
    expect(res.status).toBe(401);
  });
});

describe('Licence tampering requires Super Admin', () => {
  it('rejects unauthenticated licence lock (401)', async () => {
    const res = await request(app).post('/api/license/lock').send({ isLocked: true });
    expect(res.status).toBe(401);
  });

  it('rejects a store admin locking the licence (403)', async () => {
    const res = await request(app).post('/api/license/lock').set(bearer(adminAToken)).send({ isLocked: true });
    expect(res.status).toBe(403);
  });
});

describe('Privilege escalation', () => {
  it('blocks creating a staff member with the reserved username "admin" (400)', async () => {
    const res = await request(app)
      .post('/api/hr/employees')
      .set(bearer(adminAToken))
      .send({ name: 'x', postRecId: postId, username: 'admin', password: 'Secret123!' });
    expect(res.status).toBe(400);
  });
});

describe('Tenant isolation', () => {
  it("blocks Store A from editing Store B's vendor (404)", async () => {
    const res = await request(app)
      .put(`/api/vendors/${vendorBId}`)
      .set(bearer(adminAToken))
      .send({ companyName: 'Renamed by Store A' });
    expect(res.status).toBe(404);
    const vb = await prisma.sellerRec.findUnique({ where: { id: vendorBId } });
    expect(vb?.companyName).toBe('Sec B Supplier');
  });
});

describe('Sale input validation', () => {
  it('rejects a sale with negative quantity (400)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(bearer(adminAToken))
      .send({ items: [{ productId: productAId, quantity: -5, unitPrice: 10 }], paymentMethod: 'Cash', total: -50 });
    expect(res.status).toBe(400);
  });

  it('rejects overselling beyond available stock (400)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(bearer(adminAToken))
      .send({ items: [{ productId: productAId, quantity: 1000, unitPrice: 1 }], paymentMethod: 'Cash', total: 1000 });
    expect(res.status).toBe(400);
    const prod = await prisma.productRec.findUnique({ where: { id: productAId } });
    expect(prod?.currentStock).toBe(10); // unchanged
  });
});
