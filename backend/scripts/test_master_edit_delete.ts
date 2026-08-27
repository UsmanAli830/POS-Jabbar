import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEditDelete() {
  console.log('--- Testing Master Data safe delete & edit ---');
  
  // 1. Check products linked to PType 22
  const linked = await prisma.productRec.count({ where: { pTypeId: 22 } });
  console.log(`Products linked to PType 22 before delete: ${linked}`);

  // 2. Unlink & delete PType 22
  await prisma.productRec.updateMany({ where: { pTypeId: 22 }, data: { pTypeId: null } });
  const deleted = await prisma.pType.delete({ where: { id: 22 } });
  console.log('Successfully deleted PType 22:', deleted);

  const remainingLinked = await prisma.productRec.count({ where: { pTypeId: 22 } });
  console.log(`Products linked to PType 22 after delete: ${remainingLinked}`);

  // 3. Test Editing PType 23
  const updated = await prisma.pType.update({
    where: { id: 23 },
    data: { name: 'Luxury Fittings (Renamed)' }
  });
  console.log('Successfully updated PType 23:', updated);
}

testEditDelete().finally(() => prisma.$disconnect());
