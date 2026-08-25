import app from './app';
import { startBackupScheduler, runEmergencyBackup } from './scripts/backup';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

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
const server = app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`✓ Wholesale ERP POS Backend is running`);
  console.log(`✓ Local machine URL:  http://localhost:${PORT}`);
  console.log(`✓ Network binding:    http://${HOST}:${PORT} (All Interfaces)`);
  console.log(`✓ Automatic 6-hour backups active in backend/backups/`);
  console.log(`=======================================================`);
});

export default server;
