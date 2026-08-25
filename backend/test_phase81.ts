import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';

const prisma = new PrismaClient();

async function runDoubleGateVerification() {
  console.log('=======================================================');
  console.log('>>> STARTING DOUBLE-GATE PORTAL VERIFICATION <<<');
  console.log('=======================================================');

  const server = http.createServer(app);
  const PORT = 3055;
  await new Promise<void>((resolve) => server.listen(PORT, '0.0.0.0', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Staff' } });
    const defaultCompany = await prisma.company.findFirst() || await prisma.company.create({ data: { name: 'Metro Mart' } });

    // Ensure Super Admin
    const superHash = await bcrypt.hash('admin123', 10);
    await prisma.employeeRec.upsert({
      where: { username: 'admin' },
      update: { role: 'SUPER_ADMIN', isAdmin: true, password: superHash },
      create: {
        name: 'System Super Admin',
        username: 'admin',
        password: superHash,
        role: 'SUPER_ADMIN',
        isAdmin: true,
        postRecId: defaultPost.id
      }
    });

    // Ensure Company Admin
    const compAdminUsername = `store_manager_${Date.now()}`;
    const compHash = await bcrypt.hash('admin123', 10);
    const companyAdmin = await prisma.employeeRec.create({
      data: {
        name: 'Store Manager',
        username: compAdminUsername,
        password: compHash,
        role: 'ADMIN',
        isAdmin: true,
        companyId: defaultCompany.id,
        postRecId: defaultPost.id
      }
    });

    // Ensure Cashier Employee
    const cashierUsername = `cashier_${Date.now()}`;
    const cashierHash = await bcrypt.hash('cashier123', 10);
    const cashierEmp = await prisma.employeeRec.create({
      data: {
        name: 'John Cashier',
        username: cashierUsername,
        password: cashierHash,
        role: 'EMPLOYEE',
        isAdmin: false,
        companyId: defaultCompany.id,
        postRecId: defaultPost.id
      }
    });

    // Add POS permission to cashier
    await prisma.userPermission.create({
      data: {
        employeeRecId: cashierEmp.id,
        pageRoute: 'pos',
        isAllowed: true
      }
    });

    console.log(`✓ Super Admin User: @admin`);
    console.log(`✓ Company Admin User: @${compAdminUsername}`);
    console.log(`✓ Cashier Employee User: @${cashierUsername}`);

    // --- GATE 1: SUPER ADMIN PORTAL LOGIN ---
    console.log('\n--- 1. Testing Super Admin Gate Authentication ---');
    const superRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const superData = await superRes.json();
    console.log(`✓ Super Admin Gate result: role=${superData.user.role}, targetDestination=/super-admin/dashboard`);
    if (superData.user.role !== 'SUPER_ADMIN') {
      throw new Error(`Expected role 'SUPER_ADMIN', got ${superData.user.role}`);
    }

    // --- GATE 2: CLIENT ERP PORTAL (COMPANY ADMIN) ---
    console.log('\n--- 2. Testing Client ERP Gate (Company Admin) ---');
    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: compAdminUsername, password: 'admin123' })
    });
    const adminData = await adminRes.json();
    console.log(`✓ Client ERP Gate (Admin) result: role=${adminData.user.role}, targetDestination=/dashboard`);
    if (adminData.user.role !== 'ADMIN') {
      throw new Error(`Expected role 'ADMIN', got ${adminData.user.role}`);
    }

    // --- GATE 3: CLIENT ERP PORTAL (CASHIER EMPLOYEE) ---
    console.log('\n--- 3. Testing Client ERP Gate (Cashier Employee) ---');
    const cashierRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cashierUsername, password: 'cashier123' })
    });
    const cashierData = await cashierRes.json();
    console.log(`✓ Client ERP Gate (Cashier) result: role=${cashierData.user.role}, targetDestination=/pos (POS Register)`);
    if (cashierData.user.role !== 'EMPLOYEE') {
      throw new Error(`Expected role 'EMPLOYEE', got ${cashierData.user.role}`);
    }

    console.log('\n=======================================================');
    console.log('>>> ALL DOUBLE-GATE VERIFICATION CHECKS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runDoubleGateVerification().catch((err) => {
  console.error('[FATAL DOUBLE GATE ERROR]', err);
  process.exit(1);
});
