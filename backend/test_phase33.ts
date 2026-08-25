import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  try {
    console.log('--- Test 1: Multi-Shop Customer Routing ---');
    // 1. Create a customer
    const custRes = await fetch('http://localhost:3000/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mega Wholesale',
        phone: '1234567890',
        email: 'mega@wholesale.com',
        address: '123 Main St',
        taxId: '',
        creditLimit: 50000,
        cityId: 1, // Assume 1 exists
        custTypeId: 1, // Assume 1 exists
        isActive: true
      })
    });
    const customer = await custRes.json();
    console.log('Created customer:', customer.id);

    // 2. Add two branches
    const shop1Res = await fetch(`http://localhost:3000/api/customers/${customer.id}/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName: 'Mega North', address: 'North Pole' })
    });
    const shop1 = await shop1Res.json();
    
    const shop2Res = await fetch(`http://localhost:3000/api/customers/${customer.id}/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName: 'Mega South', address: 'South Pole' })
    });
    const shop2 = await shop2Res.json();
    console.log('Created shops:', shop1.id, shop2.id);

    // 3. Get products for checkout
    const products = await prisma.product.findMany({ take: 2 });
    if (products.length < 2) throw new Error('Need at least 2 products in DB');

    // 4. Checkout
    const payload = {
      invoiceNumber: `TEST-INV-${Date.now()}`,
      subtotal: 100,
      taxAmount: 5,
      discountAmount: 0,
      total: 105,
      paymentMethod: 'Credit / Unpaid',
      locationId: 1, // Assume 1 exists
      customerId: customer.id,
      items: [
        {
          productId: products[0].id,
          quantity: 1,
          unitPrice: 50,
          totalPrice: 50,
          netAmount: 50,
          customerShopId: shop1.id
        },
        {
          productId: products[1].id,
          quantity: 1,
          unitPrice: 50,
          totalPrice: 50,
          netAmount: 50,
          customerShopId: shop2.id
        }
      ]
    };

    const saleRes = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!saleRes.ok) {
        const text = await saleRes.text();
        console.error('Sale failed:', text);
    } else {
        const sale = await saleRes.json();
        console.log('Sale created:', sale.id);

        // Verify DB
        const saleItems = await prisma.saleItem.findMany({ where: { saleId: sale.id } });
        console.log('Sale items shops:', saleItems.map(si => si.customerShopId));
        if (saleItems[0].customerShopId === shop1.id && saleItems[1].customerShopId === shop2.id) {
            console.log('TEST 1 PASSED: customerShopId properly saved to SaleItems.');
        } else {
            console.error('TEST 1 FAILED: customerShopId not saved properly.');
        }
    }

    console.log('--- Test 3: Grand Total Valuation (Dashboard) ---');
    const summaryRes = await fetch('http://localhost:3000/api/dashboard/summary');
    const summary = await summaryRes.json();
    console.log('Dashboard summary:', summary);
    if (summary.totalInventoryValuation >= 0) {
      console.log('TEST 3 PASSED: totalInventoryValuation = ' + summary.totalInventoryValuation);
    } else {
      console.error('TEST 3 FAILED: totalInventoryValuation = ' + summary.totalInventoryValuation);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
