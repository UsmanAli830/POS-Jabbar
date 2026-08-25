import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runPhase80Verification() {
  console.log('=======================================================');
  console.log('>>> STARTING PHASE 80 VERIFICATION: ROLE SEPARATION <<<');
  console.log('=======================================================');

  const server = http.createServer(app);
  const PORT = 3066;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Administration' } });
    const defaultCompany = await prisma.company.findFirst() || await prisma.company.create({ data: { name: 'Main Store' } });

    // 1. Setup Super Admin
    const superHash = await bcrypt.hash('admin123', 10);
    let superAdmin = await prisma.employeeRec.findFirst({ where: { username: 'admin' } });
    if (!superAdmin) {
      superAdmin = await prisma.employeeRec.create({
        data: {
          name: 'Software Supplier Super Admin',
          username: 'admin',
          password: superHash,
          role: 'SUPER_ADMIN',
          isAdmin: true,
          postRecId: defaultPost.id
        }
      });
    } else {
      superAdmin = await prisma.employeeRec.update({
        where: { id: superAdmin.id },
        data: { role: 'SUPER_ADMIN', isAdmin: true }
      });
    }

    // 2. Setup Company Admin
    const compAdminUsername = `company_owner_${Date.now()}`;
    const compAdminHash = await bcrypt.hash('admin123', 10);
    const companyAdmin = await prisma.employeeRec.create({
      data: {
        name: 'Store Owner',
        username: compAdminUsername,
        password: compAdminHash,
        role: 'ADMIN',
        isAdmin: true,
        companyId: defaultCompany.id,
        postRecId: defaultPost.id
      }
    });

    // 3. Setup Employee
    const empUsername = `staff_${Date.now()}`;
    const empHash = await bcrypt.hash('staff123', 10);
    const staffEmployee = await prisma.employeeRec.create({
      data: {
        name: 'Staff Cashier',
        username: empUsername,
        password: empHash,
        role: 'EMPLOYEE',
        isAdmin: false,
        companyId: defaultCompany.id,
        postRecId: defaultPost.id
      }
    });

    console.log(`✓ Super Admin ID: ${superAdmin.id}, username: @${superAdmin.username}`);
    console.log(`✓ Company Admin ID: ${companyAdmin.id}, username: @${companyAdmin.username}`);
    console.log(`✓ Staff Employee ID: ${staffEmployee.id}, username: @${staffEmployee.username}`);

    // --- CHECK 1: LOGIN PAYLOAD VERIFICATION ---
    console.log('\n--- 1. Testing Login Token & Session Payload ---');
    const superLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const superLoginJson = await superLoginRes.json();
    console.log('✓ Super Admin Login Response user.role:', superLoginJson.user?.role);
    if (superLoginJson.user?.role !== 'SUPER_ADMIN') {
      throw new Error(`Expected Super Admin user.role='SUPER_ADMIN', got '${superLoginJson.user?.role}'`);
    }
    const superToken = superLoginJson.token;

    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: compAdminUsername, password: 'admin123' })
    });
    const adminLoginJson = await adminLoginRes.json();
    console.log('✓ Company Admin Login Response user.role:', adminLoginJson.user?.role);
    if (adminLoginJson.user?.role !== 'ADMIN') {
      throw new Error(`Expected Company Admin user.role='ADMIN', got '${adminLoginJson.user?.role}'`);
    }
    const adminToken = adminLoginJson.token;

    // --- CHECK 2: SUPER ADMIN ROUTE RESTRICTION ---
    console.log('\n--- 2. Testing Super Admin Route Restrictions ---');
    const adminAccessSuperApiRes = await fetch(`${baseUrl}/api/super-admin/companies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✓ Company Admin accessing Super Admin API: HTTP ${adminAccessSuperApiRes.status}`);
    if (adminAccessSuperApiRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for Company Admin accessing /api/super-admin, got ${adminAccessSuperApiRes.status}`);
    }

    const superAccessSuperApiRes = await fetch(`${baseUrl}/api/super-admin/companies`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    console.log(`✓ Super Admin accessing Super Admin API: HTTP ${superAccessSuperApiRes.status}`);
    if (superAccessSuperApiRes.status !== 200) {
      throw new Error(`Expected HTTP 200 for Super Admin accessing /api/super-admin, got ${superAccessSuperApiRes.status}`);
    }

    // --- CHECK 3: SUPER ADMIN INVISIBILITY IN ALL ENDPOINTS ---
    console.log('\n--- 3. Testing Complete Invisibility of Super Admin ---');
    
    // 3A: Permissions Employee List
    const permsRes = await fetch(`${baseUrl}/api/permissions/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const permsEmployees = await permsRes.json();
    const hasSuperInPerms = permsEmployees.some((e: any) => e.username === 'admin' || e.role === 'SUPER_ADMIN');
    console.log(`✓ Super Admin visible in /api/permissions/employees: ${hasSuperInPerms}`);
    if (hasSuperInPerms) throw new Error('Super Admin was visible in /api/permissions/employees');

    // 3B: Master Data
    const masterDataRes = await fetch(`${baseUrl}/api/master-data`);
    const masterDataJson = await masterDataRes.json();
    const hasSuperInMaster = masterDataJson.employees.some((e: any) => e.username === 'admin' || e.role === 'SUPER_ADMIN');
    console.log(`✓ Super Admin visible in /api/master-data: ${hasSuperInMaster}`);
    if (hasSuperInMaster) throw new Error('Super Admin was visible in /api/master-data');

    // 3C: HR Employees
    const hrEmployeesRes = await fetch(`${baseUrl}/api/hr/employees`);
    const hrEmployeesJson = await hrEmployeesRes.json();
    const hasSuperInHr = hrEmployeesJson.some((e: any) => e.username === 'admin' || e.role === 'SUPER_ADMIN');
    console.log(`✓ Super Admin visible in /api/hr/employees: ${hasSuperInHr}`);
    if (hasSuperInHr) throw new Error('Super Admin was visible in /api/hr/employees');

    // 3D: Attendance Matrix
    const attRes = await fetch(`${baseUrl}/api/hr/attendance?date=2026-08-24`);
    const attJson = await attRes.json();
    const hasSuperInAtt = Array.isArray(attJson) && attJson.some((e: any) => e.employeeRecId === superAdmin.id || e.employeeName?.toLowerCase().includes('super admin'));
    console.log(`✓ Super Admin visible in /api/hr/attendance: ${hasSuperInAtt}`);
    if (hasSuperInAtt) throw new Error('Super Admin was visible in /api/hr/attendance');

    // 3E: Direct Permission Lookup for Super Admin ID by Company Admin
    const directSuperLookupRes = await fetch(`${baseUrl}/api/permissions/employee/${superAdmin.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✓ Direct Super Admin lookup by Company Admin: HTTP ${directSuperLookupRes.status}`);
    if (directSuperLookupRes.status !== 404) {
      throw new Error(`Expected HTTP 404 when Company Admin looks up Super Admin ID, got ${directSuperLookupRes.status}`);
    }

    // --- CHECK 4: BLOCK ADMIN PROFILE CREDENTIALS MODIFICATION ---
    console.log('\n--- 4. Testing Admin Password Freeze ---');
    const adminChangeCredsRes = await fetch(`${baseUrl}/api/auth/change-credentials`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ password: 'unauthorized_change_123' })
    });
    console.log(`✓ Company Admin self-password change: HTTP ${adminChangeCredsRes.status}`);
    if (adminChangeCredsRes.status !== 403) {
      throw new Error(`Expected HTTP 403 when Company Admin attempts self-password change, got ${adminChangeCredsRes.status}`);
    }

    // Super Admin resets Admin Credentials
    const superResetAdminRes = await fetch(`${baseUrl}/api/super-admin/admin-credentials/${companyAdmin.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({ password: 'validNewAdminPassword456!' })
    });
    console.log(`✓ Super Admin resetting Company Admin password: HTTP ${superResetAdminRes.status}`);
    if (superResetAdminRes.status !== 200) {
      throw new Error(`Expected HTTP 200 when Super Admin resets admin credentials, got ${superResetAdminRes.status}`);
    }

    console.log('\n=======================================================');
    console.log('>>> ALL PHASE 80 VERIFICATION CHECKS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runPhase80Verification().catch((err) => {
  console.error('[FATAL PHASE 80 ERROR]', err);
  process.exit(1);
});
