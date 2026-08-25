import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting stock backfill...');
  const products = await prisma.product.findMany();

  for (const p of products) {
    const stockQ = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(SUM(CASE WHEN "transactionType" = 'OUT' THEN -ABS("quantity") ELSE "quantity" END), 0) as stockQty
      FROM "InventoryTransaction"
      WHERE "productId" = ${p.id}
    `;
    const qty = Number(stockQ[0]?.stockQty || 0);

    await prisma.product.update({
      where: { id: p.id },
      data: { stockQty: qty }
    });
    console.log(`Product ${p.id} updated with stock: ${qty}`);
  }
  console.log('Backfill complete!');
}

backfill()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
