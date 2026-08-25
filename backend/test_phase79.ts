import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runPhase79Verification() {
  console.log('=======================================================');
  console.log('>>> STARTING PHASE 79 VERIFICATION: 3-TIER ACCESS <<<');
  console.log('=======================================================');

  // Start test server
  const server = http.createServer(app);
  const PORT = 3077;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // --- 1. SEED / ENSURE SUPER ADMIN ---
    console.log('\n--- 1. Testing Tier 1: Super Admin Login & Portal ---');
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Master' } });
    
    let superAdmin = await prisma.employeeRec.findFirst({ where: { username: 'admin' } });
    const superHash = await bcrypt.hash('admin123', 10);
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
        data: { role: 'SUPER_ADMIN', isAdmin: true, password: superHash }
      });
    }

    // Login as Super Admin
    const superLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const superLoginData = await superLoginRes.json();
    console.log(`✓ Super Admin logged in: role=${superLoginData.employee.role}, isAdmin=${superLoginData.employee.isAdmin}`);
    if (superLoginData.employee.role !== 'SUPER_ADMIN') {
      throw new Error(`Expected role 'SUPER_ADMIN', got '${superLoginData.employee.role}'`);
    }
    const superToken = superLoginData.token;

    // --- 2. SUPER ADMIN CREATES A NEW COMPANY TENANT & COMPANY ADMIN ---
    console.log('\n--- 2. Super Admin Creates Company Tenant & Admin Account ---');
    const testCompanyName = `Phase 79 Enterprise ${Date.now()}`;
    const testAdminUsername = `store_admin_${Date.now()}`;

    const createCompanyRes = await fetch(`${baseUrl}/api/super-admin/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({
        companyName: testCompanyName,
        adminName: 'Alice Store Manager',
        adminUsername: testAdminUsername,
        adminPassword: 'adminPassword123!',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      })
    });

    const createCompanyData = await createCompanyRes.json();
    if (!createCompanyRes.ok) {
      throw new Error(`Failed to create company tenant: ${JSON.stringify(createCompanyData)}`);
    }
    console.log(`✓ Created Company Tenant ID: ${createCompanyData.company.id} ("${createCompanyData.company.name}")`);
    console.log(`✓ Created Company Admin: @${createCompanyData.admin.username} (Role: ${createCompanyData.admin.role})`);
    const testCompanyId = createCompanyData.company.id;

    // --- 3. LOGIN AS TIER 2 COMPANY ADMIN ---
    console.log('\n--- 3. Testing Tier 2: Company Admin Login & Constraints ---');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testAdminUsername, password: 'adminPassword123!' })
    });
    const adminLoginData = await adminLoginRes.json();
    console.log(`✓ Company Admin logged in: role=${adminLoginData.employee.role}, companyId=${adminLoginData.employee.companyId}`);
    if (adminLoginData.employee.role !== 'ADMIN') {
      throw new Error(`Expected role 'ADMIN', got '${adminLoginData.employee.role}'`);
    }
    const adminToken = adminLoginData.token;

    // Test Constraint 3A: Super Admin Invisibility
    console.log('\n--- 3A. Testing Super Admin Invisibility for Company Admin ---');
    const permsListRes = await fetch(`${baseUrl}/api/permissions/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const permsListData = await permsListRes.json();
    const foundSuperInList = permsListData.some((e: any) => e.username === 'admin' || e.role === 'SUPER_ADMIN');
    console.log(`✓ Number of visible employees returned to Company Admin: ${permsListData.length}`);
    console.log(`✓ Super Admin present in Company Admin's list: ${foundSuperInList}`);
    if (foundSuperInList) {
      throw new Error('Super Admin Invisibility check failed: Super Admin was visible to Company Admin!');
    }

    // Test Constraint 3B: Password Freeze for Company Admin
    console.log('\n--- 3B. Testing Password Freeze for Company Admin ---');
    const freezeRes = await fetch(`${baseUrl}/api/auth/change-credentials`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ password: 'hackedPassword999' })
    });
    console.log(`✓ Company Admin change-credentials HTTP Status: ${freezeRes.status}`);
    if (freezeRes.status === 403) {
      const freezeData = await freezeRes.json();
      console.log(`✓ Expected 403 response received: "${freezeData.error}"`);
    } else {
      throw new Error(`Expected HTTP 403 for Company Admin password freeze, got ${freezeRes.status}`);
    }

    // --- 4. TIER 3: EMPLOYEE ACCOUNT ---
    console.log('\n--- 4. Testing Tier 3: Employee Account & Self-Service Settings ---');
    const testEmployeeUsername = `cashier_${Date.now()}`;
    const empHash = await bcrypt.hash('cashier123', 10);
    const cashierEmployee = await prisma.employeeRec.create({
      data: {
        name: 'Bob Cashier',
        username: testEmployeeUsername,
        password: empHash,
        role: 'EMPLOYEE',
        isAdmin: false,
        companyId: testCompanyId,
        postRecId: defaultPost.id
      }
    });

    // Employee Login
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testEmployeeUsername, password: 'cashier123' })
    });
    const empLoginData = await empLoginRes.json();
    console.log(`✓ Employee logged in: role=${empLoginData.employee.role}, isAdmin=${empLoginData.employee.isAdmin}`);
    const empToken = empLoginData.token;

    // Test Employee Self-Service Password Update
    console.log('\n--- 4A. Testing Employee Self-Service Password Update ---');
    const empChangeRes = await fetch(`${baseUrl}/api/auth/change-credentials`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empToken}`
      },
      body: JSON.stringify({ password: 'newCashierPassword456!' })
    });
    console.log(`✓ Employee change-credentials HTTP Status: ${empChangeRes.status}`);
    if (empChangeRes.status === 200) {
      console.log('✓ Employee successfully updated their own password!');
    } else {
      const err = await empChangeRes.text();
      throw new Error(`Employee password update failed with status ${empChangeRes.status}: ${err}`);
    }

    // --- 5. PER-COMPANY FORCE LOCK & EXPIRY LOCKOUT ---
    console.log('\n--- 5. Testing Per-Company Force Lock & Super Admin Bypass ---');
    // Force lock Company Tenant
    const lockRes = await fetch(`${baseUrl}/api/super-admin/toggle-lock/${testCompanyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({ isLocked: true })
    });
    const lockData = await lockRes.json();
    console.log(`✓ Super Admin toggled lock for Company ${testCompanyId}: isLocked=${lockData.isLocked}`);

    // Verify Company Admin is blocked
    const adminBlockedRes = await fetch(`${baseUrl}/api/products`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✓ Company Admin access when locked: HTTP ${adminBlockedRes.status}`);
    if (adminBlockedRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for locked Company Admin, got ${adminBlockedRes.status}`);
    }

    // Verify Cashier Employee is blocked
    const empBlockedRes = await fetch(`${baseUrl}/api/products`, {
      headers: { Authorization: `Bearer ${empToken}` }
    });
    console.log(`✓ Employee access when locked: HTTP ${empBlockedRes.status}`);
    if (empBlockedRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for locked Employee, got ${empBlockedRes.status}`);
    }

    // Verify Super Admin is NOT blocked (Tier 1 Bypass)
    const superAllowedRes = await fetch(`${baseUrl}/api/products`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    console.log(`✓ Super Admin access when company locked: HTTP ${superAllowedRes.status} (Bypass active)`);
    if (superAllowedRes.status !== 200) {
      throw new Error(`Expected HTTP 200 for Super Admin bypass, got ${superAllowedRes.status}`);
    }

    // Unlock company and verify access is restored
    await fetch(`${baseUrl}/api/super-admin/toggle-lock/${testCompanyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({ isLocked: false })
    });
    console.log('✓ Company unlocked. Verifying restoration...');

    const adminRestoredRes = await fetch(`${baseUrl}/api/products`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✓ Company Admin access after unlock: HTTP ${adminRestoredRes.status}`);
    if (adminRestoredRes.status !== 200) {
      throw new Error(`Expected HTTP 200 for restored Company Admin, got ${adminRestoredRes.status}`);
    }

    console.log('\n=======================================================');
    console.log('>>> ALL PHASE 79 VERIFICATION CHECKS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runPhase79Verification().catch((err) => {
  console.error('[FATAL PHASE 79 ERROR]', err);
  process.exit(1);
});
