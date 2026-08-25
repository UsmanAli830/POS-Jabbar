import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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
    res.status(500).json({ error: error.message || 'Failed to fetch customers', details: error });
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
    res.status(500).json({ error: error.message || 'Failed to fetch balance', details: error });
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
    res.status(500).json({ error: error.message || 'Failed to create customer', details: error });
  }
});

// PUT update a customer record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      custName, businessName, custCNIC, creditLimit, openingBalance, 
      phone, email, address, isActive, 
      zoneId, areaRecordId, routeId, loadTypeId, vanRecId 
    } = req.body;

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
    res.status(500).json({ error: error.message || 'Failed to update customer', details: error });
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
    
    // In Phase 2, we just hard delete them as there are no relations yet in CustomerRec
    const result = await prisma.customerRec.deleteMany({
      where: {
        id: {
          in: ids.map(id => Number(id))
        }
      }
    });
    
    deletedCount = result.count;

    res.json({ message: 'Bulk operation completed', deletedCount, deactivatedCount: 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to perform bulk delete', details: error });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

export default router;
