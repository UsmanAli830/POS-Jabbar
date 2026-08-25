import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runSuperAdminPermsAndLogoutTest() {
  console.log('=======================================================');
  console.log('>>> STARTING SUPER ADMIN PERMISSION CONTROL TEST <<<');
  console.log('=======================================================');

  const server = http.createServer(app);
  const PORT = 3035;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Staff' } });

    // 1. Setup Company 'hbn'
    let company = await prisma.company.findFirst({ where: { name: 'hbn' } });
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'hbn', contactPerson: 'HBN Director', phone: '+92 300 7654321' }
      });
    }

    // 2. Setup Super Admin
    const superPassHash = await bcrypt.hash('superadmin123!', 10);
    const superAdmin = await prisma.employeeRec.upsert({
      where: { username: 'superadmin' },
      update: { role: 'SUPER_ADMIN', isAdmin: true, password: superPassHash },
      create: {
        name: 'Master Supplier',
        username: 'superadmin',
        password: superPassHash,
        role: 'SUPER_ADMIN',
        isAdmin: true,
        postRecId: defaultPost.id
      }
    });

    // 3. Setup QA Employee 20
    const empPassHash = await bcrypt.hash('employee123!', 10);
    const qaEmp = await prisma.employeeRec.upsert({
      where: { username: 'qa_employee_20' },
      update: { role: 'EMPLOYEE', isAdmin: false, companyId: company.id, password: empPassHash },
      create: {
        name: 'QA Employee 20',
        username: 'qa_employee_20',
        password: empPassHash,
        role: 'EMPLOYEE',
        isAdmin: false,
        companyId: company.id,
        postRecId: defaultPost.id
      }
    });

    // 4. Super Admin Login
    console.log('\n--- 1. Super Admin Logs in via Super Admin Portal Gate ---');
    const superLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'superadmin123!', loginGate: 'SUPER_ADMIN' })
    });
    const superLoginData = await superLoginRes.json();
    console.log(`✓ Super Admin Login Status: ${superLoginRes.status}`);
    console.log(`✓ Resolved Role: ${superLoginData.user?.role}`);
    if (superLoginRes.status !== 200 || superLoginData.user?.role !== 'SUPER_ADMIN') {
      throw new Error(`Super Admin login failed: ${JSON.stringify(superLoginData)}`);
    }
    const superToken = superLoginData.token;

    // 5. Super Admin fetches staff list for company
    console.log(`\n--- 2. Super Admin Fetches Staff Accounts for Company #${company.id} (${company.name}) ---`);
    const staffRes = await fetch(`${baseUrl}/api/super-admin/companies/${company.id}/employees`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    const staffData = await staffRes.json();
    console.log(`✓ Staff Count: ${staffData.length}`);
    const foundStaff = staffData.find((s: any) => s.username === 'qa_employee_20');
    if (!foundStaff) throw new Error('QA Employee 20 not found in company staff list!');
    console.log(`✓ Found Staff: ${foundStaff.name} (@${foundStaff.username}, ID: ${foundStaff.id})`);

    // 6. Super Admin updates permissions for QA Employee 20
    console.log('\n--- 3. Super Admin Assigns Granular Permissions to QA Employee 20 ---');
    const targetPermissions = [
      { pageRoute: 'pos', isAllowed: true },
      { pageRoute: 'sales', isAllowed: true },
      { pageRoute: 'bookings', isAllowed: true },
      { pageRoute: 'products', isAllowed: true },
      { pageRoute: 'promotions', isAllowed: true },
      { pageRoute: 'payroll', isAllowed: false },
      { pageRoute: 'settings', isAllowed: false }
    ];

    const saveRes = await fetch(`${baseUrl}/api/super-admin/employees/${qaEmp.id}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({ permissions: targetPermissions })
    });
    const saveData = await saveRes.json();
    console.log(`✓ Save Permissions HTTP Status: ${saveRes.status}`);
    console.log(`✓ Response Message: ${saveData.message}`);
    if (saveRes.status !== 200) {
      throw new Error(`Failed to save permissions: ${JSON.stringify(saveData)}`);
    }

    // 7. QA Employee 20 logs in via Client ERP Gate
    console.log('\n--- 4. QA Employee 20 Logs In & Verifies New Active Permissions ---');
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'qa_employee_20', password: 'employee123!', loginGate: 'CLIENT' })
    });
    const empLoginData = await empLoginRes.json();
    console.log(`✓ Employee Login Status: ${empLoginRes.status}`);
    console.log(`✓ Allowed Permissions in Session: ${JSON.stringify(empLoginData.user?.permissions)}`);

    const perms: string[] = empLoginData.user?.permissions || [];
    const expected = ['pos', 'sales', 'bookings', 'products', 'promotions'];
    for (const exp of expected) {
      if (!perms.includes(exp)) {
        throw new Error(`Expected permission "${exp}" missing from session!`);
      }
    }
    if (perms.includes('payroll') || perms.includes('settings')) {
      throw new Error('Unauthorized permissions found in session!');
    }
    console.log('✓ All expected permissions verified successfully in Employee session!');

    console.log('\n=======================================================');
    console.log('>>> SUPER ADMIN PERMISSION CONTROL TESTS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runSuperAdminPermsAndLogoutTest().catch((err) => {
  console.error('[FATAL ERROR IN TEST_PHASE85]', err);
  process.exit(1);
});
