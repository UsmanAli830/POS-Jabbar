import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter, getTenantCompanyId, requirePermission } from '../middleware/auth';

const router = Router();

// GET next available customer code / ID
router.get('/next-code', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const customers = await prisma.customerRec.findMany({
      where: tenantFilter,
      select: { id: true }
    });

    const existingCodes = customers
      .map(c => Number(c.id))
      .filter(c => !isNaN(c) && c > 0);

    let nextCode = 1;
    while (existingCodes.includes(nextCode)) {
      nextCode++;
    }
    res.json({ nextCode: String(nextCode) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch next customer code' });
  }
});

// GET all customer records
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const customers = await prisma.customerRec.findMany({
      where: tenantFilter,
      include: {
        zone: true,
        areaRecord: true,
        route: true,
        loadType: true,
        vanRec: true,
        locations: true,
        finHead: {
          include: {
            cashFlowDtls: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const customersWithBalance = customers.map((c: any) => {
      let liveBalance = c.openingBalance || 0;
      if (c.finHead && c.finHead.cashFlowDtls) {
        const cr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((sum: number, d: any) => sum + d.amount, 0);
        const dr = c.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((sum: number, d: any) => sum + d.amount, 0);
        liveBalance = liveBalance + dr - cr; // Asset account: +DR, -CR
      }
      return { ...c, name: c.custName, liveBalance, CurrentBalance: liveBalance };
    });

    res.json(customersWithBalance);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET customer balance by ID
router.get('/:id/balance', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customerRec.findUnique({
      where: { id: Number(id) },
      include: {
        finHead: {
          include: {
            cashFlowDtls: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let liveBalance = customer.openingBalance || 0;
    if (customer.finHead && customer.finHead.cashFlowDtls) {
      const cr = customer.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'CR').reduce((sum: number, d: any) => sum + d.amount, 0);
      const dr = customer.finHead.cashFlowDtls.filter((d: any) => d.transactionType === 'DR').reduce((sum: number, d: any) => sum + d.amount, 0);
      liveBalance = liveBalance + dr - cr;
    }

    res.json({ balance: liveBalance });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// POST create a customer record
router.post('/', async (req, res) => {
  try {
    const { 
      custName, businessName, custCNIC, creditLimit, openingBalance, 
      phone, email, address, isActive, 
      zoneId, areaRecordId, routeId, loadTypeId, vanRecId, companyId
    } = req.body;

    const tenantCompanyId = getTenantCompanyId(req);
    const finalCompanyId = tenantCompanyId || (companyId ? Number(companyId) : undefined);

    const customer = await prisma.customerRec.create({
      data: {
        custName,
        businessName: businessName || null,
        custCNIC: custCNIC || null,
        creditLimit: creditLimit ? Number(creditLimit) : 0,
        openingBalance: openingBalance ? Number(openingBalance) : 0,
        phone: phone || null,
        email: email || null,
        address: address || null,
        isActive: isActive !== undefined ? isActive : true,
        zoneId: zoneId ? Number(zoneId) : null,
        areaRecordId: areaRecordId ? Number(areaRecordId) : null,
        routeId: routeId ? Number(routeId) : null,
        loadTypeId: loadTypeId ? Number(loadTypeId) : null,
        vanRecId: vanRecId ? Number(vanRecId) : null,
        companyId: finalCompanyId
      },
      include: {
        zone: true,
        areaRecord: true,
        route: true,
        loadType: true,
        vanRec: true,
      }
    });

    res.status(201).json({
      ...customer,
      name: customer.custName,
      liveBalance: customer.openingBalance,
      CurrentBalance: customer.openingBalance
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT update a customer record
router.put('/:id', requirePermission('customer:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      custName, businessName, custCNIC, creditLimit, openingBalance,
      phone, email, address, isActive,
      zoneId, areaRecordId, routeId, loadTypeId, vanRecId
    } = req.body;

    // Tenant guard: a store can only edit its own customers.
    const custTenantFilter = getTenantFilter(req);
    const existingCustomer = await prisma.customerRec.findFirst({ where: { id: Number(id), ...custTenantFilter } });
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found or unauthorized' });
    }

    const customer = await prisma.customerRec.update({
      where: { id: Number(id) },
      data: {
        custName,
        businessName: businessName || null,
        custCNIC: custCNIC || null,
        creditLimit: creditLimit !== undefined ? Number(creditLimit) : 0,
        openingBalance: openingBalance !== undefined ? Number(openingBalance) : 0,
        phone: phone || null,
        email: email || null,
        address: address || null,
        isActive: isActive !== undefined ? isActive : true,
        zoneId: zoneId ? Number(zoneId) : null,
        areaRecordId: areaRecordId ? Number(areaRecordId) : null,
        routeId: routeId ? Number(routeId) : null,
        loadTypeId: loadTypeId ? Number(loadTypeId) : null,
        vanRecId: vanRecId ? Number(vanRecId) : null,
      },
      include: {
        zone: true,
        areaRecord: true,
        route: true,
        loadType: true,
        vanRec: true,
      }
    });

    res.json({
      ...customer,
      name: customer.custName,
      liveBalance: customer.openingBalance,
      CurrentBalance: customer.openingBalance
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE bulk delete customers
router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid customer IDs provided.' });
    }

    let deletedCount = 0;

    // Tenant guard: a store can only delete its own customers.
    const tenantFilter = getTenantFilter(req);
    const result = await prisma.customerRec.deleteMany({
      where: {
        id: {
          in: ids.map((id: any) => Number(id))
        },
        ...tenantFilter
      }
    });
    
    deletedCount = result.count;

    res.json({ message: 'Bulk operation completed', deletedCount, deactivatedCount: 0 });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to perform bulk delete' });
  }
});

// GET customer locations
router.get('/:id/locations', async (req, res) => {
  try {
    const locations = await prisma.customerLocation.findMany({
      where: { customerRecId: Number(req.params.id) },
      orderBy: { id: 'asc' }
    });
    res.json(locations);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new customer location
router.post('/:id/locations', async (req, res) => {
  try {
    const { locationName, address, contactPerson, phone } = req.body;
    const location = await prisma.customerLocation.create({
      data: {
        customerRecId: Number(req.params.id),
        locationName,
        address,
        contactPerson,
        phone
      }
    });
    res.status(201).json(location);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update customer location
router.put('/:id/locations/:locId', async (req, res) => {
  try {
    const { locationName, address, contactPerson, phone } = req.body;
    const location = await prisma.customerLocation.update({
      where: { id: Number(req.params.locId) },
      data: {
        locationName,
        address,
        contactPerson,
        phone
      }
    });
    res.json(location);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE customer location
router.delete('/:id/locations/:locId', async (req, res) => {
  try {
    await prisma.customerLocation.delete({
      where: { id: Number(req.params.locId) }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
