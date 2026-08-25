import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runOrderBookingTest() {
  console.log('🧪 Starting Phase 25: Order Booking Engine Integration Test...\n');

  try {
    // 1. Fetch or create a Location
    let loc = await prisma.location.findFirst();
    if (!loc) {
      loc = await prisma.location.create({
        data: { name: 'Main Store Warehouse' }
      });
    }

    // 2. Fetch or create a Product (Model: Product)
    let product = await prisma.product.findFirst();
    if (!product) {
      const cat = await prisma.category.create({ data: { name: 'Booking Test Cat' } });
      product = await prisma.product.create({
        data: {
          productCode: 'BKG-PROD-01',
          barCode: '9988776655',
          productName: 'Booking Test Product',
          categoryId: cat.id,
          salePrice: 1500,
          packSize: 1,
          baseUom: 'Pcs',
          bulkUom: 'Carton'
        }
      });
    }

    // 3. Submit Order Booking via API POST /api/bookings
    const bkgRef = `BKG-QA-${Date.now().toString().slice(-6)}`;
    const expectedDelivery = '2026-08-25';
    const totalVal = 15000;

    const res = await fetch('http://localhost:3000/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: bkgRef,
        subtotal: totalVal,
        taxAmount: 0,
        discountAmount: 0,
        total: totalVal,
        paymentMethod: 'Cash',
        locationId: loc.id,
        dueDate: expectedDelivery,
        remarks: 'Deliver to main site',
        items: [
          {
            productId: product.id,
            quantity: 10,
            unitPrice: 1500,
            totalPrice: 15000
          }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Order booking POST API failed: ${errText}`);
    }

    const bookingData = await res.json();
    console.log(`✅ Step 1: Created Order Booking via API (Ref: ${bookingData.invoiceNumber}, Status: ${bookingData.status})`);

    // 4. Query GET /api/bookings and verify order exists
    const listRes = await fetch('http://localhost:3000/api/bookings');
    const allBookings = await listRes.json();
    const createdBooking = allBookings.find((b: any) => b.invoiceNumber === bkgRef);

    if (!createdBooking) {
      throw new Error(`❌ BOOKING NOT FOUND: Ref ${bkgRef} was not present in GET /api/bookings response!`);
    }

    console.log(`✅ Step 2: Found Order Booking in GET /api/bookings list (Items: ${createdBooking.bookingItems?.length || 0})`);

    // Cleanup Test Data
    await prisma.bookingSheet.delete({ where: { id: createdBooking.id } });
    console.log('\n======================================');
    console.log('🎉 Phase 25: Order Booking UI & Engine PASSED ALL TESTS!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOrderBookingTest();
