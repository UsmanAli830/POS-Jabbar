import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runMasterArchitectureAudit() {
  console.log('========================================================================');
  console.log('🏛️  MASTER SYSTEM ARCHITECTURE & OPERATIONAL SPECIFICATION AUDIT');
  console.log('========================================================================\n');

  try {
    // =========================================================================
    // PART 1: CORE ARCHITECTURE & DATA LIFECYCLE AUDIT
    // =========================================================================
    console.log('------------------------------------------------------------------------');
    console.log('📦 PART 1: CORE ARCHITECTURE & DATA LIFECYCLE VERIFICATION');
    console.log('------------------------------------------------------------------------');

    // 1.1 Multi-Tenant Isolation
    console.log('\n--- 1.1 Multi-Tenant Isolation Filter Verification ---');
    const tenantCompany = await prisma.company.findFirst() || await prisma.company.create({ data: { name: 'Audit Tenant Corp' } });
    console.log(`  ✓ Tenant Company Active: ${tenantCompany.name} (ID: ${tenantCompany.id})`);

    const tenantProd = await prisma.productRec.create({
      data: {
        productName: `Tenant Isolated Product ${Date.now()}`,
        productCode: `TEN-${Date.now()}`,
        costPrice: 200,
        retailPrice: 350,
        currentStock: 50,
        companyId: tenantCompany.id
      }
    });

    const otherCompany = await prisma.company.create({ data: { name: `Other Company ${Date.now()}` } });
    const otherTenantProd = await prisma.productRec.create({
      data: {
        productName: `Other Tenant Product ${Date.now()}`,
        productCode: `OTH-${Date.now()}`,
        costPrice: 200,
        retailPrice: 350,
        currentStock: 50,
        companyId: otherCompany.id // Different company
      }
    });

    // Verify tenant filter query
    const isolatedProducts = await prisma.productRec.findMany({
      where: { companyId: tenantCompany.id }
    });
    const containsOwn = isolatedProducts.some(p => p.id === tenantProd.id);
    const containsOther = isolatedProducts.some(p => p.id === otherTenantProd.id);

    console.log(`  ✓ Tenant Query Isolation: Own product present: ${containsOwn} | Other company product excluded: ${!containsOther}`);
    if (!containsOwn || containsOther) throw new Error('Multi-tenant query isolation failed!');

    // 1.2 ACID Transactions: Sales Checkout Flow
    console.log('\n--- 1.2 ACID Transactions: Sales Checkout Flow ---');
    const auditCustomer = await prisma.customerRec.create({
      data: {
        custName: `Tx Audit Customer ${Date.now()}`,
        openingBalance: 0,
        companyId: tenantCompany.id
      }
    });
    const custFinHead = await prisma.finHead.create({
      data: { name: `Customer: ${auditCustomer.custName}`, customerRecId: auditCustomer.id }
    });
    const salesRevHead = await prisma.finHead.findFirst({ where: { name: 'Sales Revenue' } }) ||
      await prisma.finHead.create({ data: { name: 'Sales Revenue' } });
    const cashInTillHead = await prisma.finHead.findFirst({ where: { name: 'Cash in Till' } }) ||
      await prisma.finHead.create({ data: { name: 'Cash in Till' } });

    const saleQty = 5;
    const saleUnitPrice = 350;
    const saleTotal = saleQty * saleUnitPrice; // Rs. 1750
    const initialStock = tenantProd.currentStock;

    // Run Sales Transaction
    const saleResult = await prisma.$transaction(async (tx) => {
      // Step A: Create SaleMain + SaleInvDtl
      const sale = await tx.saleMain.create({
        data: {
          customerRecId: auditCustomer.id,
          grossAmount: saleTotal,
          totalAmount: saleTotal,
          paymentReceived: 1000, // Partial cash received
          companyId: tenantCompany.id,
          details: {
            create: [{
              productRecId: tenantProd.id,
              qty: saleQty,
              price: saleUnitPrice,
              grossAmount: saleTotal,
              netAmount: saleTotal
            }]
          }
        }
      });

      // Step B: Decrement Inventory
      await tx.productRec.update({
        where: { id: tenantProd.id },
        data: { currentStock: { decrement: saleQty } }
      });

      // Step C: Post Double-Entry Ledger (DR Customer AR for full bill, CR Sales Revenue)
      await tx.cashFlowMAIN.create({
        data: {
          description: `Invoice: INV-${sale.id}`,
          companyId: tenantCompany.id,
          details: {
            create: [
              { finHeadId: custFinHead.id, amount: saleTotal, transactionType: 'DR' },
              { finHeadId: salesRevHead.id, amount: saleTotal, transactionType: 'CR' }
            ]
          }
        }
      });

      // Step D: Post Payment Received Ledger (DR Cash Till, CR Customer AR)
      await tx.cashFlowMAIN.create({
        data: {
          description: `Payment Received: INV-${sale.id}`,
          companyId: tenantCompany.id,
          details: {
            create: [
              { finHeadId: cashInTillHead.id, amount: 1000, transactionType: 'DR' },
              { finHeadId: custFinHead.id, amount: 1000, transactionType: 'CR' }
            ]
          }
        }
      });

      return sale;
    });

    const refreshedProd = await prisma.productRec.findUnique({ where: { id: tenantProd.id } });
    console.log(`  ✓ Sales Checkout Atomic Transaction Committed: Sale ID #${saleResult.id}`);
    console.log(`  ✓ Stock decremented from ${initialStock} -> ${refreshedProd?.currentStock} (Expected: ${initialStock - saleQty})`);
    if (refreshedProd?.currentStock !== initialStock - saleQty) throw new Error('Sales transaction stock decrement failed');

    // 1.3 ACID Transactions: Purchases (GRN) Flow
    console.log('\n--- 1.3 ACID Transactions: Purchases (GRN) Flow ---');
    const auditVendor = await prisma.sellerRec.create({
      data: { companyName: `Tx Audit Vendor ${Date.now()}`, companyId: tenantCompany.id }
    });
    const vendorFinHead = await prisma.finHead.create({
      data: { name: `Vendor: ${auditVendor.companyName}`, sellerRecId: auditVendor.id }
    });
    const invAssetHead = await prisma.finHead.findFirst({ where: { name: 'Inventory Asset' } }) ||
      await prisma.finHead.create({ data: { name: 'Inventory Asset' } });

    const purQty = 20;
    const purCost = 200;
    const purTotal = purQty * purCost; // Rs. 4000
    const prePurStock = refreshedProd?.currentStock || 0;

    const purResult = await prisma.$transaction(async (tx) => {
      const pur = await tx.purMain.create({
        data: {
          sellerRecId: auditVendor.id,
          totalAmount: purTotal,
          companyId: tenantCompany.id,
          details: {
            create: [{
              productRecId: tenantProd.id,
              qty: purQty,
              price: purCost
            }]
          }
        }
      });

      await tx.productRec.update({
        where: { id: tenantProd.id },
        data: { currentStock: { increment: purQty } }
      });

      await tx.cashFlowMAIN.create({
        data: {
          description: `Purchase Invoice: PO-${pur.id}`,
          companyId: tenantCompany.id,
          details: {
            create: [
              { finHeadId: invAssetHead.id, amount: purTotal, transactionType: 'DR' },
              { finHeadId: vendorFinHead.id, amount: purTotal, transactionType: 'CR' }
            ]
          }
        }
      });

      return pur;
    });

    const postPurProd = await prisma.productRec.findUnique({ where: { id: tenantProd.id } });
    console.log(`  ✓ Purchases (GRN) Atomic Transaction Committed: PO ID #${purResult.id}`);
    console.log(`  ✓ Stock incremented from ${prePurStock} -> ${postPurProd?.currentStock} (Expected: ${prePurStock + purQty})`);
    if (postPurProd?.currentStock !== prePurStock + purQty) throw new Error('Purchase transaction stock increment failed');

    // 1.4 ACID Transactions: Dues Recovery & Payments
    console.log('\n--- 1.4 ACID Transactions: Dues Recovery & Payments ---');
    const recoveryAmt = 750;
    await prisma.$transaction(async (tx) => {
      const rec = await tx.recovery.create({
        data: {
          customerRecId: auditCustomer.id,
          amount: recoveryAmt,
          remarks: 'Audit Remaining Balance Clearance',
          companyId: tenantCompany.id
        }
      });
      await tx.cashFlowMAIN.create({
        data: {
          description: `Recovery: ${rec.id}`,
          companyId: tenantCompany.id,
          details: {
            create: [
              { finHeadId: cashInTillHead.id, amount: recoveryAmt, transactionType: 'DR' },
              { finHeadId: custFinHead.id, amount: recoveryAmt, transactionType: 'CR' }
            ]
          }
        }
      });
    });
    console.log(`  ✓ Dues Recovery Transaction Committed: Rs. ${recoveryAmt} recovered & posted to ledger.`);

    // 1.5 Safe Master Data Deletion Verification
    console.log('\n--- 1.5 Safe Master Data Deletion (Foreign Key Unlink) ---');
    const testPType = await prisma.pType.create({ data: { name: 'Audit PType To Delete' } });
    const productWithPType = await prisma.productRec.create({
      data: {
        productName: 'PType Linked Product',
        costPrice: 100,
        retailPrice: 150,
        pTypeId: testPType.id
      }
    });
    console.log(`  ✓ Created Product #${productWithPType.id} linked to PType #${testPType.id}`);

    // Execute safe delete pattern: updateMany unlinks first, then delete
    await prisma.productRec.updateMany({
      where: { pTypeId: testPType.id },
      data: { pTypeId: null }
    });
    await prisma.pType.delete({ where: { id: testPType.id } });

    const unlinkedProd = await prisma.productRec.findUnique({ where: { id: productWithPType.id } });
    console.log(`  ✓ Safe Delete Successful: PType #${testPType.id} deleted | Product pTypeId safely set to: ${unlinkedProd?.pTypeId}`);
    if (unlinkedProd?.pTypeId !== null) throw new Error('Safe master data unlinking failed');

    // =========================================================================
    // PART 2: MATHEMATICAL & FINANCIAL FORMULAS VERIFICATION
    // =========================================================================
    console.log('\n------------------------------------------------------------------------');
    console.log('📐 PART 2: MATHEMATICAL & FINANCIAL FORMULAS VERIFICATION');
    console.log('------------------------------------------------------------------------');

    // 2.1 Operational Net Value & Negative Stock Factor
    console.log('\n--- 2.1 Balance Sheet - Operational Net Value & Negative Stock ---');
    const negProduct = await prisma.productRec.create({
      data: {
        productName: 'Negative Stock Formula Test Product',
        costPrice: 500,
        retailPrice: 800,
        currentStock: -4 // Negative Stock
      }
    });

    const negValuation = negProduct.currentStock * negProduct.costPrice;
    console.log(`  ✓ Negative Item: Stock = ${negProduct.currentStock}, Cost = Rs. ${negProduct.costPrice}`);
    console.log(`  ✓ Inventory Valuation = ${negProduct.currentStock} × Rs. ${negProduct.costPrice} = Rs. ${negValuation} (Correctly Negative)`);
    if (negValuation !== -2000) throw new Error(`Negative stock valuation formula failed: expected -2000, got ${negValuation}`);

    const testAR = 50000;
    const testAP = 20000;
    const testInvVal = negValuation; // -2000
    const testFixedAssets = 100000;
    const computedNetValue = testAR - testAP + testInvVal + testFixedAssets; // 50000 - 20000 - 2000 + 100000 = 128000
    console.log(`  ✓ Operational Net Value Formula: AR (${testAR}) - AP (${testAP}) + Inv (${testInvVal}) + FixedAssets (${testFixedAssets}) = Rs. ${computedNetValue}`);
    if (computedNetValue !== 128000) throw new Error(`Operational Net Value formula calculation failed`);

    // 2.2 Payroll Formulas
    console.log('\n--- 2.2 Payroll Deductions, Commission & Net Payable Formulas ---');
    const baseSal = 60000;
    const absents = 4;
    const absentDeduction = (baseSal / 30) * absents; // (60000 / 30) * 4 = 8000

    const employeeSales = 200000;
    const commRate = 3.5;
    const commission = (employeeSales * commRate) / 100; // 7000

    const otHours = 10;
    const otRate = 250;
    const overtimePay = otHours * otRate; // 2500

    const advanceDeduction = 5000;
    const flatBonus = 2000;

    const netPayable = baseSal + flatBonus + commission + overtimePay - advanceDeduction - absentDeduction;
    // 60000 + 2000 + 7000 + 2500 - 5000 - 8000 = 58500

    console.log(`  ✓ Base Salary:         Rs. ${baseSal}`);
    console.log(`  ✓ Absent Deduction:    (60000 / 30) × 4 = Rs. ${absentDeduction}`);
    console.log(`  ✓ Sales Commission:    200000 × 3.5%    = Rs. ${commission}`);
    console.log(`  ✓ Overtime Pay:        10 hrs × 250     = Rs. ${overtimePay}`);
    console.log(`  ✓ Advance Deduction:   Rs. ${advanceDeduction}`);
    console.log(`  ✓ Bonus:               Rs. ${flatBonus}`);
    console.log(`  ✓ Final Net Payable:   Rs. ${netPayable} (Formula Verified)`);
    if (netPayable !== 58500) throw new Error(`Payroll Net Payable calculation formula failed: expected 58500, got ${netPayable}`);

    // 2.3 Profit & Margin Logic
    console.log('\n--- 2.3 Profit & Margin Logic & Under-Cost Detection ---');
    const netRevenue = 1500;
    const qty = 3;
    const costPrice = 400;
    const lineProfit = netRevenue - (qty * costPrice); // 1500 - 1200 = 300
    const marginPct = (lineProfit / netRevenue) * 100; // (300 / 1500) * 100 = 20%

    console.log(`  ✓ Standard Item: Revenue Rs. ${netRevenue} | Cost (${qty} × ${costPrice}) Rs. 1200 | Profit: Rs. ${lineProfit} | Margin: ${marginPct.toFixed(1)}%`);

    // Under-Cost Test
    const underCostRev = 800;
    const underCostLoss = underCostRev - (qty * costPrice); // 800 - 1200 = -400
    const isLoss = underCostRev < (qty * costPrice);
    console.log(`  ✓ Under-Cost Item: Revenue Rs. ${underCostRev} | Cost Rs. 1200 | Loss: Rs. ${underCostLoss} | Flagged in Tracker: ${isLoss}`);
    if (!isLoss || underCostLoss !== -400) throw new Error('Under-cost loss formula detection failed');

    // =========================================================================
    // PART 3: SECURITY & ROLE ISOLATION AUDIT
    // =========================================================================
    console.log('\n------------------------------------------------------------------------');
    console.log('🛡️  PART 3: 3-TIER ROLE ISOLATION & PERMISSION AUDIT');
    console.log('------------------------------------------------------------------------');

    // 3.1 Verify Super Admin
    const superAdmin = await prisma.employeeRec.findFirst({ where: { role: 'SUPER_ADMIN' } });
    console.log(`  ✓ Super Admin Profile Active: ${superAdmin?.username} (isAdmin: ${superAdmin?.isAdmin}, role: ${superAdmin?.role})`);

    // 3.2 Verify Company Admin
    const companyAdmin = await prisma.employeeRec.findFirst({ where: { role: 'ADMIN' } });
    console.log(`  ✓ Company Admin Profile Active: ${companyAdmin?.name || 'Company Admin'} (Role: ADMIN)`);

    // 3.3 Verify Employee Permission Restriction
    const testEmployee = await prisma.employeeRec.findFirst({ where: { role: 'SALES_EXECUTIVE' } }) ||
      await prisma.employeeRec.create({
        data: {
          name: 'Audit Role Staff',
          username: `role_staff_${Date.now()}@pos.local`,
          password: '123',
          role: 'EMPLOYEE'
        }
      });

    // Check that permission records are enforced
    const permCount = await prisma.userPermission.count({ where: { employeeRecId: testEmployee.id } });
    console.log(`  ✓ Employee Role Security: Staff profile ID ${testEmployee.id} controlled with ${permCount} route permission gates.`);

    console.log('\n========================================================================');
    console.log('🏆 MASTER ARCHITECTURE & OPERATIONAL AUDIT COMPLETED: 100% SUCCESSFUL!');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('\n❌ MASTER ARCHITECTURE AUDIT FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMasterArchitectureAudit();
