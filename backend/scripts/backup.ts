import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

const DB_PATH = path.resolve(__dirname, '../prisma/dev.db');
const BACKUPS_DIR = path.resolve(__dirname, '../backups');
const MAX_BACKUPS_TO_KEEP = 60; // Retains 15 days of 6-hour backups

/**
 * Formats a Date object into YYYY-MM-DD_HH-mm-ss string
 */
function getTimestampString(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${MM}-${dd}_${hh}-${mm}-${ss}`;
}

/**
 * Ensures the backup directory exists
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Cleans up old backups exceeding MAX_BACKUPS_TO_KEEP
 */
function pruneOldBackups(): void {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUPS_DIR, f),
        time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS_TO_KEEP) {
      const toDelete = files.slice(MAX_BACKUPS_TO_KEEP);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        console.log(`[Backup Prune] Removed old backup: ${item.name}`);
      }
    }
  } catch (err) {
    console.error('[Backup Prune] Error pruning old backups:', err);
  }
}

/**
 * Runs a backup of the database
 */
export async function runDatabaseBackup(): Promise<string> {
  ensureBackupDir();
  if (!fs.existsSync(DB_PATH)) {
    const msg = `[Backup Warning] Database file not found at ${DB_PATH}`;
    console.warn(msg);
    return msg;
  }

  const timestamp = getTimestampString();
  const backupFileName = `backup-${timestamp}.db`;
  const destinationPath = path.join(BACKUPS_DIR, backupFileName);

  try {
    await fs.promises.copyFile(DB_PATH, destinationPath);
    console.log(`[Automatic Backup] ✓ Database backed up successfully: ${backupFileName}`);
    pruneOldBackups();
    return destinationPath;
  } catch (err) {
    console.error('[Automatic Backup] ✕ Failed to create backup:', err);
    throw err;
  }
}

/**
 * Emergency Crash Hook Backup (Synchronous / Safe)
 */
export function runEmergencyBackup(reason = 'crash'): string {
  try {
    ensureBackupDir();
    if (!fs.existsSync(DB_PATH)) {
      console.warn(`[Emergency Backup] DB file does not exist at ${DB_PATH}`);
      return '';
    }

    const timestamp = getTimestampString();
    const cleanReason = reason.replace(/[^a-zA-Z0-9_-]/g, '');
    const backupFileName = `emergency-backup-${timestamp}-${cleanReason}.db`;
    const destinationPath = path.join(BACKUPS_DIR, backupFileName);

    fs.copyFileSync(DB_PATH, destinationPath);
    console.log(`[Emergency Backup] ✓ Created emergency crash backup: ${backupFileName}`);
    return destinationPath;
  } catch (err) {
    console.error('[Emergency Backup] ✕ Failed to create emergency backup:', err);
    return '';
  }
}

/**
 * Starts the automated 6-hour backup cron schedule
 * Runs at 00:00, 06:00, 12:00, 18:00 every day
 */
export function startBackupScheduler(): void {
  ensureBackupDir();
  
  // Run an immediate initial backup if none exists
  const existing = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db'));
  if (existing.length === 0) {
    console.log('[Backup Scheduler] Initializing first system backup on startup...');
    runDatabaseBackup().catch(err => console.error('[Backup Scheduler] Startup backup failed:', err));
  }

  // Cron Expression: '0 */6 * * *' triggers every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00)
  cron.schedule('0 */6 * * *', () => {
    console.log('[Backup Scheduler] Executing scheduled 6-hour database backup...');
    runDatabaseBackup().catch(err => console.error('[Backup Scheduler] Scheduled backup failed:', err));
  });

  console.log('[Backup Scheduler] ✓ 6-Hour automated database backup scheduler active (00:00, 06:00, 12:00, 18:00).');
}

export default {
  runDatabaseBackup,
  runDailyBackup: runDatabaseBackup,
  runEmergencyBackup,
  startBackupScheduler
};
