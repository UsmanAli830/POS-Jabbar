import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runProvisioningAndGateVerification() {
  console.log('=======================================================');
  console.log('>>> STARTING PROVISIONING & GATE ENFORCEMENT TEST <<<');
  console.log('=======================================================');

  const server = http.createServer(app);
  const PORT = 3033;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Executive' } });

    // Clean up test users if existing
    await prisma.employeeRec.deleteMany({
      where: { username: { in: ['yooo'] } }
    });
    await prisma.company.deleteMany({
      where: { name: 'hbn' }
    });

    // 1. Super Admin Setup
    const superHash = await bcrypt.hash('admin123', 10);
    await prisma.employeeRec.upsert({
      where: { username: 'admin' },
      update: { role: 'SUPER_ADMIN', isAdmin: true, password: superHash },
      create: {
        name: 'Master Supplier Super Admin',
        username: 'admin',
        password: superHash,
        role: 'SUPER_ADMIN',
        isAdmin: true,
        postRecId: defaultPost.id
      }
    });

    // 2. Super Admin Login
    console.log('\n--- 1. Super Admin Logs in via Super Admin Gate ---');
    const superLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123', loginGate: 'SUPER_ADMIN' })
    });
    const superLoginJson = await superLogin.json();
    console.log(`✓ Super Admin logged in: status=${superLogin.status}, role=${superLoginJson.user?.role}`);
    if (superLogin.status !== 200 || superLoginJson.user?.role !== 'SUPER_ADMIN') {
      throw new Error(`Super Admin login failed: ${JSON.stringify(superLoginJson)}`);
    }
    const superToken = superLoginJson.token;

    // 3. Provision Company 'hbn' with Admin 'yooo'
    console.log('\n--- 2. Super Admin Provisions Company "hbn" with Admin "yooo" ---');
    const provisionRes = await fetch(`${baseUrl}/api/super-admin/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({
        companyName: 'hbn',
        address: 'HBN Plaza, Main Market',
        contactPerson: 'HBN Director',
        phone: '+92 300 7654321',
        email: 'info@hbn.com',
        adminName: 'HBN Store Admin',
        adminUsername: 'yooo',
        adminPassword: 'yoooPassword123!',
        startDate: '2026-08-24',
        expiresAt: '2027-08-24'
      })
    });

    const provisionData = await provisionRes.json();
    console.log(`✓ Provision HTTP Status: ${provisionRes.status}`);
    console.log(`✓ Provisioned Company: "${provisionData.company?.name}" (ID: ${provisionData.company?.id})`);
    console.log(`✓ Provisioned Admin: @${provisionData.admin?.username} (Role: ${provisionData.admin?.role})`);

    if (provisionRes.status !== 201 && provisionRes.status !== 200) {
      throw new Error(`Provisioning failed: ${JSON.stringify(provisionData)}`);
    }

    // Verify in database
    const dbCompany = await prisma.company.findUnique({
      where: { id: provisionData.company.id },
      include: { employees: true, licenses: true }
    });
    if (!dbCompany) throw new Error('Company "hbn" was not found in database!');
    const dbAdmin = dbCompany.employees.find(e => e.username === 'yooo');
    if (!dbAdmin || dbAdmin.role !== 'ADMIN') {
      throw new Error('Admin "yooo" was not correctly created or linked to company "hbn"');
    }
    console.log('✓ Database verification confirmed: Company "hbn" and Admin "yooo" are active in DB.');

    // 4. Log in as 'yooo' via Client ERP Gate
    console.log('\n--- 3. Testing Login with "yooo" through Client ERP Gate ---');
    const clientLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'yooo',
        password: 'yoooPassword123!',
        loginGate: 'CLIENT'
      })
    });
    const clientLoginData = await clientLoginRes.json();
    console.log(`✓ Client ERP Login status: ${clientLoginRes.status}`);
    console.log(`✓ Client ERP Login role: ${clientLoginData.user?.role}, companyName: "${clientLoginData.user?.companyName}"`);
    if (clientLoginRes.status !== 200 || clientLoginData.user?.role !== 'ADMIN') {
      throw new Error(`Client login failed: ${JSON.stringify(clientLoginData)}`);
    }

    // 5. Attempt login with 'yooo' through Super Admin Gate -> MUST BE BLOCKED
    console.log('\n--- 4. Testing "yooo" Attempting to Enter Super Admin Gate ---');
    const blockedSuperGateRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'yooo',
        password: 'yoooPassword123!',
        loginGate: 'SUPER_ADMIN'
      })
    });
    const blockedSuperGateData = await blockedSuperGateRes.json();
    console.log(`✓ Gate Enforcement status: HTTP ${blockedSuperGateRes.status}`);
    console.log(`✓ Gate Rejection message: "${blockedSuperGateData.error}"`);
    if (blockedSuperGateRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for Client user entering Super Admin Gate, got ${blockedSuperGateRes.status}`);
    }

    // 6. Attempt login with 'admin' through Client ERP Gate -> MUST BE BLOCKED
    console.log('\n--- 5. Testing "admin" Attempting to Enter Client ERP Gate ---');
    const blockedClientGateRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123',
        loginGate: 'CLIENT'
      })
    });
    const blockedClientGateData = await blockedClientGateRes.json();
    console.log(`✓ Gate Enforcement status: HTTP ${blockedClientGateRes.status}`);
    console.log(`✓ Gate Rejection message: "${blockedClientGateData.error}"`);
    if (blockedClientGateRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for Super Admin entering Client ERP Gate, got ${blockedClientGateRes.status}`);
    }

    console.log('\n=======================================================');
    console.log('>>> ALL PROVISIONING & GATE TESTS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runProvisioningAndGateVerification().catch((err) => {
  console.error('[FATAL ERROR IN PROVISIONING TEST]', err);
  process.exit(1);
});
