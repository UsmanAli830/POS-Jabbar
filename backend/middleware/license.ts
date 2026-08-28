import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-12345';

// In-memory cache for licenses to avoid DB queries on every single request
const companyLicenseCache = new Map<number, { expiresAt: Date; isLocked: boolean; lastChecked: number }>();
let globalLicenseCache: { expiresAt: Date; isLocked: boolean; lastChecked: number } | null = null;
const CACHE_TTL_MS = 5000; // Recheck every 5 seconds

/**
 * Resets license cache when license is modified
 */
export function invalidateLicenseCache() {
  companyLicenseCache.clear();
  globalLicenseCache = null;
}

/**
 * Helper to fetch or seed company license
 */
export async function getCompanyLicense(companyId?: number | null) {
  const now = Date.now();

  if (companyId) {
    const cached = companyLicenseCache.get(companyId);
    if (cached && now - cached.lastChecked < CACHE_TTL_MS) {
      return cached;
    }

    let license = await prisma.softwareLicense.findFirst({
      where: { companyId },
      orderBy: { id: 'desc' }
    });

    if (!license) {
      // Create default 365-day license for this company
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);
      license = await prisma.softwareLicense.create({
        data: {
          companyId,
          expiresAt: futureDate,
          isLocked: false
        }
      });
    }

    const entry = {
      expiresAt: new Date(license.expiresAt),
      isLocked: Boolean(license.isLocked),
      lastChecked: now
    };
    companyLicenseCache.set(companyId, entry);
    return entry;
  }

  // Global fallback license
  if (globalLicenseCache && now - globalLicenseCache.lastChecked < CACHE_TTL_MS) {
    return globalLicenseCache;
  }

  let license = await prisma.softwareLicense.findFirst({
    orderBy: { id: 'desc' }
  });

  if (!license) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365);
    license = await prisma.softwareLicense.create({
      data: {
        expiresAt: futureDate,
        isLocked: false
      }
    });
  }

  globalLicenseCache = {
    expiresAt: new Date(license.expiresAt),
    isLocked: Boolean(license.isLocked),
    lastChecked: now
  };

  return globalLicenseCache;
}

export async function getOrSeedLicense() {
  return getCompanyLicense(null);
}

/**
 * Global License Expiry Middleware with 3-Tier Per-Company Verification
 */
export async function checkLicense(req: Request, res: Response, next: NextFunction) {
  const path = req.path || '';

  // 1. Pass through all non-API routes — static files, SPA root, etc. must never be blocked
  if (!path.startsWith('/api')) {
    return next();
  }

  // 2. Whitelist essential, Auth, Super Admin, and License management routes
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/super-admin') ||
    path.startsWith('/api/license') ||
    path === '/api/health' ||
    path === '/health'
  ) {
    return next();
  }

  // 2. Inspect Token to identify user role and company
  let userRole = 'GUEST';
  let userCompanyId: number | null = null;
  let username = '';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userRole = decoded.role || 'EMPLOYEE';
      userCompanyId = decoded.companyId || null;
      username = decoded.username || '';
    } catch (e) {
      // Invalid/expired token, let auth middleware handle 401 later
    }
  }

  // 3. Super Admin bypass: Tier 1 Super Admin is never blocked by company expiry
  if (userRole === 'SUPER_ADMIN' || username === 'admin' || username === 'superadmin') {
    return next();
  }

  try {
    const license = await getCompanyLicense(userCompanyId);
    const now = new Date();

    const isPastExpiry = now.getTime() > license.expiresAt.getTime();
    const isLocked = license.isLocked || isPastExpiry;

    if (isLocked) {
      return res.status(403).json({
        error: 'LICENSE_EXPIRED',
        message: 'Your access duration has ended. Please contact the administrator to renew.',
        expiresAt: license.expiresAt.toISOString(),
        isLocked: license.isLocked,
        isExpired: isPastExpiry,
        companyId: userCompanyId
      });
    }

    next();
  } catch (error: any) {
    console.error('[License Guard] Error checking license:', error);
    next();
  }
}

