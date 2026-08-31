import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /api/master-data-post - Create master data record
router.post('/', async (req, res) => {
  try {
    const { type, name } = req.body;
    const tenantCompanyId = getTenantCompanyId(req);

    if (!type || !name || !name.trim()) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    const trimmedName = name.trim();
    let createdRecord;

    switch (type) {
      case 'category':
        createdRecord = await prisma.category.create({ data: { name: trimmedName } });
        break;
      case 'company':
        createdRecord = await prisma.company.create({ data: { name: trimmedName } });
        break;
      case 'location':
        createdRecord = await prisma.location.create({ data: { name: trimmedName, companyId: tenantCompanyId || null } });
        break;
      case 'subCategory':
        createdRecord = await prisma.subCategory.create({ data: { name: trimmedName } });
        break;
      case 'mainGroup':
        createdRecord = await prisma.mainGroup.create({ data: { name: trimmedName } });
        break;
      case 'subGroup01':
        createdRecord = await prisma.subGroup01.create({ data: { name: trimmedName } });
        break;
      case 'subGroup02':
        createdRecord = await prisma.subGroup02.create({ data: { name: trimmedName } });
        break;
      case 'city':
        createdRecord = await prisma.cityRecord.create({ data: { name: trimmedName } });
        break;
      case 'customerType':
        createdRecord = await prisma.customerType.create({ data: { name: trimmedName } });
        break;
      case 'supplierType':
        createdRecord = await prisma.supplierType.create({ data: { name: trimmedName } });
        break;
      case 'pCat':
        createdRecord = await prisma.pCat.create({ data: { name: trimmedName, companyId: tenantCompanyId || null } });
        break;
      case 'subCat':
        createdRecord = await prisma.subCat.create({ data: { name: trimmedName, companyId: tenantCompanyId || null } });
        break;
      case 'pType':
        createdRecord = await prisma.pType.create({ data: { name: trimmedName } });
        break;
      case 'weightUnit':
        createdRecord = await prisma.weightUnit.create({ data: { name: trimmedName } });
        break;
      case 'zone':
        createdRecord = await prisma.zone.create({ data: { name: trimmedName, companyId: tenantCompanyId || null } });
        break;
      case 'area':
      case 'areaRecord':
        createdRecord = await prisma.areaRecord.create({ data: { name: trimmedName, companyId: tenantCompanyId || null } });
        break;
      case 'route':
        createdRecord = await prisma.route.create({ data: { name: trimmedName, companyId: tenantCompanyId || null } });
        break;
      case 'loadType':
        createdRecord = await prisma.loadType.create({ data: { name: trimmedName } });
        break;
      case 'vanRec':
        createdRecord = await prisma.vanRec.create({ data: { name: trimmedName } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid master data type' });
    }

    res.status(201).json(createdRecord);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create master data record' });
  }
});

// PUT /api/master-data-post/:type/:id - Update/Rename master data record
router.put('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { name } = req.body;
    const recordId = parseInt(id);

    if (isNaN(recordId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim();
    let updatedRecord;

    switch (type) {
      case 'pCat':
        updatedRecord = await prisma.pCat.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      case 'subCat':
        updatedRecord = await prisma.subCat.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      case 'pType':
        updatedRecord = await prisma.pType.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      case 'weightUnit':
        updatedRecord = await prisma.weightUnit.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      case 'company':
        updatedRecord = await prisma.company.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      case 'location':
        updatedRecord = await prisma.location.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      case 'category':
        updatedRecord = await prisma.category.update({ where: { id: recordId }, data: { name: trimmedName } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid master data type' });
    }

    res.json({ message: 'Record updated successfully', updatedRecord });
  } catch (error: any) {
    console.error('Update master data failed:', error);
    res.status(500).json({ error: error.message || 'Failed to update master data record' });
  }
});

// DELETE /api/master-data-post/:type/:id - Delete master data record (with safe reference detaching)
router.delete('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const recordId = parseInt(id);

    if (isNaN(recordId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    let deletedRecord;
    switch (type) {
      case 'pCat':
        // Detach referencing products and subcategories
        await prisma.productRec.updateMany({ where: { pCatId: recordId }, data: { pCatId: null } });
        await prisma.subCat.updateMany({ where: { pCatId: recordId }, data: { pCatId: null } });
        deletedRecord = await prisma.pCat.delete({ where: { id: recordId } });
        break;
      case 'subCat':
        await prisma.productRec.updateMany({ where: { subCatId: recordId }, data: { subCatId: null } });
        deletedRecord = await prisma.subCat.delete({ where: { id: recordId } });
        break;
      case 'pType':
        // Detach referencing products
        await prisma.productRec.updateMany({ where: { pTypeId: recordId }, data: { pTypeId: null } });
        deletedRecord = await prisma.pType.delete({ where: { id: recordId } });
        break;
      case 'weightUnit':
        await prisma.productRec.updateMany({ where: { weightUnitId: recordId }, data: { weightUnitId: null } });
        deletedRecord = await prisma.weightUnit.delete({ where: { id: recordId } });
        break;
      case 'company':
        // If it's a tenant company, check if it's the primary company
        deletedRecord = await prisma.company.delete({ where: { id: recordId } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid master data type' });
    }

    res.json({ message: 'Record deleted successfully', deletedRecord });
  } catch (error: any) {
    console.error('Delete master data failed:', error);
    // Prisma Foreign Key Constraint error code is P2003
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete record: it is actively referenced by other critical ledger or system records.'
      });
    }
    res.status(500).json({ error: error.message || 'Failed to delete master data record' });
  }
});

export default router;

