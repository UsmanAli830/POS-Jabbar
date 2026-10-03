import prisma from '../db';
import bcrypt from 'bcryptjs';

async function masterStoreSync() {
  console.log('================================================================================');
  console.log('       MASTER STORE SYNC: ALL TENANTS & EMPLOYEES HARDWARE STORE SYNC');
  console.log('================================================================================\n');

  try {
    // 1. Target Company
    let targetCompany = await prisma.company.findFirst({
      where: { OR: [{ id: 53 }, { name: { contains: 'ALI' } }] }
    });

    if (!targetCompany) {
      targetCompany = await prisma.company.create({
        data: {
          id: 53,
          name: 'ALI Sanitary & Hardware Store',
          address: 'Plot 45, Commercial Market, Lahore',
          phone: '042-35551122'
        }
      });
    }

    const companyId = targetCompany.id;

    // 2. Set all non-SUPER_ADMIN employees to target Company ID (or link them)
    await prisma.employeeRec.updateMany({
      where: { role: { not: 'SUPER_ADMIN' } },
      data: { companyId }
    });

    const activeEmployees = await prisma.employeeRec.findMany({
      where: { companyId, role: { not: 'SUPER_ADMIN' } },
      include: { postRec: true }
    });

    console.log(`✓ Synchronized ${activeEmployees.length} active store employees to Company #${companyId}`);

    // Update primary employee base salary & commission
    if (activeEmployees.length > 0) {
      await prisma.employeeRec.updateMany({
        where: { companyId },
        data: { baseSalary: 45000, commissionRate: 2 }
      });
    }

    // 3. Ensure Products exist for companyId
    let pCat = await prisma.pCat.findFirst({ where: { companyId } }) 
      || await prisma.pCat.create({ data: { name: 'Sanitary & Hardware', companyId } });

    let prod = await prisma.productRec.findFirst({ where: { companyId } });
    if (!prod) {
      prod = await prisma.productRec.create({
        data: {
          productName: 'PPRC Pipe 25mm 13ft',
          productCode: 'PPRC-25MM-SYNC',
          barCode: 'BC-PPRC-SYNC',
          costPrice: 400,
          retailPrice: 600,
          pcsPerCarton: 20,
          currentStock: 500,
          pCatId: pCat.id,
          companyId
        }
      });
    }

    // 4. Ensure Customer exists
    let cust = await prisma.customerRec.findFirst({ where: { companyId } });
    if (!cust) {
      cust = await prisma.customerRec.create({
        data: { custName: 'Commercial Wholesale Client', phone: '03001234567', companyId }
      });
    }

    // 5. Populate Completed Sales Invoices for ALL employees in companyId
    const primaryEmpId = activeEmployees[0]?.id;

    const salesSpecs = [
      { invNo: 8001, total: 12000, paid: 12000 },
      { invNo: 8002, total: 28000, paid: 28000 },
      { invNo: 8003, total: 15500, paid: 15500 },
      { invNo: 8004, total: 9400, paid: 9400 },
      { invNo: 8005, total: 20500, paid: 20500 }
    ];

    for (const s of salesSpecs) {
      const existing = await prisma.saleMain.findFirst({ where: { companyId, invoiceNumber: s.invNo } });
      if (!existing && primaryEmpId) {
        await prisma.saleMain.create({
          data: {
            invoiceNumber: s.invNo,
            customerRec: { connect: { id: cust.id } },
            salesman: { connect: { id: primaryEmpId } },
            company: { connect: { id: companyId } },
            grossAmount: s.total,
            totalAmount: s.total,
            paymentReceived: s.paid,
            details: {
              create: [
                { productRecId: prod.id, qty: Math.round(s.total / 600), price: 600, grossAmount: s.total, netAmount: s.total }
              ]
            }
          }
        });
      } else if (existing && primaryEmpId) {
        await prisma.saleMain.update({
          where: { id: existing.id },
          data: { salesmanId: primaryEmpId, totalAmount: s.total, paymentReceived: s.paid }
        });
      }
    }

    // Link any orphaned saleMain records to primaryEmpId
    if (primaryEmpId) {
      await prisma.saleMain.updateMany({
        where: { salesmanId: null },
        data: { salesmanId: primaryEmpId }
      });
    }

    // 6. Ensure Attendance for Today for all active employees
    const startOfDay = new Date(new Date().setHours(0,0,0,0));
    const endOfDay = new Date(new Date().setHours(23,59,59,999));
    let presStatus = await prisma.attandenceStatus.findFirst({ where: { status: 'Present' } }) || await prisma.attandenceStatus.create({ data: { status: 'Present' } });

    for (const emp of activeEmployees) {
      const existingAtt = await prisma.empAttandence.findFirst({
        where: { employeeRecId: emp.id, date: { gte: startOfDay, lte: endOfDay } }
      });
      if (!existingAtt) {
        await prisma.empAttandence.create({
          data: {
            date: new Date(),
            employeeRecId: emp.id,
            statusId: presStatus.id,
            statusText: 'PRESENT',
            lateMinutes: 0
          }
        });
      }
    }

    // 7. Ensure Advance Salaries for top 2 employees
    if (activeEmployees.length >= 2) {
      const emp1 = activeEmployees[0];
      const emp2 = activeEmployees[1];

      const adv1 = await prisma.empAdvanceSalary.findFirst({ where: { employeeRecId: emp1.id } });
      if (!adv1) {
        await prisma.empAdvanceSalary.create({
          data: { employeeRecId: emp1.id, amount: 5000, remarks: 'Emergency Family Advance', status: 'PENDING_ADJUSTMENT' }
        });
      }

      const adv2 = await prisma.empAdvanceSalary.findFirst({ where: { employeeRecId: emp2.id } });
      if (!adv2) {
        await prisma.empAdvanceSalary.create({
          data: { employeeRecId: emp2.id, amount: 3000, remarks: 'Monthly Allowance Advance', status: 'PENDING_ADJUSTMENT' }
        });
      }
    }

    console.log(`✓ Master Synchronization Completed! Total Company Sales: Rs. 85,400+ | Attendance & Advances Linked`);

  } catch (err: any) {
    console.error('MASTER STORE SYNC ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

masterStoreSync();
