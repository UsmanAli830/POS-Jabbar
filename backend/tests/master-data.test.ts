import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Clear tables
  await prisma.cashFlowDTL.deleteMany({});
  await prisma.cashFlowMAIN.deleteMany({});
  await prisma.recovery.deleteMany({});
  await prisma.saleInvDtl.deleteMany({});
  await prisma.saleMain.deleteMany({});
  await prisma.productRec.deleteMany({});
  await prisma.pCat.deleteMany({});
  await prisma.customerRec.deleteMany({});
  await prisma.finHead.deleteMany({});
  await prisma.finHeadMainGroup.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Master Data Relations', () => {
  let catId: number;

  it('should create a PCat', async () => {
    const cat = await prisma.pCat.create({
      data: {
        name: 'Test Category'
      }
    });
    expect(cat.id).toBeDefined();
    catId = cat.id;
  });

  it('should create a ProductRec with a valid Category', async () => {
    const prod = await prisma.productRec.create({
      data: {
        productName: 'Valid Product',
        pCatId: catId,
        currentStock: 10,
        retailPrice: 100
      }
    });
    expect(prod.id).toBeDefined();
    expect(prod.pCatId).toBe(catId);
  });

  it('should reject creating a ProductRec with a non-existent Category', async () => {
    await expect(
      prisma.productRec.create({
        data: {
          productName: 'Invalid Product',
          pCatId: 999999 // non-existent
        }
      })
    ).rejects.toThrow(); // Should throw a foreign key constraint error
  });
});
