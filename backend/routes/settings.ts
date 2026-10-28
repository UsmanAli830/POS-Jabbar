import { Router } from 'express';
import prisma from '../db';
import { getTenantCompanyId, requireAdmin } from '../middleware/auth';

const router = Router();

// Resolve (or lazily create) the StoreSettings row for the caller's company.
// Each tenant has its own settings row so one store can never read or overwrite
// another store's name, logo or negative-stock policy.
async function getOrCreateSettings(companyId: number | null) {
  let settings = await prisma.storeSettings.findFirst({
    where: companyId ? { companyId } : { companyId: null }
  });
  if (!settings) {
    settings = await prisma.storeSettings.create({
      data: companyId ? { companyId } : {}
    });
  }
  return settings;
}

// GET settings (any authenticated user of the store — used for receipts/branding)
router.get('/', async (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const settings = await getOrCreateSettings(companyId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT update settings (store admins only, scoped to their own company)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { storeName, storeAddress, receiptFooter, primaryColor, logoUrl, allowNegativeStock } = req.body;
    const companyId = getTenantCompanyId(req);
    const settings = await getOrCreateSettings(companyId);

    const updated = await prisma.storeSettings.update({
      where: { id: settings.id },
      data: {
        storeName,
        storeAddress,
        receiptFooter,
        primaryColor,
        logoUrl,
        allowNegativeStock: Boolean(allowNegativeStock)
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
