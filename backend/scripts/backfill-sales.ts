import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting backfill for SaleMain records...');
  
  const sales = await prisma.saleMain.findMany({
    include: { details: true }
  });

  let updatedCount = 0;

  for (const sale of sales) {
    let grossAmount = 0;
    let totalDiscount = 0;

    for (const d of sale.details) {
      grossAmount += (d.qty * d.price);
    }

    // Per user instructions: TotalDiscount = SumGross - SumNet
    totalDiscount = grossAmount - sale.totalAmount;

    const paymentReceived = sale.customerRecId ? 0 : sale.totalAmount;

    await prisma.saleMain.update({
      where: { id: sale.id },
      data: {
        grossAmount: grossAmount,
        discountAmount: totalDiscount,
        expenseAmount: 0,
        paymentReceived: paymentReceived
      }
    });

    updatedCount++;
    console.log(`Updated Sale INV-${sale.id}: Gross=${grossAmount}, Discount=${totalDiscount}`);
  }

  console.log(`Backfill completed! Updated ${updatedCount} records.`);
}

backfill()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
