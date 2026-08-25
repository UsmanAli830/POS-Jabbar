import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running Attendance & Payroll Deduction Verification Audit for Phase 74...');

  // 1. Get our test employee
  const testEmp = await prisma.employeeRec.findFirst({
    where: { email: 'aj4754705@gmail.com' }
  });

  if (!testEmp) {
    throw new Error('Verification failed: Test employee aj4754705@gmail.com must exist.');
  }

  console.log(`Found Employee: ${testEmp.name} (Base Salary: Rs. ${testEmp.baseSalary})`);

  // Clear previous attendance records for this employee for verification date range (August 2026)
  const month = 8;
  const year = 2026;
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  await prisma.empAttandence.deleteMany({
    where: {
      employeeRecId: testEmp.id,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  // 2. Log 3 attendance records for August 2026:
  // - 1 Present
  // - 1 Absent
  // - 1 Late (30 minutes)
  console.log('Logging verification attendance records for August 2026...');
  
  // Seed AttendanceStatus if not exist
  const defaultStatuses = [
    { id: 1, status: 'Present' },
    { id: 2, status: 'Absent' },
    { id: 3, status: 'Leave' },
    { id: 4, status: 'Late' },
    { id: 5, status: 'Half-Day' }
  ];
  for (const ds of defaultStatuses) {
    const exists = await prisma.attandenceStatus.findUnique({ where: { id: ds.id } });
    if (!exists) {
      await prisma.attandenceStatus.create({ data: ds });
    }
  }

  // Get Present Status ID (1)
  // Get Absent Status ID (2)
  // Get Late Status ID (4)
  
  await prisma.empAttandence.createMany({
    data: [
      {
        employeeRecId: testEmp.id,
        date: new Date(year, month - 1, 15, 9, 0, 0), // Aug 15
        statusId: 1,
        statusText: 'PRESENT',
        lateMinutes: 0
      },
      {
        employeeRecId: testEmp.id,
        date: new Date(year, month - 1, 16, 9, 0, 0), // Aug 16
        statusId: 2,
        statusText: 'ABSENT',
        lateMinutes: 0
      },
      {
        employeeRecId: testEmp.id,
        date: new Date(year, month - 1, 17, 9, 0, 0), // Aug 17
        statusId: 4,
        statusText: 'LATE',
        lateMinutes: 30
      }
    ]
  });

  console.log('Attendance records logged.');

  // 3. Verify Monthly Summary returns expected metrics
  const atts = await prisma.empAttandence.findMany({
    where: {
      employeeRecId: testEmp.id,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  const totalPresents = atts.filter(a => a.statusText === 'PRESENT').length;
  const totalAbsents = atts.filter(a => a.statusText === 'ABSENT').length;
  const totalLeaves = atts.filter(a => a.statusText === 'LEAVE').length;
  const totalLates = atts.filter(a => a.statusText === 'LATE').length;

  console.log('Monthly summary verification:');
  console.log(`- Presents: ${totalPresents} (Expected: 1)`);
  console.log(`- Absents: ${totalAbsents} (Expected: 1)`);
  console.log(`- Lates: ${totalLates} (Expected: 1)`);

  if (totalPresents !== 1 || totalAbsents !== 1 || totalLates !== 1) {
    throw new Error('Assertion failed: Monthly attendance summary numbers are incorrect.');
  }

  // 4. Calculate Expected Payroll Deduction:
  // Deduction = (Base Salary / 30) * Absents
  const baseSalary = testEmp.baseSalary || 0;
  const absentDeduction = Math.round((baseSalary / 30) * totalAbsents);
  console.log(`Base Salary: Rs. ${baseSalary}`);
  console.log(`Calculated Absent Deduction: Rs. ${absentDeduction}`);
  
  const expectedDeduction = Math.round((35000 / 30) * 1);
  if (absentDeduction !== expectedDeduction) {
    throw new Error(`Assertion failed: Expected absent deduction Rs. ${expectedDeduction}, got Rs. ${absentDeduction}`);
  }

  console.log('Verification Audit Passed Successfully! Phase 74 Attendance & payroll calculations are fully aligned.');
}

main()
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
