import prisma from '../db';

async function seedActiveStoreComplete() {
  console.log('================================================================================');
  console.log('       ACTIVE STORE SEEDER: LOGISTICS, CREDIT DUES, ATTENDANCE & ADVANCE');
  console.log('================================================================================\n');

  try {
    // 1. Find or create Active Company Tenant
    let company = await prisma.company.findFirst({
      where: { OR: [{ id: 53 }, { id: 1 }] }
    }) || await prisma.company.findFirst();

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Ammad Sanitary & Hardware Store',
          address: 'Main Wholesale Market, G.T. Road, Lahore',
          phone: '042-35551122'
        }
      });
    }

    const companyId = company.id;
    console.log(`✓ Active Company Tenant: ID #${companyId} (${company.name})`);

    // Ensure PostRecs exist for staff roles
    let managerPost = await prisma.postRec.findFirst({ where: { companyId, title: 'Sales Manager' } });
    if (!managerPost) {
      managerPost = await prisma.postRec.create({ data: { title: 'Sales Manager', companyId } });
    }

    let supervisorPost = await prisma.postRec.findFirst({ where: { companyId, title: 'Store Supervisor' } });
    if (!supervisorPost) {
      supervisorPost = await prisma.postRec.create({ data: { title: 'Store Supervisor', companyId } });
    }

    let execPost = await prisma.postRec.findFirst({ where: { companyId, title: 'Sales Executive' } });
    if (!execPost) {
      execPost = await prisma.postRec.create({ data: { title: 'Sales Executive', companyId } });
    }

    let logisticsPost = await prisma.postRec.findFirst({ where: { companyId, title: 'Logistics Officer' } });
    if (!logisticsPost) {
      logisticsPost = await prisma.postRec.create({ data: { title: 'Logistics Officer', companyId } });
    }

    let clerkPost = await prisma.postRec.findFirst({ where: { companyId, title: 'Billing Clerk' } });
    if (!clerkPost) {
      clerkPost = await prisma.postRec.create({ data: { title: 'Billing Clerk', companyId } });
    }

    // 2. Ensure 5 Staff Members exist and update logged-in primary staff (Base Salary 45,000, 2% Commission)
    const staffConfigs = [
      { name: 'Ahmed Khan (Sales Manager)', username: 'ahmed_khan', role: 'ADMIN', baseSalary: 45000, commRate: 2, postRecId: managerPost.id },
      { name: 'Muhammad Usman', username: 'usman_m', role: 'STAFF', baseSalary: 38000, commRate: 1.5, postRecId: supervisorPost.id },
      { name: 'Ali Hassan', username: 'ali_h', role: 'STAFF', baseSalary: 32000, commRate: 1.0, postRecId: execPost.id },
      { name: 'Tariq Mahmood', username: 'tariq_m', role: 'STAFF', baseSalary: 35000, commRate: 1.0, postRecId: logisticsPost.id },
      { name: 'Bilal Ahmed', username: 'bilal_a', role: 'STAFF', baseSalary: 28000, commRate: 0.5, postRecId: clerkPost.id }
    ];

    const staffMembers: any[] = [];
    for (const sc of staffConfigs) {
      let emp = await prisma.employeeRec.findFirst({
        where: { companyId, OR: [{ username: sc.username }, { name: sc.name }] }
      });

      if (!emp) {
        emp = await prisma.employeeRec.create({
          data: {
            name: sc.name,
            username: sc.username,
            baseSalary: sc.baseSalary,
            commissionRate: sc.commRate,
            role: sc.role,
            companyId,
            postRecId: sc.postRecId
          }
        });
      } else {
        emp = await prisma.employeeRec.update({
          where: { id: emp.id },
          data: {
            baseSalary: sc.baseSalary,
            commissionRate: sc.commRate,
            companyId,
            postRecId: sc.postRecId
          }
        });
      }
      staffMembers.push(emp);
    }

    const primaryEmp = staffMembers[0];
    console.log(`✓ Staff Assigned: ${primaryEmp.name} (Base Salary: Rs. 45,000 | Commission: 2%) across ${staffMembers.length} total staff members.`);

    // 3. Ensure Customer Records & Products exist
    let cust1 = await prisma.customerRec.findFirst({ where: { companyId, custName: 'Wholesale Client A' } })
      || await prisma.customerRec.create({ data: { custName: 'Wholesale Client A', phone: '0301-1112233', companyId, openingBalance: 20000 } });

    let cust2 = await prisma.customerRec.findFirst({ where: { companyId, custName: 'Al-Madina Hardware' } })
      || await prisma.customerRec.create({ data: { custName: 'Al-Madina Hardware', phone: '0302-2223344', companyId, openingBalance: 30000 } });

    let cust3 = await prisma.customerRec.findFirst({ where: { companyId, custName: 'Walk-In Retail Client' } })
      || await prisma.customerRec.create({ data: { custName: 'Walk-In Retail Client', phone: '0303-3334455', companyId, openingBalance: 0 } });

    let prod1 = await prisma.productRec.findFirst({ where: { companyId, productCode: 'PPRC-25' } });
    if (!prod1) {
      prod1 = await prisma.productRec.create({
        data: {
          productName: 'Master PPRC Pipe 25mm Heavy',
          productCode: 'PPRC-25',
          barCode: 'BC-PPRC-25',
          costPrice: 400,
          retailPrice: 650,
          currentStock: 500,
          companyId
        }
      });
    }

    let prod2 = await prisma.productRec.findFirst({ where: { companyId, productCode: 'VALVE-01' } });
    if (!prod2) {
      prod2 = await prisma.productRec.create({
        data: {
          productName: 'Faisal Brass Gate Valve 1 Inch',
          productCode: 'VALVE-01',
          barCode: 'BC-VALVE-01',
          costPrice: 1200,
          retailPrice: 1850,
          currentStock: 250,
          companyId
        }
      });
    }

    // 4. Insert 5 Completed Delivery Sales Invoices assigned to Primary Staff
    const deliveryInvoices = [
      { invNo: 5001, cust: cust3, driver: 'Muhammad Rashid', phone: '0300-1234567', cnic: '35201-7654321-1', addr: 'House 12, Street 4, Lahore', vehNo: 'LEA-1234', vehType: 'Suzuki Pickup', vehChg: 500, labChg: 250, dest: 'Plot 45, Sector B, Bahria Town', itemsCost: 12000 },
      { invNo: 5002, cust: cust1, driver: 'Tariq Mehmood', phone: '0321-9876543', cnic: '35202-1234567-3', addr: 'Plot 88, Model Town, Lahore', vehNo: 'LES-9876', vehType: 'Mazda Titan Truck', vehChg: 1200, labChg: 500, dest: 'Warehouse 12, Industrial State, Lahore', itemsCost: 28000 },
      { invNo: 5003, cust: cust2, driver: 'Shahid Khan', phone: '0333-5554433', cnic: '35201-9988776-5', addr: 'Mohallah Farooqia, Multan Road', vehNo: 'LHR-5544', vehType: 'Loader Rickshaw', vehChg: 400, labChg: 200, dest: 'Shop 4, Hardware Plaza, Gulberg', itemsCost: 15500 },
      { invNo: 5004, cust: cust3, driver: 'Muhammad Rashid', phone: '0300-1234567', cnic: '35201-7654321-1', addr: 'House 12, Street 4, Lahore', vehNo: 'LEA-1234', vehType: 'Suzuki Pickup', vehChg: 600, labChg: 300, dest: 'Site Office, Canal Road, Lahore', itemsCost: 9400 },
      { invNo: 5005, cust: cust1, driver: 'Kamran Akmal', phone: '0345-1122334', cnic: '35203-4455667-9', addr: 'Street 9, Iqbal Town, Lahore', vehNo: 'LEC-3322', vehType: 'Suzuki Ravi', vehChg: 750, labChg: 350, dest: 'Sector C, Commercial Area, DHA Ph 5', itemsCost: 20500 }
    ];

    for (const inv of deliveryInvoices) {
      const gross = inv.itemsCost;
      const total = gross + inv.vehChg + inv.labChg;

      const existing = await prisma.saleMain.findFirst({ where: { companyId, invoiceNumber: inv.invNo } });
      if (!existing) {
        await prisma.saleMain.create({
          data: {
            invoiceNumber: inv.invNo,
            company: { connect: { id: companyId } },
            customerRec: { connect: { id: inv.cust.id } },
            salesman: { connect: { id: primaryEmp.id } },
            totalAmount: total,
            grossAmount: gross,
            paymentReceived: total,

            isDelivery: true,
            driverName: inv.driver,
            driverPhone: inv.phone,
            driverCnic: inv.cnic,
            driverAddress: inv.addr,
            driverLicenseNo: 'LIC-98765',
            vehicleNo: inv.vehNo,
            vehicleType: inv.vehType,
            vehicleCharges: inv.vehChg,
            labourCharges: inv.labChg,
            deliveryAddress: inv.dest,
            deliveryStatus: 'DELIVERED',
            date: new Date()
          }
        });
      }
    }
    console.log(`✓ Inserted 5 completed delivery sales invoices with Driver CNIC & Vehicle details.`);

    // 5. Insert 2 Pending Credit Sales with remaining balances for Pending Payments
    const creditSales = [
      { invNo: 5006, cust: cust2, total: 35000, paid: 5000, rem: 30000 },
      { invNo: 5007, cust: cust1, total: 22000, paid: 2000, rem: 20000 }
    ];

    for (const cs of creditSales) {
      const existing = await prisma.saleMain.findFirst({ where: { companyId, invoiceNumber: cs.invNo } });
      if (!existing) {
        await prisma.saleMain.create({
          data: {
            invoiceNumber: cs.invNo,
            company: { connect: { id: companyId } },
            customerRec: { connect: { id: cs.cust.id } },
            salesman: { connect: { id: primaryEmp.id } },
            totalAmount: cs.total,
            grossAmount: cs.total,
            paymentReceived: cs.paid,
            date: new Date()
          }
        });

        // Update live balance on customer record
        await prisma.customerRec.update({
          where: { id: cs.cust.id },
          data: { openingBalance: cs.rem }
        });
      }
    }
    console.log(`✓ Inserted 2 pending credit sales (Rs. 30,000 and Rs. 20,000 balance) for Pending Payments.`);

    // 6. Mark Attendance for Today across 5 Staff Members
    const attendanceStatuses = [
      { status: 'Present' },
      { status: 'Absent' },
      { status: 'Leave' },
      { status: 'Late' },
      { status: 'Half-Day' }
    ];
    for (let i = 0; i < attendanceStatuses.length; i++) {
      const st = attendanceStatuses[i];
      const exists = await prisma.attandenceStatus.findFirst({ where: { status: st.status } });
      if (!exists) {
        await prisma.attandenceStatus.create({ data: { id: i + 1, status: st.status } });
      }
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const attAssignments = [
      { emp: staffMembers[0], statusId: 1, statusText: 'PRESENT', late: 0 },
      { emp: staffMembers[1], statusId: 1, statusText: 'PRESENT', late: 0 },
      { emp: staffMembers[2], statusId: 4, statusText: 'LATE', late: 20 },
      { emp: staffMembers[3], statusId: 1, statusText: 'PRESENT', late: 0 },
      { emp: staffMembers[4], statusId: 3, statusText: 'LEAVE', late: 0 }
    ];

    for (const att of attAssignments) {
      const existingAtt = await prisma.empAttandence.findFirst({
        where: {
          employeeRecId: att.emp.id,
          date: { gte: startOfDay, lte: endOfDay }
        }
      });

      if (!existingAtt) {
        await prisma.empAttandence.create({
          data: {
            employeeRec: { connect: { id: att.emp.id } },
            status: { connect: { id: att.statusId } },
            statusText: att.statusText,
            lateMinutes: att.late,
            date: new Date()
          }
        });
      }
    }
    console.log(`✓ Marked today's attendance across all 5 staff members.`);

    // 7. Log 2 Advance Salary Payments for live history
    const advances = [
      { emp: staffMembers[1], amount: 10000, remarks: 'Medical Emergency Advance Salary' },
      { emp: staffMembers[2], amount: 5000, remarks: 'Festival / Household Advance Salary' }
    ];

    for (const adv of advances) {
      const existingAdv = await prisma.empAdvanceSalary.findFirst({
        where: { employeeRecId: adv.emp.id, amount: adv.amount }
      });

      if (!existingAdv) {
        await prisma.empAdvanceSalary.create({
          data: {
            employeeRec: { connect: { id: adv.emp.id } },
            amount: adv.amount,
            remarks: adv.remarks,
            date: new Date(),
            status: 'PENDING_ADJUSTMENT'
          }
        });
      }
    }
    console.log(`✓ Logged 2 advance salary payments for Advance Salary history.`);

    console.log('\n================================================================================');
    console.log('       ✓ SEEDING COMPLETE: ALL STORES & SCREENS SYNCHRONIZED SUCCESSFULLY!');
    console.log('================================================================================');
  } catch (err) {
    console.error('Error seeding active store:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedActiveStoreComplete();
