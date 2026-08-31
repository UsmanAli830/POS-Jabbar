import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

let adminToken: string;

beforeAll(async () => {
  // Clear tables in proper FK order
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
  await prisma.finHead.deleteMany({});
  await prisma.pCat.deleteMany({});
  
  let emp = await prisma.employeeRec.findFirst();
  if (!emp) {
    emp = await prisma.employeeRec.create({
      data: { name: 'Golden Salesman', baseSalary: 50000 }
    });
  }
  adminToken = jwt.sign({ id: emp.id, username: 'admin', role: 'SUPER_ADMIN' }, JWT_SECRET);

  let revGroup = await prisma.finHeadMainGroup.findFirst({ where: { name: 'Revenue' } });
  if (!revGroup) revGroup = await prisma.finHeadMainGroup.create({ data: { name: 'Revenue' } });
  
  let assetGroup = await prisma.finHeadMainGroup.findFirst({ where: { name: 'Assets' } });
  if (!assetGroup) assetGroup = await prisma.finHeadMainGroup.create({ data: { name: 'Assets' } });
  
  let revHead = await prisma.finHead.findFirst({ where: { name: 'Sales Revenue' } });
  if (!revHead) await prisma.finHead.create({ data: { name: 'Sales Revenue', finHeadMainGroupId: revGroup.id } });
  
  let cashHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } });
  if (!cashHead) await prisma.finHead.create({ data: { name: 'Cash in Till', finHeadMainGroupId: assetGroup.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Golden Path Ledger Sync', () => {
  let customerId: number;
  let productId: number;
  let categoryId: number;

  it('1. Creates a CustomerRec with OpeningBalance = $0', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        custName: 'Golden Path Customer',
        openingBalance: 0
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    customerId = res.body.id;
  });

  it('2. Creates a ProductRec with CurrentStock = 100, Price = $10', async () => {
    const cat = await prisma.pCat.create({ data: { name: 'Golden Category' } });
    categoryId = cat.id;

    const prod = await prisma.productRec.create({
      data: {
        productName: 'Golden Product',
        pCatId: categoryId,
        currentStock: 100,
        retailPrice: 10
      }
    });
    expect(prod.id).toBeDefined();
    productId = prod.id;
  });

  it('3. Hits POST /api/sales to sell 5 units on credit', async () => {
    // We must ensure core FinHeads exist for the sale route
    const revHead = await prisma.finHead.findFirst({ where: { name: 'Sales Revenue' } });
    if (!revHead) await prisma.finHead.create({ data: { name: 'Sales Revenue' } });
    
    const cashHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } });
    if (!cashHead) await prisma.finHead.create({ data: { name: 'Cash in Till' } });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customerId,
        items: [
          { productId: productId, quantity: 5, unitPrice: 10 }
        ],
        paymentMethod: 'Credit / Unpaid',
        subtotal: 50,
        total: 50
      });
    
    expect(res.status).toBe(201);
  });

  it('4. Asserts ProductRec.CurrentStock is exactly 95', async () => {
    const prod = await prisma.productRec.findUnique({ where: { id: productId } });
    expect(prod?.currentStock).toBe(95);
  });

  it('5. Asserts the Customer live balance is exactly $50 and CashFlowDTL entry was created', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const customer = res.body.find((c: any) => c.id === customerId);
    expect(customer).toBeDefined();
    expect(customer.liveBalance).toBe(50);

    // Verify CashFlowDTL exists for this customer
    const dtls = await prisma.cashFlowDTL.findMany({
      where: { finHeadId: customer.finHead.id }
    });
    expect(dtls.length).toBeGreaterThan(0);
    // Customer AR is an asset. A credit sale debits AR (increases balance).
    const debitEntry = dtls.find(d => d.transactionType === 'DR' && d.amount === 50);
    expect(debitEntry).toBeDefined();
  });

  it('6. Hits POST /api/payments/receive to log a $50 cash payment', async () => {
    const res = await request(app)
      .post('/api/payments/receive')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customerId,
        amount: 50,
        remarks: 'Golden Path Payment'
      });
    expect(res.status).toBe(201);
  });

  it('7. Asserts the Customer live balance is exactly $0', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const customer = res.body.find((c: any) => c.id === customerId);
    expect(customer).toBeDefined();
    expect(customer.liveBalance).toBe(0);
  });
});
