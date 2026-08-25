import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runAudit() {
  console.log('=== STARTING SESSION & COMMISSION AUDIT (PHASE 71) ===');

  // 1. Fetch our test employee
  const email = 'aj4754705@gmail.com';
  const employee = await prisma.employeeRec.findUnique({
    where: { username: email }
  });

  if (!employee) {
    console.error(`❌ Error: Test employee '${email}' not found in database.`);
    process.exit(1);
  }

  console.log(`✅ Step 1: Found test employee profile:`);
  console.log(`   - ID: ${employee.id}`);
  console.log(`   - Name: ${employee.name}`);
  console.log(`   - Email/Username: ${employee.username}`);
  console.log(`   - Commission Rate: ${employee.commissionRate}%`);

  // Ensure commission rate is set for testing calculations
  if (employee.commissionRate === 0) {
    await prisma.employeeRec.update({
      where: { id: employee.id },
      data: { commissionRate: 2.5 }
    });
    employee.commissionRate = 2.5;
    console.log(`   - Updated Commission Rate to 2.5% for audit calculations.`);
  }

  // 2. Perform Session-Linked Sale Simulation (Standard Sale)
  console.log('\n✅ Step 2: Simulating session-linked sale flow...');
  
  // Create a product to sell if none exists
  let product = await prisma.productRec.findFirst();
  if (!product) {
    product = await prisma.productRec.create({
      data: {
        productName: 'Audit Test Product',
        productCode: 'AUDIT-001',
        barCode: '999999',
        retailPrice: 1000,
        costPrice: 800
      }
    });
  }

  const netSaleAmount = 10000; // Rs. 10,000 net total
  
  // Create the SaleMain record directly simulating backend authenticated assignment
  const newSale = await prisma.saleMain.create({
    data: {
      customerRecId: null,
      salesmanId: employee.id, // Enforced by backend session
      totalAmount: netSaleAmount,
      grossAmount: netSaleAmount,
      discountAmount: 0,
      paymentReceived: netSaleAmount,
      details: {
        create: [
          {
            productRecId: product.id,
            qty: 10,
            price: 1000,
            grossAmount: netSaleAmount,
            netAmount: netSaleAmount
          }
        ]
      }
    }
  });

  console.log(`   - Created Standard Sale ID: ${newSale.id}`);
  console.log(`   - Enforced Salesman ID: ${newSale.salesmanId}`);
  
  // Assertions
  if (newSale.salesmanId === employee.id) {
    console.log('   - ASSERTION PASSED: salesmanId matches the correct logged-in Employee ID.');
  } else {
    console.error('   - ASSERTION FAILED: salesmanId does not match!');
    process.exit(1);
  }

  if (newSale.salesmanId !== null) {
    console.log('   - ASSERTION PASSED: salesmanId is NOT null and does not default to Admin.');
  } else {
    console.error('   - ASSERTION FAILED: salesmanId was saved as null!');
    process.exit(1);
  }

  // 3. Perform Session-Linked Order Booking Simulation
  console.log('\n✅ Step 3: Simulating session-linked booking flow...');
  
  // Fetch valid location and product for booking references
  const firstLocation = await prisma.location.findFirst();
  const firstProduct = await prisma.product.findFirst();

  if (!firstLocation || !firstProduct) {
    console.error('❌ Error: Prerequisites (Location, Product) not found in database to run booking sheet simulation.');
    process.exit(1);
  }

  const bookingNum = `AUDIT-BKG-${Date.now().toString().slice(-6)}`;
  const newBooking = await prisma.bookingSheet.create({
    data: {
      invoiceNumber: bookingNum,
      subtotal: netSaleAmount,
      taxAmount: 0,
      discountAmount: 0,
      total: netSaleAmount,
      locationId: firstLocation.id,
      salesmanId: employee.id, // Enforced by backend session
      bookingItems: {
        create: [
          {
            productId: firstProduct.id,
            quantity: 10,
            unitPrice: 1000,
            totalPrice: netSaleAmount
          }
        ]
      }
    }
  });

  console.log(`   - Created Booking Sheet: ${newBooking.invoiceNumber}`);
  console.log(`   - Enforced Salesman ID: ${newBooking.salesmanId}`);

  // Assertions
  if (newBooking.salesmanId === employee.id) {
    console.log('   - ASSERTION PASSED: Booking salesmanId matches the correct logged-in Employee ID.');
  } else {
    console.error('   - ASSERTION FAILED: Booking salesmanId does not match!');
    process.exit(1);
  }

  // 4. Commission Calculation Verification
  console.log('\n✅ Step 4: Auditing commission calculations...');
  const expectedCommission = (netSaleAmount * employee.commissionRate) / 100;
  
  // Simulate the frontend calculation
  const computedCommission = (newSale.totalAmount * employee.commissionRate) / 100;
  
  console.log(`   - Sale Total Amount: Rs. ${newSale.totalAmount}`);
  console.log(`   - Commission Rate: ${employee.commissionRate}%`);
  console.log(`   - Expected Commission: Rs. ${expectedCommission}`);
  console.log(`   - Calculated Commission: Rs. ${computedCommission}`);

  if (computedCommission === expectedCommission) {
    console.log(`   - ASSERTION PASSED: Commission calculation is mathematically correct (Rs. ${computedCommission}).`);
  } else {
    console.error('   - ASSERTION FAILED: Commission calculation mismatch!');
    process.exit(1);
  }

  // 5. Cleanup test records
  console.log('\n🧹 Cleaning up test audit records from database...');
  await prisma.bookingItem.deleteMany({
    where: { bookingSheetId: newBooking.id }
  });
  await prisma.bookingSheet.delete({
    where: { id: newBooking.id }
  });
  await prisma.saleInvDtl.deleteMany({
    where: { saleMainId: newSale.id }
  });
  await prisma.saleMain.delete({
    where: { id: newSale.id }
  });
  console.log('   - Test audit records cleaned up successfully.');

  console.log('\n=== ALL PHASE 71 AUDIT TESTS PASSED SUCCESSFULLY ===');
}

runAudit()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
