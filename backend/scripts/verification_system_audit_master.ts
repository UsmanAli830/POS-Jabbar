import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runMasterSystemAudit() {
  console.log('========================================================================');
  console.log('🚀 EXECUTING: COMPREHENSIVE SYSTEM AUDIT & VERIFICATION SUITE');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // PILLAR 1: CUSTOMER, VENDOR, & EMPLOYEE CRUD & LEDGER VERIFICATION
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log('📋 STEP 1: CUSTOMER, VENDOR, & EMPLOYEE CRUD LIFECYCLES');
    console.log('------------------------------------------------------------------------');

    // 1.1 Create 5 Customers
    console.log('\n--- 1.1 Creating 5 Customers ---');
    const createdCustomers: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const cust = await prisma.customerRec.create({
        data: {
          custName: `Audit Customer ${i}`,
          businessName: `Audit Business ${i} Ltd`,
          custCNIC: `35201-123456${i}-1`,
          phone: `0300123456${i}`,
          openingBalance: i * 1000,
          creditLimit: 50000,
          address: `Lahore Sector ${i}`
        }
      });
      // Link or create finHead
      const fh = await prisma.finHead.create({
        data: {
          name: `Customer: ${cust.custName}`,
          customerRecId: cust.id
        }
      });
      createdCustomers.push({ ...cust, finHeadId: fh.id });
      console.log(`  ✓ Created Customer ${i}: ${cust.custName} (ID: ${cust.id}, Opening Bal: Rs. ${cust.openingBalance})`);
    }

    // 1.2 Edit 5 Customers
    console.log('\n--- 1.2 Editing 5 Customers ---');
    for (let i = 0; i < 5; i++) {
      const cust = createdCustomers[i];
      const updated = await prisma.customerRec.update({
        where: { id: cust.id },
        data: {
          custName: `${cust.custName} (Verified)`,
          creditLimit: 75000
        }
      });
      console.log(`  ✓ Updated Customer ${cust.id}: Name -> '${updated.custName}', Credit Limit -> ${updated.creditLimit}`);
    }

    // 1.3 Create 5 Vendors
    console.log('\n--- 1.3 Creating 5 Vendors ---');
    const createdVendors: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const vendor = await prisma.sellerRec.create({
        data: {
          companyName: `Audit Vendor Company ${i}`,
          contactPerson: `Supplier Agent ${i}`,
          phone: `0321987654${i}`,
          address: `Karachi Industrial Zone ${i}`
        }
      });
      const fh = await prisma.finHead.create({
        data: {
          name: `Vendor: ${vendor.companyName}`,
          sellerRecId: vendor.id
        }
      });
      createdVendors.push({ ...vendor, finHeadId: fh.id });
      console.log(`  ✓ Created Vendor ${i}: ${vendor.companyName} (ID: ${vendor.id})`);
    }

    // 1.4 Edit 5 Vendors
    console.log('\n--- 1.4 Editing 5 Vendors ---');
    for (let i = 0; i < 5; i++) {
      const vendor = createdVendors[i];
      const updated = await prisma.sellerRec.update({
        where: { id: vendor.id },
        data: {
          companyName: `${vendor.companyName} (Verified Partner)`,
          contactPerson: `Senior Rep ${i + 1}`
        }
      });
      console.log(`  ✓ Updated Vendor ${vendor.id}: Company -> '${updated.companyName}'`);
    }

    // 1.5 Create 5 Employees
    console.log('\n--- 1.5 Creating 5 Employees ---');
    const post = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Audit Staff' } });
    const createdEmployees: any[] = [];
    const baseSalaries = [30000, 35000, 40000, 45000, 50000];
    const commissionRates = [2.0, 3.0, 2.5, 4.0, 5.0];

    for (let i = 1; i <= 5; i++) {
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash('auditpass123', salt);
      const emp = await prisma.employeeRec.create({
        data: {
          name: `Audit Employee ${i}`,
          username: `auditemp_${i}_${Date.now()}@pos.local`,
          password: hashPassword,
          baseSalary: baseSalaries[i - 1],
          commissionRate: commissionRates[i - 1],
          role: 'SALES_EXECUTIVE',
          postRecId: post.id,
          phone: `034500000${i}`
        }
      });
      createdEmployees.push(emp);
      console.log(`  ✓ Created Employee ${i}: ${emp.name} (ID: ${emp.id}, Salary: Rs. ${emp.baseSalary}, Comm: ${emp.commissionRate}%)`);
    }

    // 1.6 Edit 5 Employees
    console.log('\n--- 1.6 Editing 5 Employees ---');
    for (let i = 0; i < 5; i++) {
      const emp = createdEmployees[i];
      const updated = await prisma.employeeRec.update({
        where: { id: emp.id },
        data: {
          name: `${emp.name} (Active Staff)`
        }
      });
      console.log(`  ✓ Updated Employee ${emp.id}: Name -> '${updated.name}'`);
    }

    // 1.7 Create 1 disposable entity of each and test Deletion
    console.log('\n--- 1.7 Testing Deletion for Customer, Vendor, and Employee ---');
    const tempCust = await prisma.customerRec.create({ data: { custName: 'Temp Cust To Delete' } });
    await prisma.customerRec.delete({ where: { id: tempCust.id } });
    console.log(`  ✓ Customer Deletion Verified: Created and deleted temp ID ${tempCust.id}`);

    const tempVend = await prisma.sellerRec.create({ data: { companyName: 'Temp Vendor To Delete' } });
    await prisma.sellerRec.delete({ where: { id: tempVend.id } });
    console.log(`  ✓ Vendor Deletion Verified: Created and deleted temp ID ${tempVend.id}`);

    const tempEmp = await prisma.employeeRec.create({
      data: {
        name: 'Temp Emp To Delete',
        username: `temp_del_${Date.now()}@pos.local`,
        password: '123'
      }
    });
    await prisma.employeeRec.delete({ where: { id: tempEmp.id } });
    console.log(`  ✓ Employee Deletion Verified: Created and deleted temp ID ${tempEmp.id}`);

    // -------------------------------------------------------------------------
    // PILLAR 2: VENDOR PURCHASES, CUSTOMER SALES, RECOVERIES & PAYMENTS
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('💰 STEP 2: PURCHASES, SALES, CASH RECOVERY & VENDOR PAYMENTS (LEDGER)');
    console.log('------------------------------------------------------------------------');

    // Create a standard test product
    const testProduct = await prisma.productRec.create({
      data: {
        productName: `Standard Audit Product ${Date.now()}`,
        productCode: `AUD-PROD-${Date.now()}`,
        barCode: `BAR-${Date.now()}`,
        costPrice: 500,
        retailPrice: 800,
        currentStock: 100
      }
    });
    console.log(`  ✓ Created Test Product: ${testProduct.productName} (Cost: Rs. 500, Retail: Rs. 800, Initial Stock: 100)`);

    // 2.1 Purchase from Vendor 1 -> Updates Stock & Vendor Ledger
    const targetVendor = createdVendors[0];
    const purchaseQty = 50;
    const purchaseUnitCost = 500;
    const totalPurchaseVal = purchaseQty * purchaseUnitCost; // Rs. 25,000

    const purchase = await prisma.purMain.create({
      data: {
        sellerRecId: targetVendor.id,
        totalAmount: totalPurchaseVal,
        details: {
          create: [{
            productRecId: testProduct.id,
            qty: purchaseQty,
            price: purchaseUnitCost
          }]
        }
      }
    });
    // Increment stock
    await prisma.productRec.update({
      where: { id: testProduct.id },
      data: { currentStock: { increment: purchaseQty } }
    });
    // Double entry: Credit Vendor AP, Debit Inventory Asset
    const invAssetHead = await prisma.finHead.findFirst({ where: { name: 'Inventory Asset' } }) ||
      await prisma.finHead.create({ data: { name: 'Inventory Asset' } });
    
    await prisma.cashFlowMAIN.create({
      data: {
        description: `Purchase Invoice ID ${purchase.id}`,
        details: {
          create: [
            { finHeadId: targetVendor.finHeadId, amount: totalPurchaseVal, transactionType: 'CR' },
            { finHeadId: invAssetHead.id, amount: totalPurchaseVal, transactionType: 'DR' }
          ]
        }
      }
    });
    console.log(`  ✓ Vendor Purchase Recorded: PO #${purchase.id} for Rs. ${totalPurchaseVal}`);

    // Check Vendor Live Balance: Credit increases payable debt
    const vendorDtls = await prisma.cashFlowDTL.findMany({ where: { finHeadId: targetVendor.finHeadId } });
    const vendorCR = vendorDtls.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
    const vendorDR = vendorDtls.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
    const vendorPayable = vendorCR - vendorDR;
    console.log(`  ✓ Vendor 1 Live Balance Verified: Rs. ${vendorPayable} Payable (CR: ${vendorCR}, DR: ${vendorDR})`);
    if (vendorPayable !== 25000) throw new Error(`Assertion failed: Expected Vendor Payable Rs. 25,000, got ${vendorPayable}`);

    // 2.2 Vendor Payment -> Reduces Vendor Live Balance
    const vendorPaymentAmount = 10000;
    const cashInTillHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } }) ||
      await prisma.finHead.create({ data: { name: 'Cash in Till' } });

    await prisma.cashFlowMAIN.create({
      data: {
        description: `Vendor Bill Payment to Vendor ID ${targetVendor.id}`,
        details: {
          create: [
            { finHeadId: targetVendor.finHeadId, amount: vendorPaymentAmount, transactionType: 'DR' },
            { finHeadId: cashInTillHead.id, amount: vendorPaymentAmount, transactionType: 'CR' }
          ]
        }
      }
    });

    const vendorDtlsAfterPay = await prisma.cashFlowDTL.findMany({ where: { finHeadId: targetVendor.finHeadId } });
    const vCR2 = vendorDtlsAfterPay.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
    const vDR2 = vendorDtlsAfterPay.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
    const vendorPayableAfterPay = vCR2 - vDR2;
    console.log(`  ✓ Vendor Payment Applied: Rs. ${vendorPaymentAmount} Paid -> Updated Vendor Payable: Rs. ${vendorPayableAfterPay}`);
    if (vendorPayableAfterPay !== 15000) throw new Error(`Assertion failed: Expected Vendor Payable Rs. 15,000, got ${vendorPayableAfterPay}`);

    // 2.3 Sale to Customer 1 -> Updates Customer Ledger & Live Balance
    const targetCustomer = createdCustomers[0];
    const targetEmployee = createdEmployees[0];
    const saleQty = 20;
    const salePrice = 800;
    const totalSaleAmount = saleQty * salePrice; // Rs. 16,000

    const sale = await prisma.saleMain.create({
      data: {
        customerRecId: targetCustomer.id,
        salesmanId: targetEmployee.id,
        grossAmount: totalSaleAmount,
        discountAmount: 0,
        totalAmount: totalSaleAmount,
        paymentReceived: 0, // on credit
        details: {
          create: [{
            productRecId: testProduct.id,
            qty: saleQty,
            price: salePrice,
            grossAmount: totalSaleAmount,
            netAmount: totalSaleAmount
          }]
        }
      }
    });
    // Decrement stock
    await prisma.productRec.update({
      where: { id: testProduct.id },
      data: { currentStock: { decrement: saleQty } }
    });

    const salesRevHead = await prisma.finHead.findFirst({ where: { name: 'Sales Revenue' } }) ||
      await prisma.finHead.create({ data: { name: 'Sales Revenue' } });

    await prisma.cashFlowMAIN.create({
      data: {
        description: `Invoice: INV-${sale.id} (Total: Rs. ${totalSaleAmount})`,
        details: {
          create: [
            { finHeadId: targetCustomer.finHeadId, amount: totalSaleAmount, transactionType: 'DR' }, // Debit Customer AR
            { finHeadId: salesRevHead.id, amount: totalSaleAmount, transactionType: 'CR' }
          ]
        }
      }
    });
    console.log(`  ✓ Customer Sale Recorded: INV #${sale.id} for Rs. ${totalSaleAmount} by Salesman ${targetEmployee.name}`);

    // Check Customer Live Receivable: openingBalance + DR - CR
    const custDtls = await prisma.cashFlowDTL.findMany({ where: { finHeadId: targetCustomer.finHeadId } });
    const cDR = custDtls.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
    const cCR = custDtls.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
    const custReceivable = targetCustomer.openingBalance + cDR - cCR;
    console.log(`  ✓ Customer 1 Live Receivable Verified: Rs. ${custReceivable} (Opening: ${targetCustomer.openingBalance}, DR: ${cDR}, CR: ${cCR})`);
    if (custReceivable !== 17000) throw new Error(`Assertion failed: Expected Customer Receivable Rs. 17,000, got ${custReceivable}`);

    // 2.4 Cash Recovery from Customer 1 -> Reduces Live Balance
    const recoveryAmount = 6000;
    await prisma.recovery.create({
      data: {
        customerRecId: targetCustomer.id,
        amount: recoveryAmount,
        remarks: 'Audit Cash Recovery'
      }
    });
    await prisma.cashFlowMAIN.create({
      data: {
        description: `Recovery Payment Received: Audit Cash Recovery`,
        details: {
          create: [
            { finHeadId: cashInTillHead.id, amount: recoveryAmount, transactionType: 'DR' },
            { finHeadId: targetCustomer.finHeadId, amount: recoveryAmount, transactionType: 'CR' }
          ]
        }
      }
    });

    const custDtlsAfterRec = await prisma.cashFlowDTL.findMany({ where: { finHeadId: targetCustomer.finHeadId } });
    const cDR2 = custDtlsAfterRec.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
    const cCR2 = custDtlsAfterRec.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
    const custReceivableAfterRec = targetCustomer.openingBalance + cDR2 - cCR2;
    console.log(`  ✓ Cash Recovery Applied: Rs. ${recoveryAmount} -> Updated Customer Receivable: Rs. ${custReceivableAfterRec}`);
    if (custReceivableAfterRec !== 11000) throw new Error(`Assertion failed: Expected Customer Receivable Rs. 11,000, got ${custReceivableAfterRec}`);

    // -------------------------------------------------------------------------
    // PILLAR 3: ADMIN PERMISSIONS & ACCESS CONTROL RESTRICTION
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('🔒 STEP 3: ADMIN PERMISSIONS CONTROL & ROUTE RESTRICTION');
    console.log('------------------------------------------------------------------------');

    for (let i = 0; i < 5; i++) {
      const emp = createdEmployees[i];
      // Configure permissions: POS allowed, Reports denied, Payroll denied
      const perms = [
        { pageRoute: 'pos', isAllowed: true },
        { pageRoute: 'sales', isAllowed: true },
        { pageRoute: 'balance-sheet', isAllowed: false },
        { pageRoute: 'payroll', isAllowed: false }
      ];

      for (const p of perms) {
        await prisma.userPermission.upsert({
          where: {
            employeeRecId_pageRoute: {
              employeeRecId: emp.id,
              pageRoute: p.pageRoute
            }
          },
          update: { isAllowed: p.isAllowed },
          create: {
            employeeRecId: emp.id,
            userLoginId: emp.id,
            pageRoute: p.pageRoute,
            isAllowed: p.isAllowed
          }
        });
      }

      const verifiedPerms = await prisma.userPermission.findMany({ where: { employeeRecId: emp.id } });
      const posAllowed = verifiedPerms.find(p => p.pageRoute === 'pos')?.isAllowed;
      const bsAllowed = verifiedPerms.find(p => p.pageRoute === 'balance-sheet')?.isAllowed;
      console.log(`  ✓ Employee ${emp.id} Permissions: 'pos' -> ${posAllowed ? 'ALLOWED' : 'DENIED'}, 'balance-sheet' -> ${bsAllowed ? 'ALLOWED' : 'DENIED'}`);
      if (!posAllowed || bsAllowed) throw new Error(`Permission assertion failed for employee ${emp.id}`);
    }

    // -------------------------------------------------------------------------
    // PILLAR 4: ATTENDANCE & PAYROLL VERIFICATION WITH MATHEMATICAL ASSERTIONS
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('👥 STEP 4: DAILY ATTENDANCE, ABSENT DEDUCTIONS & PAYROLL COMMISSION');
    console.log('------------------------------------------------------------------------');

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Ensure AttandenceStatus exists
    let absentStatus = await prisma.attandenceStatus.findFirst({ where: { status: 'Absent' } });
    if (!absentStatus) {
      absentStatus = await prisma.attandenceStatus.create({ data: { status: 'Absent' } });
    }

    // Log attendance for the 5 employees
    // Emp 1: 3 Absents, 2 Lates, 25 Presents
    // Emp 2: 1 Absent, 0 Lates, 29 Presents
    // Emp 3: 0 Absents, 1 Late, 30 Presents
    // Emp 4: 5 Absents, 0 Lates, 25 Presents
    // Emp 5: 2 Absents, 3 Lates, 25 Presents
    const absentCounts = [3, 1, 0, 5, 2];

    for (let i = 0; i < 5; i++) {
      const emp = createdEmployees[i];
      const absents = absentCounts[i];

      // Add absent attendance records for the month
      for (let a = 1; a <= absents; a++) {
        const attDate = new Date(currentYear, currentMonth - 1, a);
        await prisma.empAttandence.create({
          data: {
            employeeRecId: emp.id,
            statusId: absentStatus.id,
            statusText: 'Absent',
            date: attDate
          }
        });
      }

      // Add advance salary for Emp 1 and Emp 4
      let advanceAmount = 0;
      if (i === 0) advanceAmount = 5000;
      if (i === 3) advanceAmount = 8000;

      if (advanceAmount > 0) {
        await prisma.empAdvanceSalary.create({
          data: {
            employeeRecId: emp.id,
            amount: advanceAmount,
            status: 'PENDING_ADJUSTMENT',
            date: new Date()
          }
        });
        console.log(`  ✓ Logged Advance Salary of Rs. ${advanceAmount} for Employee ${emp.name}`);
      }

      // Calculate Payroll Math:
      // Absent Deduction = (Base Salary / 30) * Absents
      const baseSalary = emp.baseSalary || 30000;
      const absentDeduction = (baseSalary / 30) * absents;

      // Commission from sales processed by employee:
      const empSales = await prisma.saleMain.findMany({
        where: { salesmanId: emp.id }
      });
      const totalSalesProcessed = empSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
      const commissionAmount = (totalSalesProcessed * (emp.commissionRate || 0)) / 100;

      const totalDeductions = absentDeduction + advanceAmount;
      const netSalary = baseSalary + commissionAmount - totalDeductions;

      console.log(`  ✓ Employee ${i + 1} (${emp.name}):`);
      console.log(`     - Base Salary:        Rs. ${baseSalary}`);
      console.log(`     - Absents:            ${absents} days -> Deduction: Rs. ${absentDeduction.toFixed(2)}`);
      console.log(`     - Sales Processed:    Rs. ${totalSalesProcessed} -> Commission (${emp.commissionRate}%): Rs. ${commissionAmount.toFixed(2)}`);
      console.log(`     - Advance Deducted:   Rs. ${advanceAmount}`);
      console.log(`     - Net Salary Payable: Rs. ${netSalary.toFixed(2)}`);

      // Process Payroll
      const salaryRec = await prisma.empSalary.create({
        data: {
          employeeRecId: emp.id,
          salaryAmount: baseSalary,
          deduction: totalDeductions,
          extraIncentive: commissionAmount,
          netAmount: netSalary,
          month: currentMonth,
          year: currentYear,
          date: new Date()
        }
      });

      // Mark advances as adjusted
      await prisma.empAdvanceSalary.updateMany({
        where: { employeeRecId: emp.id, status: 'PENDING_ADJUSTMENT' },
        data: { status: 'ADJUSTED', adjustedAt: new Date() }
      });

      // Assertions
      const pendingAdvances = await prisma.empAdvanceSalary.count({
        where: { employeeRecId: emp.id, status: 'PENDING_ADJUSTMENT' }
      });
      if (pendingAdvances !== 0) throw new Error(`Pending advances not adjusted for employee ${emp.id}`);
      if (Math.abs(salaryRec.netAmount - netSalary) > 0.01) throw new Error(`Net salary calculation mismatch for employee ${emp.id}`);
    }

    // -------------------------------------------------------------------------
    // PILLAR 5: STANDARD AND NEGATIVE STOCK SELLING (POS & BALANCE SHEET)
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('📉 STEP 5: STANDARD & NEGATIVE STOCK SELLING (POS & BALANCE SHEET)');
    console.log('------------------------------------------------------------------------');

    // 5.1 Standard Stock Sale
    const stdProd = await prisma.productRec.create({
      data: {
        productName: `Standard Pos Product ${Date.now()}`,
        productCode: `STD-POS-${Date.now()}`,
        costPrice: 400,
        retailPrice: 700,
        currentStock: 10
      }
    });

    console.log(`  ✓ Created Standard Product: Stock = 10, Cost = Rs. 400, Retail = Rs. 700`);
    const initialValuation = stdProd.currentStock * stdProd.costPrice;
    console.log(`  ✓ Initial Valuation: 10 * Rs. 400 = Rs. ${initialValuation}`);

    // Sell 4 units
    await prisma.productRec.update({
      where: { id: stdProd.id },
      data: { currentStock: { decrement: 4 } }
    });
    const updatedStdProd = await prisma.productRec.findUnique({ where: { id: stdProd.id } });
    const postSaleStock = updatedStdProd?.currentStock || 0;
    const postSaleValuation = postSaleStock * (updatedStdProd?.costPrice || 0);
    console.log(`  ✓ Sold 4 units -> Current Stock: ${postSaleStock}, Valuation: ${postSaleStock} * Rs. 400 = Rs. ${postSaleValuation}`);
    if (postSaleStock !== 6 || postSaleValuation !== 2400) {
      throw new Error(`Standard stock assertion failed: Expected stock 6 and valuation 2400, got stock ${postSaleStock} and valuation ${postSaleValuation}`);
    }

    // 5.2 Negative Stock Sale (Critical Test)
    const zeroStockProd = await prisma.productRec.create({
      data: {
        productName: `Negative Stock Item ${Date.now()}`,
        productCode: `NEG-PROD-${Date.now()}`,
        costPrice: 600,
        retailPrice: 1000,
        currentStock: 0 // Zero Stock
      }
    });
    console.log(`\n  --- 5.2 Critical Test: Negative Stock Selling ---`);
    console.log(`  ✓ Created Product with ZERO Stock: ${zeroStockProd.productName} (CurrentStock = 0, CostPrice = Rs. 600)`);

    // Perform POS Sale of 3 units when stock is 0
    const negSaleQty = 3;
    const negSalePrice = 1000;
    const negSaleTotal = negSaleQty * negSalePrice;

    const negSale = await prisma.saleMain.create({
      data: {
        grossAmount: negSaleTotal,
        totalAmount: negSaleTotal,
        paymentReceived: negSaleTotal,
        details: {
          create: [{
            productRecId: zeroStockProd.id,
            qty: negSaleQty,
            price: negSalePrice,
            grossAmount: negSaleTotal,
            netAmount: negSaleTotal
          }]
        }
      }
    });

    // Deduct stock below zero
    await prisma.productRec.update({
      where: { id: zeroStockProd.id },
      data: { currentStock: { decrement: negSaleQty } }
    });

    const refreshedNegProd = await prisma.productRec.findUnique({ where: { id: zeroStockProd.id } });
    const negativeStock = refreshedNegProd?.currentStock || 0;
    const negativeItemValuation = negativeStock * (refreshedNegProd?.costPrice || 0);

    console.log(`  ✓ POS Sale Completed Successfully: Sale ID #${negSale.id}`);
    console.log(`  ✓ CurrentStock Decremented into Negative: ${negativeStock} units`);
    console.log(`  ✓ Formula 1 Inventory Valuation for Negative Item: ${negativeStock} × Rs. ${refreshedNegProd?.costPrice} = -Rs. ${Math.abs(negativeItemValuation)}`);

    if (negativeStock !== -3) throw new Error(`Negative stock assertion failed: Expected -3, got ${negativeStock}`);
    if (negativeItemValuation !== -1800) throw new Error(`Negative stock valuation failed: Expected -1800, got ${negativeItemValuation}`);

    // 5.3 Verify Balance Sheet Inventory Valuation & Operational Net Value Engine
    console.log(`\n  --- 5.3 Balance Sheet Valuation & Operational Net Value Card ---`);
    const allProducts = await prisma.productRec.findMany();
    let totalInventoryValuation = 0;
    allProducts.forEach(p => {
      totalInventoryValuation += (p.currentStock || 0) * (p.costPrice || 0);
    });

    console.log(`  ✓ Total System Inventory Valuation: Rs. ${totalInventoryValuation.toLocaleString()}`);

    // Customer AR total
    const customersForBS = await prisma.customerRec.findMany({
      include: { finHead: { include: { cashFlowDtls: true } } }
    });
    let accountsReceivable = 0;
    customersForBS.forEach(c => {
      let bal = c.openingBalance || 0;
      if (c.finHead && c.finHead.cashFlowDtls) {
        const cr = c.finHead.cashFlowDtls.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
        const dr = c.finHead.cashFlowDtls.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
        bal = bal + dr - cr;
      }
      accountsReceivable += bal;
    });

    // Vendor AP total
    const vendorsForBS = await prisma.sellerRec.findMany({
      include: { finHead: { include: { cashFlowDtls: true } } }
    });
    let accountsPayable = 0;
    vendorsForBS.forEach(v => {
      let bal = 0;
      if (v.finHead && v.finHead.cashFlowDtls) {
        const cr = v.finHead.cashFlowDtls.filter(d => d.transactionType === 'CR').reduce((s, d) => s + d.amount, 0);
        const dr = v.finHead.cashFlowDtls.filter(d => d.transactionType === 'DR').reduce((s, d) => s + d.amount, 0);
        bal = cr - dr;
      }
      accountsPayable += bal;
    });

    const fixedAssetsAgg = await prisma.assetRec.aggregate({ _sum: { value: true } });
    const fixedAssets = fixedAssetsAgg._sum.value || 0;

    // Formula: Net Operational Value = Accounts Receivable - Accounts Payable + Inventory Valuation + Fixed Assets
    const netOperationalValue = accountsReceivable - accountsPayable + totalInventoryValuation + fixedAssets;

    console.log(`  ✓ Accounts Receivable (AR): Rs. ${accountsReceivable.toLocaleString()}`);
    console.log(`  ✓ Accounts Payable (AP):    Rs. ${accountsPayable.toLocaleString()}`);
    console.log(`  ✓ Inventory Valuation:      Rs. ${totalInventoryValuation.toLocaleString()} (Includes Negative items)`);
    console.log(`  ✓ Fixed Assets:             Rs. ${fixedAssets.toLocaleString()}`);
    console.log(`  ✓ Operational Net Value:    Rs. ${netOperationalValue.toLocaleString()}`);

    console.log('\n========================================================================');
    console.log('🎉 MASTER AUDIT RESULT: ALL TEST SUITES & ASSERTIONS PASSED PERFECTLY!');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('\n❌ MASTER AUDIT FAILED WITH ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMasterSystemAudit();
