import fs from 'fs';
import path from 'path';
import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from './app';
import { runDailyBackup, runEmergencyBackup } from './scripts/backup';

const prisma = new PrismaClient();

async function runPhase78Verification() {
  console.log('=======================================================');
  console.log('>>> STARTING PHASE 78 VERIFICATION: BACKUPS & LOCKOUT <<<');
  console.log('=======================================================');

  // --- 1. VERIFY AUTOMATIC & EMERGENCY DATABASE BACKUPS ---
  console.log('\n--- 1. Testing Database Backup Subsystem ---');
  const backupFile = await runDailyBackup();
  console.log(`✓ Daily backup created: ${backupFile}`);
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Daily backup file does not exist at: ${backupFile}`);
  }

  const emergencyBackupFile = runEmergencyBackup('test_uncaught_exception');
  console.log(`✓ Emergency crash backup created: ${emergencyBackupFile}`);
  if (!fs.existsSync(emergencyBackupFile)) {
    throw new Error(`Emergency backup file does not exist at: ${emergencyBackupFile}`);
  }

  const backupsDir = path.resolve(__dirname, 'backups');
  const allBackups = fs.readdirSync(backupsDir);
  console.log(`✓ Total backup snapshots stored in backups/: ${allBackups.length}`);

  // --- 2. SETUP ADMIN FOR LICENSE BYPASS ---
  console.log('\n--- 2. Setting Up Super Admin Account ---');
  const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Administration' } });
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
  console.log(`✓ Verified Super Admin: @${admin.username} (isAdmin=${admin.isAdmin})`);

  // --- 3. START TEST SERVER ---
  const server = http.createServer(app);
  const TEST_PORT = 3088;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '0.0.0.0', resolve));
  console.log(`✓ Test Server active on http://0.0.0.0:${TEST_PORT}`);

  try {
    // --- 4. SIMULATE EXPIRED LICENSE ---
    console.log('\n--- 3. Testing Expiry Lockout Middleware ---');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await fetch(`http://127.0.0.1:${TEST_PORT}/api/license/set-expiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: yesterday.toISOString(), isLocked: false })
    });

    console.log(`✓ Set license expiry date to yesterday: ${yesterday.toISOString()}`);

    // Check status endpoint
    const statusRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/license/status`);
    const statusData = await statusRes.json();
    console.log('✓ License Status Check:', statusData);
    if (!statusData.isExpired) {
      throw new Error('Expected license to be marked as isExpired=true');
    }

    // Try accessing protected API route (e.g. /api/products or /api/master-data)
    const blockedRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/master-data`);
    console.log(`✓ Protected API request status while expired: HTTP ${blockedRes.status}`);
    
    if (blockedRes.status === 403) {
      const blockedJson = await blockedRes.json();
      console.log('✓ Received Expected 403 Response:', blockedJson);
      if (blockedJson.error !== 'LICENSE_EXPIRED') {
        throw new Error(`Expected error 'LICENSE_EXPIRED', got '${blockedJson.error}'`);
      }
    } else {
      throw new Error(`Expected HTTP 403 on expired license, but got HTTP ${blockedRes.status}`);
    }

    // --- 5. TEST SUPER ADMIN BYPASS & RENEWAL ---
    console.log('\n--- 4. Testing Super Admin Renewal Bypass (POST /api/license/extend) ---');
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const renewRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/license/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123',
        newExpiryDate: futureDate.toISOString()
      })
    });

    console.log(`✓ License Renewal HTTP Status: ${renewRes.status}`);
    if (renewRes.status !== 200) {
      const errText = await renewRes.text();
      throw new Error(`Renewal failed with status ${renewRes.status}: ${errText}`);
    }

    const renewData = await renewRes.json();
    console.log('✓ Renewal Result:', renewData);

    // --- 6. VERIFY SYSTEM UNLOCKED ---
    console.log('\n--- 5. Verifying Unlocked Access to Protected APIs ---');
    const unlockedRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/master-data`);
    console.log(`✓ Protected API request after renewal: HTTP ${unlockedRes.status}`);
    if (unlockedRes.status === 200) {
      console.log('✓ System successfully resumed full operational state!');
    } else {
      throw new Error(`Expected HTTP 200 after renewal, got ${unlockedRes.status}`);
    }

    console.log('\n=======================================================');
    console.log('>>> ALL PHASE 78 VERIFICATION CHECKS PASSED (100%) <<<');
    console.log('=======================================================');
  } finally {
    server.close();
  }
}

runPhase78Verification().catch((err) => {
  console.error('[FATAL QA ERROR]', err);
  process.exit(1);
});
