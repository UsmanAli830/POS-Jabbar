import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  const products = await prisma.productRec.findMany({
    where: {
      OR: [
        { productName: { contains: 'samsung' } },
        { productName: { contains: 'Test Product 1' } }
      ]
    }
  });

  console.log('=== PRODUCTS ===');
  for (const prod of products) {
    console.log(`Product: ${prod.productName} (ID: ${prod.id})`);
    console.log(`  - Cost Price:   Rs. ${prod.costPrice}`);
    console.log(`  - Retail Price: Rs. ${prod.retailPrice}`);
    console.log(`  - CurrentStock: ${prod.currentStock}`);

    const sales = await prisma.saleInvDtl.findMany({
      where: { productRecId: prod.id },
      include: { saleMain: true }
    });

    console.log(`  - Total Sales Invoices: ${sales.length}`);
    let totalQty = 0;
    let totalNet = 0;
    for (const s of sales) {
      totalQty += s.qty;
      totalNet += (s.netAmount || 0);
      console.log(`    * Sale ID: ${s.saleMainId} | Qty: ${s.qty} | Price Sold: Rs. ${s.price} | Net Amount: Rs. ${s.netAmount} | Line Cost (${s.qty} * ${prod.costPrice}): Rs. ${s.qty * prod.costPrice} | Line Profit: Rs. ${s.netAmount - (s.qty * prod.costPrice)}`);
    }
    console.log(`  - Summary for ${prod.productName}:`);
    console.log(`    * Total Qty Sold: ${totalQty}`);
    console.log(`    * Total Revenue Generated: Rs. ${totalNet}`);
    console.log(`    * Total Cost of Goods Sold: Rs. ${totalQty * prod.costPrice}`);
    console.log(`    * Net Profit: Rs. ${totalNet - (totalQty * prod.costPrice)}`);
  }
}

inspect().finally(() => prisma.$disconnect());
