import app from './app';
import { startBackupScheduler, runEmergencyBackup } from './scripts/backup';
import { verifyLicense, isEnforced, reasonMessage } from './license/license';
import { createLockedApp } from './license/lockedApp';
import { getHardwareId } from './license/hardware';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// 0. Hardware-locked licence gate (only active when LICENSE_ENFORCEMENT=1, i.e.
//    on client installs — never in dev/test). An invalid/copied/expired licence
//    starts a lock screen instead of the real app.
let activeApp = app;
if (isEnforced()) {
  const status = verifyLicense();
  if (status.valid) {
    console.log(`✓ Licence valid — ${status.payload?.companyName} (expires ${status.payload?.expiresAt})`);
  } else {
    console.error(`[LICENSE] BLOCKED (${status.reason}): ${reasonMessage(status.reason)} — starting in LOCKED mode.`);
    console.error(`[LICENSE] This machine's ID (give to supplier to issue a licence): ${getHardwareId()}`);
    activeApp = createLockedApp(status);
  }
}

// 1. Initialize 6-hour automatic database backup scheduler
startBackupScheduler();

// 2. Emergency Crash Hooks
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception detected in backend process:', err);
  try {
    runEmergencyBackup('uncaughtException');
  } catch (backupErr) {
    console.error('[CRITICAL] Emergency backup failed during crash:', backupErr);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  try {
    runEmergencyBackup('unhandledRejection');
  } catch (backupErr) {
    console.error('[CRITICAL] Emergency backup failed during crash:', backupErr);
  }
});

// 3. Multi-Device Network Binding (0.0.0.0)
const server = activeApp.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`✓ Wholesale ERP POS Backend is running`);
  console.log(`✓ Local machine URL:  http://localhost:${PORT}`);
  console.log(`✓ Network binding:    http://${HOST}:${PORT} (All Interfaces)`);
  console.log(`✓ Automatic 6-hour backups active in backend/backups/`);
  console.log(`=======================================================`);
});

export default server;
