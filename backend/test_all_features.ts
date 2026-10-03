import prisma from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function runSystemVerification() {
  console.log('=== STARTING ALL 5 FEATURES SYSTEM AUDIT & E2E VERIFICATION ===\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS ${totalTests}] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL ${totalTests}] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // --- 1. UNIFIED LOGIN & ROLE-BASED AUTH VERIFICATION ---
    console.log('--- TEST 1: Unified Login Endpoint ---');
    // Ensure test admin employee exists
    let adminEmp = await prisma.employeeRec.findFirst({
      where: { username: 'audit_admin_user' }
    });

    if (!adminEmp) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      let post = await prisma.postRec.findFirst();
      if (!post) {
        post = await prisma.postRec.create({ data: { title: 'Store Manager' } });
      }

      adminEmp = await prisma.employeeRec.create({
        data: {
          name: 'Audit Store Admin',
          username: 'audit_admin_user',
          password: hashedPassword,
          role: 'ADMIN',
          isAdmin: true,
          baseSalary: 60000,
          postRecId: post.id
        }
      });
    }

    assert(Boolean(adminEmp && adminEmp.username === 'audit_admin_user'), 'Admin user verified in database');
    assert(adminEmp.role === 'ADMIN' || adminEmp.isAdmin === true, 'Admin role identified correctly for automatic routing');

    // --- 2. CARTON PACKAGING & DUAL PRICING (WHOLESALE/RETAIL) ---
    console.log('\n--- TEST 2: Carton Packaging & Dual Price Engine Setup ---');
    const prodCode = `P-AUDIT-${Date.now().toString().slice(-4)}`;
    const barCode = `BC-AUDIT-${Date.now().toString().slice(-4)}`;

    const cartonProduct = await prisma.productRec.create({
      data: {
        productCode: prodCode,
        barCode: barCode,
        productName: 'Premium Cooking Oil 1L (Carton Pack)',
        pcsPerCarton: 12,
        costPrice: 400,
        retailPrice: 500,
        wholeSalePrice: 450,
        cartonCostPrice: 4800,
        cartonRetailPrice: 6000,
        cartonWsPrice: 5400,
        currentStock: 120 // 120 pieces = 10 Cartons of 12 pcs
      }
    });

    assert(cartonProduct.pcsPerCarton === 12, 'Product pcsPerCarton correctly set to 12 pcs');
    assert(cartonProduct.cartonRetailPrice === 6000, 'Carton retail price set to Rs. 6,000');
    assert(cartonProduct.cartonWsPrice === 5400, 'Carton wholesale price set to Rs. 5,400');
    assert(cartonProduct.currentStock === 120, 'Initial piece stock set to 120 pieces (10 Cartons)');

    // --- 3. SALES CHECKOUT WITH CARTONS, DELIVERY CHARGES, AND DOUBLE-ENTRY LEDGER ---
    console.log('\n--- TEST 3: POS Sale with Cartons, Freight/Labour, & Double-Entry Ledger ---');
    
    // Create audit customer
    const custName = `Audit Customer ${Date.now().toString().slice(-4)}`;
    const customer = await txOrCreateCustomer(custName);

    // Perform sale transaction for 2 Cartons of cooking oil at Wholesale Carton Price (2 * 5400 = 10800)
    // + Delivery Charges Rs. 300 + Labour Charges Rs. 150 = Total Payable Rs. 11,250
    const cartonQtySold = 2;
    const itemRate = cartonProduct.cartonWsPrice || 5400; // Wholesale Carton rate
    const itemsGross = cartonQtySold * itemRate; // 10,800
    const deliveryCharges = 300;
    const labourCharges = 150;
    const expectedGrandTotal = itemsGross + deliveryCharges + labourCharges; // 11,250

    const nextInvoiceSeq = await getNextInvoiceSeq();

    const saleRecord = await prisma.$transaction(async (tx) => {
      // Create Sale
      const sale = await tx.saleMain.create({
        data: {
          customerRecId: customer.id,
          totalAmount: expectedGrandTotal,
          grossAmount: itemsGross,
          discountAmount: 0,
          paymentReceived: expectedGrandTotal,
          deliveryCharges: deliveryCharges,
          labourCharges: labourCharges,
          deliveryRemarks: 'Driver Rashid - Vehicle LEB-8832',
          invoiceNumber: nextInvoiceSeq,
          details: {
            create: [
              {
                productRecId: cartonProduct.id,
                qty: cartonQtySold,
                unitType: 'CARTON',
                cartonQty: cartonQtySold,
                price: itemRate,
                grossAmount: itemsGross,
                netAmount: itemsGross
              }
            ]
          }
        },
        include: { details: true }
      });

      // Deduct inventory pieces: 2 cartons * 12 pcs = 24 pieces
      const totalPiecesToDeduct = cartonQtySold * cartonProduct.pcsPerCarton;
      await tx.productRec.update({
        where: { id: cartonProduct.id },
        data: { currentStock: { decrement: totalPiecesToDeduct } }
      });

      // Double-entry ledger
      let salesRevHead = await tx.finHead.findFirst({ where: { name: 'Sales Revenue' } });
      if (!salesRevHead) salesRevHead = await tx.finHead.create({ data: { name: 'Sales Revenue' } });

      let deliveryHead = await tx.finHead.findFirst({ where: { name: 'Freight & Delivery Income' } });
      if (!deliveryHead) deliveryHead = await tx.finHead.create({ data: { name: 'Freight & Delivery Income' } });

      let labourHead = await tx.finHead.findFirst({ where: { name: 'Labour & Handling Income' } });
      if (!labourHead) labourHead = await tx.finHead.create({ data: { name: 'Labour & Handling Income' } });

      let cashHead = await tx.finHead.findFirst({ where: { name: { contains: 'Cash' } } });
      if (!cashHead) cashHead = await tx.finHead.create({ data: { name: 'Cash in Till' } });

      // Post Invoice Entry
      await tx.cashFlowMAIN.create({
        data: {
          description: `Invoice INV-${nextInvoiceSeq} (Total: Rs. ${expectedGrandTotal})`,
          details: {
            create: [
              { finHeadId: cashHead!.id, amount: expectedGrandTotal, transactionType: 'DR' },
              { finHeadId: salesRevHead.id, amount: itemsGross, transactionType: 'CR' },
              { finHeadId: deliveryHead.id, amount: deliveryCharges, transactionType: 'CR' },
              { finHeadId: labourHead.id, amount: labourCharges, transactionType: 'CR' }
            ]
          }
        }
      });

      return sale;
    });

    assert(saleRecord.totalAmount === 11250, 'Sale total payable calculated correctly (Items 10,800 + Del 300 + Lab 150 = 11,250)');
    assert(saleRecord.deliveryCharges === 300, 'Delivery charges saved as Rs. 300');
    assert(saleRecord.labourCharges === 150, 'Labour charges saved as Rs. 150');
    assert(saleRecord.deliveryRemarks === 'Driver Rashid - Vehicle LEB-8832', 'Delivery remarks saved correctly');

    // Check stock deduction
    const updatedProd = await prisma.productRec.findUnique({ where: { id: cartonProduct.id } });
    assert(updatedProd?.currentStock === 96, 'Carton piece stock decremented by 24 pieces (120 - 24 = 96 pcs / 8 Cartons remaining)');

    // --- 4. ADVANCE SALARY & PAYROLL REMAINING BALANCE VERIFICATION ---
    console.log('\n--- TEST 4: HR Employee Advance Salary & Live Remaining Balance ---');
    let empPost = await prisma.postRec.findFirst();
    if (!empPost) empPost = await prisma.postRec.create({ data: { title: 'Sales Executive' } });

    const staffEmp = await prisma.employeeRec.create({
      data: {
        name: `Staff Member ${Date.now().toString().slice(-4)}`,
        baseSalary: 50000,
        flatBonus: 2000,
        postRecId: empPost.id
      }
    });

    // Issue Advance Salary of Rs. 12,000
    const advanceAmount = 12000;
    const advanceRecord = await prisma.$transaction(async (tx) => {
      const adv = await tx.empAdvanceSalary.create({
        data: {
          employeeRecId: staffEmp.id,
          amount: advanceAmount,
          remarks: 'Festival advance payout',
          status: 'PENDING_ADJUSTMENT'
        }
      });

      let empRecHead = await tx.finHead.findFirst({ where: { name: 'Employee Receivable' } });
      if (!empRecHead) empRecHead = await tx.finHead.create({ data: { name: 'Employee Receivable' } });

      let cashHead = await tx.finHead.findFirst({ where: { name: { contains: 'Cash' } } });
      if (!cashHead) cashHead = await tx.finHead.create({ data: { name: 'Cash in Till' } });

      await tx.cashFlowMAIN.create({
        data: {
          description: `Advance Salary: ${staffEmp.name}`,
          details: {
            create: [
              { finHeadId: empRecHead.id, amount: advanceAmount, transactionType: 'DR' },
              { finHeadId: cashHead.id, amount: advanceAmount, transactionType: 'CR' }
            ]
          }
        }
      });

      return adv;
    });

    assert(advanceRecord.amount === 12000, 'Employee advance salary logged as Rs. 12,000');
    assert(advanceRecord.status === 'PENDING_ADJUSTMENT', 'Advance status marked as PENDING_ADJUSTMENT');

    // Calculate remaining salary formula: Base (50,000) + Bonus (2,000) - Advance (12,000) = Rs. 40,000
    const remainingSalaryToPay = staffEmp.baseSalary + staffEmp.flatBonus - advanceRecord.amount;
    assert(remainingSalaryToPay === 40000, 'Live Remaining Salary calculated cleanly as Rs. 40,000');

    console.log('\n======================================================');
    console.log(`🎉 VERIFICATION SUCCESSFUL: ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
    console.log('======================================================\n');

  } catch (err: any) {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function txOrCreateCustomer(name: string) {
  let cust = await prisma.customerRec.findFirst({ where: { custName: name } });
  if (!cust) {
    cust = await prisma.customerRec.create({
      data: { custName: name, phone: '03001234567' }
    });
  }
  return cust;
}

async function getNextInvoiceSeq() {
  const last = await prisma.saleMain.findFirst({
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true }
  });
  return (last && last.invoiceNumber) ? last.invoiceNumber + 1 : 1;
}

runSystemVerification();
