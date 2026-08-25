import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getOrSeedLicense, invalidateLicenseCache } from '../middleware/license';

const router = Router();
const prisma = new PrismaClient();

// GET /api/license/status
router.get('/status', async (req, res) => {
  try {
    const license = await getOrSeedLicense();
    const now = new Date();
    const diffMs = license.expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const isExpired = diffMs <= 0;

    res.json({
      expiresAt: license.expiresAt.toISOString(),
      isLocked: license.isLocked,
      isExpired,
      daysRemaining,
      isActive: !license.isLocked && !isExpired
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch license status' });
  }
});

// POST /api/license/extend - Super Admin bypass / renewal endpoint
router.post('/extend', async (req, res) => {
  try {
    const { username, password, masterKey, newExpiryDate, days } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Super Admin username and password are required for license authorization.' });
    }

    // Verify admin credentials
    const adminUser = await prisma.employeeRec.findFirst({
      where: {
        username: username.trim()
      }
    });

    if (!adminUser || !adminUser.password) {
      return res.status(401).json({ error: 'Invalid Super Admin credentials.' });
    }

    // Must be admin or have admin role
    const isMaster = adminUser.isAdmin || adminUser.username === 'admin';
    if (!isMaster) {
      return res.status(403).json({ error: 'Access Denied: Only Super Administrators can renew or bypass licenses.' });
    }

    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Super Admin credentials.' });
    }

    // Optional master bypass key check if provided
    const DEFAULT_MASTER_KEY = process.env.MASTER_ADMIN_KEY || 'HBN-SUPER-ADMIN-2026';
    if (masterKey && masterKey.trim() !== DEFAULT_MASTER_KEY) {
      return res.status(401).json({ error: 'Invalid Super Admin Master License Key.' });
    }

    // Compute new expiry date
    let targetDate: Date;
    if (newExpiryDate) {
      targetDate = new Date(newExpiryDate);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid newExpiryDate format.' });
      }
    } else if (days && !isNaN(Number(days))) {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Number(days));
    } else {
      // Default to 1 year renewal
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 365);
    }

    // Find existing or create new license
    let license = await prisma.softwareLicense.findFirst({
      orderBy: { id: 'desc' }
    });

    if (license) {
      license = await prisma.softwareLicense.update({
        where: { id: license.id },
        data: {
          expiresAt: targetDate,
          isLocked: false
        }
      });
    } else {
      license = await prisma.softwareLicense.create({
        data: {
          expiresAt: targetDate,
          isLocked: false
        }
      });
    }

    invalidateLicenseCache();

    console.log(`[License System] ✓ License extended by @${adminUser.username} until ${targetDate.toISOString()}`);

    res.json({
      message: 'Software license successfully extended and unlocked!',
      license: {
        expiresAt: license.expiresAt.toISOString(),
        isLocked: license.isLocked,
        unlockedBy: adminUser.name
      }
    });
  } catch (error: any) {
    console.error('License Extension Error:', error);
    res.status(500).json({ error: error.message || 'Failed to extend license' });
  }
});

// POST /api/license/set-expiry - Test / management endpoint to set specific date
router.post('/set-expiry', async (req, res) => {
  try {
    const { date, isLocked } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    let license = await prisma.softwareLicense.findFirst({
      orderBy: { id: 'desc' }
    });

    if (license) {
      license = await prisma.softwareLicense.update({
        where: { id: license.id },
        data: {
          expiresAt: parsedDate,
          isLocked: typeof isLocked === 'boolean' ? isLocked : license.isLocked
        }
      });
    } else {
      license = await prisma.softwareLicense.create({
        data: {
          expiresAt: parsedDate,
          isLocked: Boolean(isLocked)
        }
      });
    }

    invalidateLicenseCache();

    res.json({
      message: 'License expiry date updated',
      license
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/license/lock - Manually lock or unlock system
router.post('/lock', async (req, res) => {
  try {
    const { isLocked } = req.body;
    let license = await prisma.softwareLicense.findFirst({
      orderBy: { id: 'desc' }
    });

    const lockState = typeof isLocked === 'boolean' ? isLocked : true;

    if (license) {
      license = await prisma.softwareLicense.update({
        where: { id: license.id },
        data: { isLocked: lockState }
      });
    } else {
      const now = new Date();
      now.setDate(now.getDate() + 365);
      license = await prisma.softwareLicense.create({
        data: { expiresAt: now, isLocked: lockState }
      });
    }

    invalidateLicenseCache();

    res.json({
      message: `System ${lockState ? 'locked' : 'unlocked'} successfully`,
      license
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
