import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const sales = await prisma.sale.count();
  const txs = await prisma.customerTransaction.count();
  console.log('Sales Count:', sales);
  console.log('CustomerTransaction Count:', txs);
}
run().finally(() => prisma.$disconnect());
