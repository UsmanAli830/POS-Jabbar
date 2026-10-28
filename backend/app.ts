import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import productsRouter from './routes/products';

import inventoryRouter from './routes/inventory';
import salesRouter from './routes/sales';
import financeRouter from './routes/finance';
import customersRouter from './routes/customers';
import vendorsRouter from './routes/vendors';
import hrRouter from './routes/hr';
import masterDataRouter from './routes/masterData';
import wastageRouter from './routes/wastage';
import settingsRouter from './routes/settings';
import paymentsRouter from './routes/payments';
import returnsRouter from './routes/returns';
import purchasesRouter from './routes/purchases';
import assetsRouter from './routes/assets';
import promotionsRouter from './routes/promotions';
import formulasRouter from './routes/formulas';
import bookingsRouter from './routes/bookings';
import dashboardRouter from './routes/dashboard';
import analyticsRouter from './routes/analytics';
import reportsRouter from './routes/reports';
import ledgerRouter from './routes/ledger';
import duesRouter from './routes/dues';
import receiptsRouter from './routes/receipts';
import authRouter from './routes/auth';
import permissionsRouter from './routes/permissions';
import superAdminRouter from './routes/superAdmin';
import licenseRouter from './routes/license';
import backupRouter from './routes/backup';
import { checkLicense } from './middleware/license';
import { getTenantFilter, authenticate } from './middleware/auth';
import bcrypt from 'bcryptjs';
import prisma from './db';

const existingDbUrl = process.env.DATABASE_URL;
dotenv.config();
if (existingDbUrl) {
  process.env.DATABASE_URL = existingDbUrl;
}

const app = express();

// Multi-Device LAN & Localhost CORS configuration.
// Anchored patterns so an attacker domain that merely CONTAINS "10." or
// "192.168." (e.g. http://evil-10.attacker.com) is no longer accepted.
app.use(cors({
  origin: [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/
  ],
  credentials: true
}));

app.use(express.json());

// Super Admin License & Expiry Verification Middleware
app.use(checkLicense);

// GLOBAL AUTHENTICATION GATE
// Every /api route requires a valid JWT except the small public whitelist
// below. This closes the previous hole where ~20 routers had no auth at all
// (unauthenticated password resets, licence tampering, settings overwrite,
// bulk employee deletion, etc.). Individual routers may still add their own
// finer-grained guards (requireAdmin / requireSuperAdmin / requirePermission).
const PUBLIC_API_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/health',
  '/api/license/status' // read-only; needed by the lockout screen before/without login
]);
app.use((req, res, next) => {
  const p = req.path || '';
  if (!p.startsWith('/api')) return next();
  if (PUBLIC_API_PATHS.has(p)) return next();
  return authenticate(req, res, next);
});

// Routes
app.use('/api/super-admin', superAdminRouter);
app.use('/api/license', licenseRouter);
app.use('/api/auth', authRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);
app.use('/api/finance', financeRouter);
app.use('/api/customers', customersRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/hr', hrRouter);
app.use('/api/employees', hrRouter);
app.use('/api/master-data-post', masterDataRouter);
app.use('/api/wastage', wastageRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/formulas', formulasRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/ledger', ledgerRouter);
app.use('/api/dues', duesRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/backup', backupRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
});

app.get('/api/master-data', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const [pCats, newSubCats, locations, companies, cities, customerTypes, supplierTypes, mainGroups, subGroup01s, subGroup02s, pTypes, weightUnits, activeTypes, zones, areaRecords, routes, loadTypes, vanRecs, employees] = await Promise.all([
      prisma.pCat.findMany({ where: tenantFilter }),
      prisma.subCat.findMany({ where: tenantFilter }),
      prisma.location.findMany({ where: tenantFilter }),
      prisma.company.findMany({ where: tenantFilter.companyId ? { id: tenantFilter.companyId } : { id: -1 } }),
      prisma.cityRecord.findMany(),
      prisma.customerType.findMany(),
      prisma.supplierType.findMany(),
      prisma.mainGroup.findMany(),
      prisma.subGroup01.findMany(),
      prisma.subGroup02.findMany(),
      prisma.pType.findMany(),
      prisma.weightUnit.findMany(),
      prisma.activeType.findMany(),
      prisma.zone.findMany({ where: tenantFilter }),
      prisma.areaRecord.findMany({ where: tenantFilter }),
      prisma.route.findMany({ where: tenantFilter }),
      prisma.loadType.findMany(),
      prisma.vanRec.findMany(),
      prisma.employeeRec.findMany({
        where: {
          role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
          username: { notIn: ['admin', 'superadmin'] },
          ...tenantFilter
        },
        orderBy: {
          name: 'asc'
        }
      })
    ]);

    // Format categories & subCategories directly from tenant-scoped pCats/subCats
    const categories = pCats.map((c: any) => ({ id: c.id, name: c.name }));
    const subCategories = newSubCats.map((s: any) => ({ id: s.id, name: s.name, pCatId: s.pCatId }));

    res.json({
      categories,
      companies,
      locations,
      cities,
      customerTypes,
      supplierTypes,
      subCategories,
      mainGroups,
      subGroup01s,
      subGroup02s,
      pCats,
      newSubCats,
      pTypes,
      weightUnits,
      activeTypes,
      zones,
      areaRecords,
      routes,
      loadTypes,
      vanRecs,
      employees
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch master data', details: error });
  }
});

// --- SERVE FRONTEND PRODUCTION BUILD (SPA FALLBACK) ---
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
const altFrontendDistPath = path.join(__dirname, '../frontend/dist');

// Check and serve static files
app.use(express.static(frontendDistPath));
app.use(express.static(altFrontendDistPath));

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = fs.existsSync(path.join(frontendDistPath, 'index.html'))
    ? path.join(frontendDistPath, 'index.html')
    : path.join(altFrontendDistPath, 'index.html');
    
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// CENTRAL ERROR HANDLER
// Catches anything thrown/next'd by route handlers. Logs the full error
// server-side but returns only a generic message so internal details
// (Prisma query internals, file paths, stack traces) never reach clients.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Error]', req.method, req.path, err);
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({ error: 'Internal server error' });
});

export default app;


