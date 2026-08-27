import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPType() {
  const ptypes = await prisma.pType.findMany();
  console.log('All PTypes:', ptypes);

  const productsWithPType = await prisma.productRec.findMany({
    where: { pTypeId: { not: null } },
    select: { id: true, productName: true, pTypeId: true }
  });
  console.log('Products referencing pType:', productsWithPType);
}

testPType().finally(() => prisma.$disconnect());
