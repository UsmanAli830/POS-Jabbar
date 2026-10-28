import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();

// GET next available vendor code / ID
router.get('/next-code', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const vendors = await prisma.sellerRec.findMany({
      where: tenantFilter,
      select: { id: true }
    });

    const existingCodes = vendors
      .map(v => Number(v.id))
      .filter(v => !isNaN(v) && v > 0);

    let nextCode = 1;
    while (existingCodes.includes(nextCode)) {
      nextCode++;
    }
    res.json({ nextCode: String(nextCode) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch next vendor code' });
  }
});

// GET all vendors (SellerRec)
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const vendors = await prisma.sellerRec.findMany({
      where: tenantFilter,
      include: {
        locations: true,
        finHead: {
          include: {
            cashFlowDtls: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const vendorsWithBalance = vendors.map((vendor: any) => {
      let liveBalance = vendor.openingBalance || 0;
      if (vendor.finHead && vendor.finHead.cashFlowDtls) {
        const cr = vendor.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((sum: number, d: any) => sum + d.amount, 0);
        const dr = vendor.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((sum: number, d: any) => sum + d.amount, 0);
        liveBalance = liveBalance + cr - dr; // Liability account: +CR, -DR
      }
      return { ...vendor, liveBalance };
    });

    res.json(vendorsWithBalance);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// POST create a vendor
router.post('/', async (req, res) => {
  try {
    const { companyName, contactPerson, sellerCNIC, phone, email, address, isActive, openingBalance, companyId } = req.body;

    const tenantCompanyId = getTenantCompanyId(req);
    const finalCompanyId = tenantCompanyId || (companyId ? Number(companyId) : undefined);

    const vendor = await prisma.sellerRec.create({
      data: {
        companyName,
        contactPerson: contactPerson || null,
        sellerCNIC: sellerCNIC || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        isActive: isActive !== undefined ? isActive : true,
        openingBalance: openingBalance ? Number(openingBalance) : 0,
        companyId: finalCompanyId
      }
    });

    res.status(201).json(vendor);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// PUT update a vendor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, contactPerson, sellerCNIC, phone, email, address, isActive, openingBalance } = req.body;

    // Tenant guard: a store can only edit its own vendors.
    const tenantFilter = getTenantFilter(req);
    const existingVendor = await prisma.sellerRec.findFirst({ where: { id: Number(id), ...tenantFilter } });
    if (!existingVendor) {
      return res.status(404).json({ error: 'Vendor not found or unauthorized' });
    }

    const vendor = await prisma.sellerRec.update({
      where: { id: Number(id) },
      data: {
        companyName,
        contactPerson: contactPerson || null,
        sellerCNIC: sellerCNIC || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        isActive: isActive !== undefined ? isActive : true,
        openingBalance: openingBalance !== undefined ? Number(openingBalance) : 0,
      }
    });

    res.json(vendor);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// DELETE bulk delete vendors
router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid vendor IDs provided.' });
    }

    const tenantFilter = getTenantFilter(req);
    const result = await prisma.sellerRec.deleteMany({
      where: {
        id: {
          in: ids.map((id: any) => Number(id))
        },
        ...tenantFilter
      }
    });

    res.json({ message: 'Bulk operation completed', deletedCount: result.count, deactivatedCount: 0 });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to perform bulk delete' });
  }
});

// GET vendor balance
router.get('/:id/balance', async (req, res) => {
  try {
    const vendor = await prisma.sellerRec.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        finHead: {
          include: { cashFlowDtls: true }
        }
      }
    });

    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    let balance = vendor.openingBalance || 0;
    if (vendor.finHead && vendor.finHead.cashFlowDtls) {
      const cr = vendor.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((sum: number, d: any) => sum + d.amount, 0);
      const dr = vendor.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((sum: number, d: any) => sum + d.amount, 0);
      balance = balance + cr - dr; 
    }

    res.json({ balance });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET vendor locations
router.get('/:id/locations', async (req, res) => {
  try {
    const locations = await prisma.vendorLocation.findMany({
      where: { sellerRecId: Number(req.params.id) }
    });
    res.json(locations);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new vendor location
router.post('/:id/locations', async (req, res) => {
  try {
    const { locationName } = req.body;
    const location = await prisma.vendorLocation.create({
      data: {
        sellerRecId: Number(req.params.id),
        locationName
      }
    });
    res.status(201).json(location);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE vendor location
router.delete('/:id/locations/:locId', async (req, res) => {
  try {
    await prisma.vendorLocation.delete({
      where: { id: Number(req.params.locId) }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
