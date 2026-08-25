import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET all assets
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const assets = await prisma.assetRec.findMany({
      where: tenantFilter,
      include: {
        assetType: true,
        details: true,
        employeeRec: true
      },
      orderBy: { id: 'desc' }
    });
    res.json(assets);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch assets' });
  }
});

// POST create asset
router.post('/', async (req, res) => {
  try {
    const { name, assetTypeId, value, employeeRecId } = req.body;
    const asset = await prisma.assetRec.create({
      data: {
        name,
        assetTypeId: assetTypeId ? Number(assetTypeId) : null,
        value: Number(value || 0),
        employeeRecId: employeeRecId ? Number(employeeRecId) : null
      }
    });
    res.status(201).json(asset);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create asset' });
  }
});

// PUT update asset
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, assetTypeId, value, employeeRecId } = req.body;
    const asset = await prisma.assetRec.update({
      where: { id: Number(id) },
      data: {
        name,
        assetTypeId: assetTypeId ? Number(assetTypeId) : null,
        value: Number(value || 0),
        employeeRecId: employeeRecId ? Number(employeeRecId) : null
      }
    });
    res.json(asset);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update asset' });
  }
});

// DELETE asset
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.assetRec.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Asset deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete asset' });
  }
});

// GET all asset types
router.get('/types', async (req, res) => {
  try {
    const types = await prisma.assetType.findMany();
    res.json(types);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
