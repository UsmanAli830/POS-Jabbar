const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.findMany();
  for (const sale of sales) {
    if (!sale.billNumber) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { billNumber: sale.invoiceNumber }
      });
    }
  }
  console.log('Update complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
