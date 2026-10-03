import prisma from '../db';
import bcrypt from 'bcryptjs';

async function populateLiveBrowserStore() {
  console.log('================================================================================');
  console.log('       LIVE UI POPULATOR: ACTIVE COMPANY TENANT SEEDER FOR BROWSER DEMO');
  console.log('================================================================================\n');

  try {
    // 1. Ensure or find Target Company (ALI Sanitary & Hardware Store)
    let company = await prisma.company.findFirst({
      where: { OR: [{ id: 1 }, { name: { contains: 'ALI' } }] }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          id: 1,
          name: 'ALI Sanitary & Hardware Store',
          address: 'Plot 45, Commercial Market, Lahore',
          phone: '042-35551122',
          contactPerson: 'Ali Raza (Owner)',
          email: 'info@alisanitary.com'
        }
      });
    } else {
      company = await prisma.company.update({
        where: { id: company.id },
        data: {
          name: 'ALI Sanitary & Hardware Store',
          address: 'Plot 45, Commercial Market, Lahore',
          phone: '042-35551122'
        }
      });
    }

    const companyId = company.id;
    console.log(`✓ Target Company Tenant Active: ID #${companyId} (${company.name})`);

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 2. Ensure Post/Category definitions
    let cashierPost = await prisma.postRec.findFirst({ where: { title: 'Cashier Staff', companyId } }) 
      || await prisma.postRec.create({ data: { title: 'Cashier Staff', companyId } });
    let salesmanPost = await prisma.postRec.findFirst({ where: { title: 'Senior Salesman', companyId } }) 
      || await prisma.postRec.create({ data: { title: 'Senior Salesman', companyId } });
    let managerPost = await prisma.postRec.findFirst({ where: { title: 'Store Manager', companyId } }) 
      || await prisma.postRec.create({ data: { title: 'Store Manager', companyId } });
    let inventoryPost = await prisma.postRec.findFirst({ where: { title: 'Inventory Officer', companyId } }) 
      || await prisma.postRec.create({ data: { title: 'Inventory Officer', companyId } });
    let accountsPost = await prisma.postRec.findFirst({ where: { title: 'Accounts Officer', companyId } }) 
      || await prisma.postRec.create({ data: { title: 'Accounts Officer', companyId } });

    // 3. Create / Update 5 Real Employees
    const empDefs = [
      { name: 'Ahmed Khan', username: 'ahmed_cashier', phone: '03001112233', baseSalary: 38000, postRecId: cashierPost.id, commissionRate: 1 },
      { name: 'Bilal Tariq', username: 'bilal_sales', phone: '03002223344', baseSalary: 42000, postRecId: salesmanPost.id, commissionRate: 2 },
      { name: 'Usman Ali', username: 'usman_mgr', phone: '03003334455', baseSalary: 55000, postRecId: managerPost.id, commissionRate: 3 },
      { name: 'Hamza Sheikh', username: 'hamza_inv', phone: '03004445566', baseSalary: 35000, postRecId: inventoryPost.id, commissionRate: 1 },
      { name: 'Zubair Ahmad', username: 'zubair_accts', phone: '03005556677', baseSalary: 48000, postRecId: accountsPost.id, commissionRate: 1.5 }
    ];

    const createdEmployees = [];
    for (const emp of empDefs) {
      let existing = await prisma.employeeRec.findFirst({ where: { username: emp.username } });
      if (existing) {
        existing = await prisma.employeeRec.update({
          where: { id: existing.id },
          data: { name: emp.name, baseSalary: emp.baseSalary, companyId, postRecId: emp.postRecId }
        });
      } else {
        existing = await prisma.employeeRec.create({
          data: {
            name: emp.name,
            username: emp.username,
            password: hashedPassword,
            phone: emp.phone,
            baseSalary: emp.baseSalary,
            commissionRate: emp.commissionRate,
            role: 'EMPLOYEE',
            companyId,
            postRecId: emp.postRecId
          }
        });
      }
      createdEmployees.push(existing);
    }
    console.log(`✓ 5 Store Employees Seeded & Linked to Company #${companyId}`);

    // Also link any standalone employees with null companyId to this active companyId so all endpoints list them
    await prisma.employeeRec.updateMany({
      where: { companyId: null },
      data: { companyId }
    });

    // 4. Seed Daily Attendance for Today
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    const startOfDay = new Date(new Date().setHours(0,0,0,0));
    const endOfDay = new Date(new Date().setHours(23,59,59,999));

    // Attendance statuses
    let presStatus = await prisma.attandenceStatus.findFirst({ where: { status: 'Present' } }) || await prisma.attandenceStatus.create({ data: { status: 'Present' } });
    let absStatus = await prisma.attandenceStatus.findFirst({ where: { status: 'Absent' } }) || await prisma.attandenceStatus.create({ data: { status: 'Absent' } });
    let lateStatus = await prisma.attandenceStatus.findFirst({ where: { status: 'Late' } }) || await prisma.attandenceStatus.create({ data: { status: 'Late' } });
    let halfStatus = await prisma.attandenceStatus.findFirst({ where: { status: 'Half-Day' } }) || await prisma.attandenceStatus.create({ data: { status: 'Half-Day' } });

    const attSpecs = [
      { empId: createdEmployees[0].id, statusId: presStatus.id, statusText: 'PRESENT', lateMinutes: 0 },
      { empId: createdEmployees[1].id, statusId: presStatus.id, statusText: 'PRESENT', lateMinutes: 0 },
      { empId: createdEmployees[2].id, statusId: lateStatus.id, statusText: 'LATE', lateMinutes: 20 },
      { empId: createdEmployees[3].id, statusId: absStatus.id, statusText: 'ABSENT', lateMinutes: 0 },
      { empId: createdEmployees[4].id, statusId: halfStatus.id, statusText: 'HALFDAY', lateMinutes: 0 }
    ];

    for (const spec of attSpecs) {
      const existingAtt = await prisma.empAttandence.findFirst({
        where: { employeeRecId: spec.empId, date: { gte: startOfDay, lte: endOfDay } }
      });
      if (existingAtt) {
        await prisma.empAttandence.update({
          where: { id: existingAtt.id },
          data: { statusId: spec.statusId, statusText: spec.statusText, lateMinutes: spec.lateMinutes }
        });
      } else {
        await prisma.empAttandence.create({
          data: {
            date: today,
            employeeRecId: spec.empId,
            statusId: spec.statusId,
            statusText: spec.statusText,
            lateMinutes: spec.lateMinutes
          }
        });
      }
    }
    console.log(`✓ Today's Daily Attendance Sheet Populated (${attSpecs.length} records)`);

    // 5. Seed Advance Salary Records
    const existingAdv = await prisma.empAdvanceSalary.findMany({ where: { employeeRecId: createdEmployees[0].id } });
    if (existingAdv.length === 0) {
      await prisma.empAdvanceSalary.create({
        data: {
          employeeRecId: createdEmployees[0].id,
          amount: 5000,
          remarks: 'Emergency Medical Advance for Family',
          status: 'PENDING_ADJUSTMENT'
        }
      });
      await prisma.empAdvanceSalary.create({
        data: {
          employeeRecId: createdEmployees[1].id,
          amount: 3000,
          remarks: 'Children School Fee Assistance',
          status: 'PENDING_ADJUSTMENT'
        }
      });
    }
    console.log(`✓ Historical Advance Salary Records Logged (2 Active Advances)`);

    // 6. Seed Product Categories & 8 Real Sanitary/Hardware Products
    let pCatSanitary = await prisma.pCat.findFirst({ where: { name: 'Pipes & Fittings', companyId } }) 
      || await prisma.pCat.create({ data: { name: 'Pipes & Fittings', companyId } });
    let pCatTaps = await prisma.pCat.findFirst({ where: { name: 'Taps & Mixers', companyId } }) 
      || await prisma.pCat.create({ data: { name: 'Taps & Mixers', companyId } });

    const prodDefs = [
      { name: 'PPRC Pipe 25mm 13ft', code: 'PPRC-25MM', barcode: 'BAR-PPRC-25', cost: 450, retail: 650, ws: 580, pcsCtn: 20, stock: 200, catId: pCatSanitary.id },
      { name: 'Brass Ball Valve 1/2 inch', code: 'VALVE-BR-12', barcode: 'BAR-VALVE-12', cost: 350, retail: 520, ws: 460, pcsCtn: 50, stock: 250, catId: pCatSanitary.id },
      { name: 'Master Mixer Tap Chrome', code: 'TAP-MIX-CH', barcode: 'BAR-TAP-MIX', cost: 2400, retail: 3500, ws: 3000, pcsCtn: 10, stock: 60, catId: pCatTaps.id },
      { name: 'CPVC Elbow 1 inch Heavy', code: 'CPVC-ELB-1', barcode: 'BAR-CPVC-1', cost: 60, retail: 110, ws: 85, pcsCtn: 100, stock: 500, catId: pCatSanitary.id },
      { name: 'Stainless Steel Kitchen Sink', code: 'SINK-SS-DBL', barcode: 'BAR-SINK-DBL', cost: 6500, retail: 9500, ws: 8200, pcsCtn: 5, stock: 25, catId: pCatSanitary.id },
      { name: 'Gate Valve Heavy Duty 2 inch', code: 'GATE-V-2IN', barcode: 'BAR-GATE-2', cost: 1800, retail: 2600, ws: 2200, pcsCtn: 8, stock: 40, catId: pCatSanitary.id },
      { name: 'PVC Flexible Waste Pipe 1.5m', code: 'WASTE-PVC-15', barcode: 'BAR-WASTE-15', cost: 120, retail: 220, ws: 170, pcsCtn: 30, stock: 150, catId: pCatSanitary.id },
      { name: 'Pillar Tap Classic Brass', code: 'TAP-PIL-BR', barcode: 'BAR-TAP-PIL', cost: 1100, retail: 1650, ws: 1400, pcsCtn: 12, stock: 72, catId: pCatTaps.id }
    ];

    const createdProducts = [];
    for (const p of prodDefs) {
      let existing = await prisma.productRec.findFirst({ where: { productCode: p.code, companyId } });
      if (!existing) {
        existing = await prisma.productRec.create({
          data: {
            productName: p.name,
            productCode: p.code,
            barCode: p.barcode,
            costPrice: p.cost,
            retailPrice: p.retail,
            wholeSalePrice: p.ws,
            pcsPerCarton: p.pcsCtn,
            cartonCostPrice: p.cost * p.pcsCtn,
            cartonRetailPrice: p.retail * p.pcsCtn,
            cartonWsPrice: p.ws * p.pcsCtn,
            currentStock: p.stock,
            pCatId: p.catId,
            companyId
          }
        });
      }
      createdProducts.push(existing);
    }
    console.log(`✓ 8 Hardware & Sanitary Products Cataloged with Carton Configurations`);

    // 7. Seed Customers
    let cust1 = await prisma.customerRec.findFirst({ where: { custName: 'SuperMart Construction', companyId } }) 
      || await prisma.customerRec.create({ data: { custName: 'SuperMart Construction', phone: '03018889900', companyId } });
    let cust2 = await prisma.customerRec.findFirst({ where: { custName: 'Al-Madina Builders', companyId } }) 
      || await prisma.customerRec.create({ data: { custName: 'Al-Madina Builders', phone: '03027778899', companyId } });
    let cust3 = await prisma.customerRec.findFirst({ where: { custName: 'Walk-In Customer Retail', companyId } }) 
      || await prisma.customerRec.create({ data: { custName: 'Walk-In Customer Retail', phone: '03036667788', companyId } });

    // 8. Seed Completed POS Sales & Pending Credit Sales
    const existingSales = await prisma.saleMain.findMany({ where: { companyId } });
    if (existingSales.length < 5) {
      // Sale 1: Completed Cash Sale
      await prisma.saleMain.create({
        data: {
          invoiceNumber: 1001,
          customerRecId: cust3.id,
          grossAmount: 12500,
          totalAmount: 12500,
          paymentReceived: 12500,
          companyId,
          details: {
            create: [
              { productRecId: createdProducts[2].id, qty: 2, price: 3500, grossAmount: 7000, netAmount: 7000 },
              { productRecId: createdProducts[1].id, qty: 10, price: 550, grossAmount: 5500, netAmount: 5500 }
            ]
          }
        }
      });

      // Sale 2: Completed Cash Sale
      await prisma.saleMain.create({
        data: {
          invoiceNumber: 1002,
          customerRecId: cust3.id,
          grossAmount: 19000,
          totalAmount: 19000,
          paymentReceived: 19000,
          companyId,
          details: {
            create: [
              { productRecId: createdProducts[4].id, qty: 2, price: 9500, grossAmount: 19000, netAmount: 19000 }
            ]
          }
        }
      });

      // Sale 3: Completed Cash Sale with Wholesale & Delivery
      await prisma.saleMain.create({
        data: {
          invoiceNumber: 1003,
          customerRecId: cust1.id,
          grossAmount: 17400,
          deliveryCharges: 500,
          labourCharges: 200,
          totalAmount: 18100,
          paymentReceived: 18100,
          companyId,
          details: {
            create: [
              { productRecId: createdProducts[0].id, qty: 30, unitType: 'PIECE', price: 580, grossAmount: 17400, netAmount: 17400 }
            ]
          }
        }
      });

      // Sale 4: PENDING CREDIT SALE #1 (Balance Due: Rs. 15,000)
      await prisma.saleMain.create({
        data: {
          invoiceNumber: 1004,
          customerRecId: cust1.id,
          grossAmount: 25000,
          totalAmount: 25000,
          paymentReceived: 10000, // Balance Due: 15,000
          companyId,
          details: {
            create: [
              { productRecId: createdProducts[5].id, qty: 5, price: 2600, grossAmount: 13000, netAmount: 13000 },
              { productRecId: createdProducts[2].id, qty: 3, price: 3500, grossAmount: 10500, netAmount: 10500 },
              { productRecId: createdProducts[3].id, qty: 15, price: 100, grossAmount: 1500, netAmount: 1500 }
            ]
          }
        }
      });

      // Sale 5: PENDING CREDIT SALE #2 (Balance Due: Rs. 8,500)
      await prisma.saleMain.create({
        data: {
          invoiceNumber: 1005,
          customerRecId: cust2.id,
          grossAmount: 18500,
          totalAmount: 18500,
          paymentReceived: 10000, // Balance Due: 8,500
          companyId,
          details: {
            create: [
              { productRecId: createdProducts[7].id, qty: 10, price: 1650, grossAmount: 16500, netAmount: 16500 },
              { productRecId: createdProducts[6].id, qty: 10, price: 200, grossAmount: 2000, netAmount: 2000 }
            ]
          }
        }
      });

      console.log(`✓ 5 Sales Invoices Generated (3 Completed Cash, 2 Outstanding Credit Sales)`);
    }

    console.log('\n================================================================================');
    console.log('🎉 LIVE BROWSER DATABASE SEEDER COMPLETED SUCCESSFULLY!');
    console.log('================================================================================\n');

  } catch (err: any) {
    console.error('SEEDER ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

populateLiveBrowserStore();
