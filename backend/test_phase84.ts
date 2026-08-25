import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runAdminBypassAndPermissionsTest() {
  console.log('=======================================================');
  console.log('>>> STARTING ADMIN PERMISSION BYPASS & CONTROLLER TEST <<<');
  console.log('=======================================================');

  const server = http.createServer(app);
  const PORT = 3034;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Staff' } });

    // 1. Get or create Company 'hbn'
    let company = await prisma.company.findFirst({ where: { name: 'hbn' } });
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'hbn', contactPerson: 'HBN Director', phone: '+92 300 7654321' }
      });
    }

    // 2. Setup Company Admin 'yooo'
    const adminPassHash = await bcrypt.hash('yoooPassword123!', 10);
    const adminUser = await prisma.employeeRec.upsert({
      where: { username: 'yooo' },
      update: { role: 'ADMIN', isAdmin: true, companyId: company.id, password: adminPassHash },
      create: {
        name: 'HBN Store Admin',
        username: 'yooo',
        password: adminPassHash,
        role: 'ADMIN',
        isAdmin: true,
        companyId: company.id,
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

    // 4. Test Company Admin Login
    console.log('\n--- 1. Company Admin "yooo" Logs in via Client ERP Gate ---');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'yooo', password: 'yoooPassword123!', loginGate: 'CLIENT' })
    });
    const adminLoginData = await adminLoginRes.json();
    console.log(`✓ Admin Login HTTP Status: ${adminLoginRes.status}`);
    console.log(`✓ Admin Resolved Role: ${adminLoginData.user?.role}, isAdmin: ${adminLoginData.user?.isAdmin}`);
    if (adminLoginRes.status !== 200 || adminLoginData.user?.role !== 'ADMIN') {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    }
    const adminToken = adminLoginData.token;

    // 5. Admin fetches employee list from Permissions Panel API
    console.log('\n--- 2. Admin Fetches Employee List for Access Control ---');
    const empListRes = await fetch(`${baseUrl}/api/permissions/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const empListData = await empListRes.json();
    console.log(`✓ Permissions Employee List Count: ${empListData.length}`);
    const foundQA = empListData.find((e: any) => e.username === 'qa_employee_20');
    if (!foundQA) throw new Error('QA Employee 20 not found in Admin Permissions list!');
    console.log(`✓ Found QA Employee 20 (ID: ${foundQA.id}, Name: "${foundQA.name}")`);

    // 6. Admin assigns "pos" and "sales" permissions to QA Employee 20
    console.log('\n--- 3. Admin Saves Permissions for QA Employee 20 (Enabling Sales & POS) ---');
    const savePermsRes = await fetch(`${baseUrl}/api/permissions/employee/${qaEmp.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        isAdmin: false,
        permissions: [
          { pageRoute: 'pos', isAllowed: true },
          { pageRoute: 'sales', isAllowed: true },
          { pageRoute: 'bookings', isAllowed: true },
          { pageRoute: 'payroll', isAllowed: false }
        ]
      })
    });
    const savePermsData = await savePermsRes.json();
    console.log(`✓ Save Permissions HTTP Status: ${savePermsRes.status}`);
    console.log(`✓ Saved Permissions Count: ${savePermsData.permissions?.length}`);
    if (savePermsRes.status !== 200) {
      throw new Error(`Failed to save permissions: ${JSON.stringify(savePermsData)}`);
    }

    // 7. Employee QA Employee 20 logs in
    console.log('\n--- 4. QA Employee 20 Logs in & Verifies Session Permissions ---');
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'qa_employee_20', password: 'employee123!', loginGate: 'CLIENT' })
    });
    const empLoginData = await empLoginRes.json();
    console.log(`✓ Employee Login Status: ${empLoginRes.status}`);
    console.log(`✓ Employee Allowed Permissions: ${JSON.stringify(empLoginData.user?.permissions)}`);

    const perms: string[] = empLoginData.user?.permissions || [];
    if (!perms.includes('pos') || !perms.includes('sales') || !perms.includes('bookings')) {
      throw new Error(`Expected permissions ['pos', 'sales', 'bookings'] for QA Employee 20, got: ${JSON.stringify(perms)}`);
    }
    if (perms.includes('payroll')) {
      throw new Error('Unauthorized permission "payroll" was unexpectedly found in employee session!');
    }
    console.log('✓ QA Employee 20 has exact authorized permissions: ["pos", "sales", "bookings"].');

    // 8. Verify GET /api/auth/me for QA Employee 20
    console.log('\n--- 5. Testing /api/auth/me Session Verification ---');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${empLoginData.token}` }
    });
    const meData = await meRes.json();
    console.log(`✓ /api/auth/me Status: ${meRes.status}`);
    console.log(`✓ /api/auth/me User Role: ${meData.user?.role}, Permissions Count: ${meData.user?.permissions?.length}`);
    if (meRes.status !== 200 || !meData.user?.permissions?.includes('pos')) {
      throw new Error(`Session verification failed: ${JSON.stringify(meData)}`);
    }

    console.log('\n=======================================================');
    console.log('>>> ALL ADMIN BYPASS & PERMISSION CHECKS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runAdminBypassAndPermissionsTest().catch((err) => {
  console.error('[FATAL ERROR IN TEST_PHASE84]', err);
  process.exit(1);
});
