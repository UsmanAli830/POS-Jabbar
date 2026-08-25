import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import { getTenantFilter } from './middleware/auth';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Multi-Device LAN & Localhost CORS configuration
app.use(cors({
  origin: [
    /localhost/,
    /127\.0\.0\.1/,
    /192\.168\./,
    /10\./,
    /172\.(1[6-9]|2[0-9]|3[0-1])\./
  ],
  credentials: true
}));

app.use(express.json());

// Super Admin License & Expiry Verification Middleware
app.use(checkLicense);

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
    const categories = pCats.map(c => ({ id: c.id, name: c.name }));
    const subCategories = newSubCats.map(s => ({ id: s.id, name: s.name, pCatId: s.pCatId }));

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

export default app;
