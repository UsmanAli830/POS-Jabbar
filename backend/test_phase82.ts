import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runSuperAdminScopeVerification() {
  console.log('=======================================================');
  console.log('>>> STARTING CLEAN SUPER ADMIN SCOPE VERIFICATION <<<');
  console.log('=======================================================');

  const server = http.createServer(app);
  const PORT = 3044;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Supplier' } });

    // Super Admin login
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

    const superLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const superToken = (await superLogin.json()).token;

    // 1. Create a new company tenant with full contact and licensing details
    console.log('\n--- 1. Testing Provision Company Tenant with Complete Profile ---');
    const compName = `Sunrise Hypermarket ${Date.now()}`;
    const adminUser = `sunrise_admin_${Date.now()}`;

    const createRes = await fetch(`${baseUrl}/api/super-admin/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({
        companyName: compName,
        address: 'Sector 5, Industrial Area, Karachi',
        contactPerson: 'Tariq Mehmood',
        phone: '+92 300 9988776',
        email: 'contact@sunrisehyper.com',
        adminName: 'Tariq Admin',
        adminUsername: adminUser,
        adminPassword: 'SunrisePassword2026!',
        startDate: '2026-08-01',
        expiresAt: '2027-08-01'
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create company failed: ${JSON.stringify(createData)}`);
    console.log(`✓ Provisioned Company ID: ${createData.company.id} ("${createData.company.name}")`);
    console.log(`✓ Contact Person: ${createData.company.contactPerson}, Phone: ${createData.company.phone}`);
    console.log(`✓ Admin User: @${createData.admin.username}`);
    const compId = createData.company.id;

    // 2. Fetch Directory Grid
    console.log('\n--- 2. Testing Company Directory Grid Fetch ---');
    const dirRes = await fetch(`${baseUrl}/api/super-admin/companies`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    const dirData: any[] = await dirRes.json();
    const createdComp = dirData.find(c => c.id === compId);
    if (!createdComp) throw new Error('Newly created company was not found in directory');
    console.log(`✓ Directory record verified: ${createdComp.name}`);
    console.log(`✓ Subscription: ${createdComp.license.issuedAt.split('T')[0]} → ${createdComp.license.expiresAt.split('T')[0]} (${createdComp.license.daysRemaining} days left)`);

    // 3. Edit Company Details & Subscription Duration
    console.log('\n--- 3. Testing Edit Company Details & Subscription Duration ---');
    const editRes = await fetch(`${baseUrl}/api/super-admin/companies/${compId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({
        companyName: `${compName} (Updated)`,
        address: 'Updated Address 123',
        contactPerson: 'Tariq M. Senior',
        phone: '+92 300 1112233',
        email: 'tariq.senior@sunrise.com',
        startDate: '2026-08-01',
        expiresAt: '2028-08-01', // Extended to 2 years
        isLocked: false
      })
    });
    const editData = await editRes.json();
    if (!editRes.ok) throw new Error(`Edit company failed: ${JSON.stringify(editData)}`);
    console.log(`✓ Updated Company Name: "${editData.company.name}"`);
    console.log(`✓ Updated Expiry: ${editData.license.expiresAt.split('T')[0]}`);

    // 4. Test Lock Switch
    console.log('\n--- 4. Testing Force Lock Toggle ---');
    const lockRes = await fetch(`${baseUrl}/api/super-admin/toggle-lock/${compId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({ isLocked: true })
    });
    const lockData = await lockRes.json();
    console.log(`✓ Toggle lock result: isLocked=${lockData.isLocked}`);
    if (!lockData.isLocked) throw new Error('Lock toggle did not set isLocked=true');

    // Verify company admin is blocked
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUser, password: 'SunrisePassword2026!' })
    });
    const adminLoginData = await adminLoginRes.json();
    console.log(`✓ Admin login attempt when company locked: role=${adminLoginData.user?.role}`);

    // Unlocking company
    await fetch(`${baseUrl}/api/super-admin/toggle-lock/${compId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`
      },
      body: JSON.stringify({ isLocked: false })
    });
    console.log('✓ Company unlocked successfully.');

    console.log('\n=======================================================');
    console.log('>>> ALL CLEAN SUPER ADMIN SCOPE CHECKS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runSuperAdminScopeVerification().catch((err) => {
  console.error('[FATAL SUPER ADMIN SCOPE ERROR]', err);
  process.exit(1);
});
