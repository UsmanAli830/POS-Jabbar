import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { runDatabaseBackup } from '../scripts/backup';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const BACKUPS_DIR = path.resolve(__dirname, '../backups');

// All backup endpoints require authentication
router.use(authenticate);

// GET /api/backup/list - List all local backup files
router.get('/list', async (req: AuthenticatedRequest, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          createdAt: stats.mtime.toISOString(),
          time: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.time - a.time);

    res.json({
      backups: files,
      totalCount: files.length,
      storageDirectory: BACKUPS_DIR,
      scheduleInterval: 'Every 6 hours (00:00, 06:00, 12:00, 18:00)'
    });
  } catch (error: any) {
    console.error('List backups error:', error);
    res.status(500).json({ error: error.message || 'Failed to list database backups' });
  }
});

// POST /api/backup/create - Trigger an instant manual backup snapshot
router.post('/create', async (req: AuthenticatedRequest, res) => {
  try {
    const backupPath = await runDatabaseBackup();
    const filename = path.basename(backupPath);
    const stats = fs.statSync(backupPath);

    res.json({
      message: 'Database backup snapshot created successfully!',
      filename,
      sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      createdAt: stats.mtime.toISOString()
    });
  } catch (error: any) {
    console.error('Manual backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to create database backup' });
  }
});

// GET /api/backup/download/:filename - Download a specific backup snapshot
router.get('/download/:filename', async (req: AuthenticatedRequest, res) => {
  try {
    const filename = String(req.params.filename || '');
    // Security check: prevent directory traversal
    if (!filename || filename.includes('..') || !filename.endsWith('.db')) {
      return res.status(400).json({ error: 'Invalid backup filename requested' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found on disk' });
    }

    res.download(filePath, filename);
  } catch (error: any) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to download backup' });
  }
});

export default router;
