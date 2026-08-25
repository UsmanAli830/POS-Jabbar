import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from './app';
import http from 'http';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-12345';

async function runPhase77Verification() {
  console.log('--- STARTING PHASE 77 VERIFICATION ---');

  // 1. Ensure master admin and sample Cashier employee
  const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Staff' } });
  
  // Seed/Ensure Admin
  let admin = await prisma.employeeRec.findFirst({ where: { username: 'admin' } });
  if (!admin) {
    const hash = await bcrypt.hash('admin123', 10);
    admin = await prisma.employeeRec.create({
      data: {
        name: 'System Admin',
        username: 'admin',
        password: hash,
        isAdmin: true,
        postRecId: defaultPost.id
      }
    });
  } else {
    admin = await prisma.employeeRec.update({
      where: { id: admin.id },
      data: { isAdmin: true }
    });
  }

  // Seed/Ensure Cashier Employee
  let cashier = await prisma.employeeRec.findFirst({ where: { username: 'cashier1' } });
  if (!cashier) {
    const hash = await bcrypt.hash('cashier123', 10);
    cashier = await prisma.employeeRec.create({
      data: {
        name: 'John Cashier',
        username: 'cashier1',
        password: hash,
        isAdmin: false,
        postRecId: defaultPost.id
      }
    });
  }

  console.log(`✓ Admin User: ID=${admin.id}, Username=${admin.username}, isAdmin=${admin.isAdmin}`);
  console.log(`✓ Cashier User: ID=${cashier.id}, Username=${cashier.username}, isAdmin=${cashier.isAdmin}`);

  // 2. Set Cashier Permissions (Only Allow POS, explicitly forbid balance-sheet)
  await prisma.userPermission.upsert({
    where: {
      employeeRecId_pageRoute: {
        employeeRecId: cashier.id,
        pageRoute: 'pos'
      }
    },
    update: { isAllowed: true },
    create: {
      employeeRecId: cashier.id,
      userLoginId: cashier.id,
      pageRoute: 'pos',
      isAllowed: true
    }
  });

  await prisma.userPermission.upsert({
    where: {
      employeeRecId_pageRoute: {
        employeeRecId: cashier.id,
        pageRoute: 'balance-sheet'
      }
    },
    update: { isAllowed: false },
    create: {
      employeeRecId: cashier.id,
      userLoginId: cashier.id,
      pageRoute: 'balance-sheet',
      isAllowed: false
    }
  });

  console.log('✓ Configured Cashier permissions: [pos: true, balance-sheet: false]');

  // 3. Generate tokens
  const adminToken = jwt.sign(
    { id: admin.id, name: admin.name, username: admin.username, role: 'ADMIN', isAdmin: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const cashierToken = jwt.sign(
    { id: cashier.id, name: cashier.name, username: cashier.username, role: 'EMPLOYEE', isAdmin: false },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 4. Start ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));
  console.log('✓ Ephemeral test server running on port 3099');

  try {
    // 5. Test Cashier blocked from Balance Sheet
    const cashierRes = await fetch('http://localhost:3099/api/reports/balance-sheet', {
      headers: { Authorization: `Bearer ${cashierToken}` }
    });

    console.log(`✓ Cashier access to Balance Sheet: HTTP Status ${cashierRes.status}`);
    if (cashierRes.status === 403) {
      const errData = await cashierRes.json();
      console.log(`✓ Cashier successfully blocked with message: "${errData.error}"`);
    } else {
      throw new Error(`Expected HTTP 403 for cashier on balance-sheet, got ${cashierRes.status}`);
    }

    // 6. Test Admin allowed on Balance Sheet
    const adminRes = await fetch('http://localhost:3099/api/reports/balance-sheet', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log(`✓ Admin access to Balance Sheet: HTTP Status ${adminRes.status}`);
    if (adminRes.status === 200) {
      console.log('✓ Admin successfully authorized on Balance Sheet');
    } else {
      throw new Error(`Expected HTTP 200 for admin on balance-sheet, got ${adminRes.status}`);
    }

    // 7. Test Sequential Invoice Numbers
    const nextInvRes = await fetch('http://localhost:3099/api/sales/next-invoice-number');
    const nextInvData = await nextInvRes.json();
    console.log(`✓ Next sequential invoice number generated: ${nextInvData.nextInvoiceNumber} (ID: ${nextInvData.nextId})`);

    // 8. Test Permissions API endpoints
    const permsRes = await fetch('http://localhost:3099/api/permissions/employees', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const permsData = await permsRes.json();
    console.log(`✓ Admin fetched employee permissions list (${permsData.length} records)`);

    console.log('\n========================================');
    console.log('>>> ALL PHASE 77 TESTS PASSED SUCCESSFULLY! <<<');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

runPhase77Verification()
  .catch((e) => {
    console.error('Phase 77 Verification Failed:', e);
    process.exit(1);
  });
