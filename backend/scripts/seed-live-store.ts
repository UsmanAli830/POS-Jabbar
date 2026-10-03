import prisma from '../db';

async function seedLiveStore() {
  console.log('================================================================================');
  console.log('       LIVE STORE SEEDER: EMPLOYEE LINKING & REAL SALES GENERATOR');
  console.log('================================================================================\n');

  try {
    // 1. Get or create active company tenant
    let company = await prisma.company.findFirst({
      where: { OR: [{ id: 53 }, { id: 1 }] }
    }) || await prisma.company.findFirst();

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'ALI Sanitary & Hardware Store',
          address: 'Plot 45, Commercial Plaza, Lahore',
          phone: '042-35551122'
        }
      });
    }

    const companyId = company.id;
    console.log(`✓ Active Company Tenant: ID #${companyId} (${company.name})`);

    // 2. Find or create Primary Store Employee
    let primaryEmp = await prisma.employeeRec.findFirst({
      where: { companyId, role: { not: 'SUPER_ADMIN' } }
    });

    if (!primaryEmp) {
      const post = await prisma.postRec.create({ data: { title: 'Senior Sales Manager', companyId } });
      primaryEmp = await prisma.employeeRec.create({
        data: {
          name: 'Ahmed Khan (Sales Lead)',
          username: 'ahmed_khan',
          baseSalary: 45000,
          commissionRate: 2,
          role: 'ADMIN',
          companyId,
          postRecId: post.id
        }
      });
    } else {
      primaryEmp = await prisma.employeeRec.update({
        where: { id: primaryEmp.id },
        data: {
          baseSalary: 45000,
          commissionRate: 2,
          companyId
        }
      });
    }

    console.log(`✓ Active Employee Updated: ID #${primaryEmp.id} (${primaryEmp.name}) | Base Salary: Rs. 45,000 | Commission: 2%`);

    // Ensure all employees of company have valid companyId
    await prisma.employeeRec.updateMany({
      where: { companyId: null },
      data: { companyId }
    });

    // 3. Ensure 3 Customer Records exist
    let cust1 = await prisma.customerRec.findFirst({ where: { companyId, custName: 'Wholesale Client A' } })
      || await prisma.customerRec.create({ data: { custName: 'Wholesale Client A', phone: '03011112233', companyId } });

    let cust2 = await prisma.customerRec.findFirst({ where: { companyId, custName: 'Al-Madina Hardware' } })
      || await prisma.customerRec.create({ data: { custName: 'Al-Madina Hardware', phone: '03022223344', companyId } });

    let cust3 = await prisma.customerRec.findFirst({ where: { companyId, custName: 'Walk-In Retail Client' } })
      || await prisma.customerRec.create({ data: { custName: 'Walk-In Retail Client', phone: '03033334455', companyId } });

    // 4. Ensure Products exist
    let prod1 = await prisma.productRec.findFirst({ where: { companyId } })
      || await prisma.productRec.create({
        data: {
          productName: 'Master PPRC Fitting 25mm',
          productCode: 'PPRC-25',
          barCode: 'BC-PPRC-25',
          costPrice: 400,
          retailPrice: 600,
          pcsPerCarton: 20,
          currentStock: 200,
          companyId
        }
      });

    // 5. Create 5 Completed Sales Invoices assigned to this Employee (Total Sales = Rs. 85,400)
    const salesData = [
      { invNo: 2001, customerId: cust3.id, total: 12000, paid: 12000 },
      { invNo: 2002, customerId: cust1.id, total: 28000, paid: 28000 },
      { invNo: 2003, customerId: cust2.id, total: 15500, paid: 15500 },
      { invNo: 2004, customerId: cust3.id, total: 9400, paid: 9400 },
      { invNo: 2005, customerId: cust1.id, total: 20500, paid: 20500 }
    ];

    for (const s of salesData) {
      const existing = await prisma.saleMain.findFirst({ where: { companyId, invoiceNumber: s.invNo } });
      if (!existing) {
        await prisma.saleMain.create({
          data: {
            invoiceNumber: s.invNo,
            customerRec: { connect: { id: s.customerId } },
            salesman: { connect: { id: primaryEmp.id } },
            company: { connect: { id: companyId } },
            grossAmount: s.total,
            totalAmount: s.total,
            paymentReceived: s.paid,
            details: {
              create: [
                { productRecId: prod1.id, qty: Math.round(s.total / 600), price: 600, grossAmount: s.total, netAmount: s.total }
              ]
            }
          }
        });
      } else {
        await prisma.saleMain.update({
          where: { id: existing.id },
          data: {
            salesman: { connect: { id: primaryEmp.id } },
            totalAmount: s.total,
            paymentReceived: s.paid
          }
        });
      }
    }

    console.log(`✓ 5 Realistic Sales Invoices Created & Assigned to Salesman #${primaryEmp.id}`);
    console.log(`✓ Metrics Generated: Total Sales = Rs. 85,400 | Invoices = 5 | Commission (2%) = Rs. 1,708`);

    console.log('\n================================================================================');
    console.log('🎉 LIVE STORE SEEDER EXECUTED CLEANLY!');
    console.log('================================================================================\n');

  } catch (err: any) {
    console.error('SEEDER FAILURE:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedLiveStore();
