import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /api/master-data-post
router.post('/', async (req, res) => {
  try {
    const { type, name } = req.body;
    const tenantCompanyId = getTenantCompanyId(req);

    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    let createdRecord;

    switch (type) {
      case 'category':
        createdRecord = await prisma.category.create({ data: { name } });
        break;
      case 'company':
        createdRecord = await prisma.company.create({ data: { name } });
        break;
      case 'location':
        createdRecord = await prisma.location.create({ data: { name, companyId: tenantCompanyId || null } });
        break;
      case 'subCategory':
        createdRecord = await prisma.subCategory.create({ data: { name } });
        break;
      case 'mainGroup':
        createdRecord = await prisma.mainGroup.create({ data: { name } });
        break;
      case 'subGroup01':
        createdRecord = await prisma.subGroup01.create({ data: { name } });
        break;
      case 'subGroup02':
        createdRecord = await prisma.subGroup02.create({ data: { name } });
        break;
      case 'city':
        createdRecord = await prisma.cityRecord.create({ data: { name } });
        break;
      case 'customerType':
        createdRecord = await prisma.customerType.create({ data: { name } });
        break;
      case 'supplierType':
        createdRecord = await prisma.supplierType.create({ data: { name } });
        break;
      case 'pCat':
        createdRecord = await prisma.pCat.create({ data: { name, companyId: tenantCompanyId || null } });
        break;
      case 'subCat':
        createdRecord = await prisma.subCat.create({ data: { name, companyId: tenantCompanyId || null } });
        break;
      case 'pType':
        createdRecord = await prisma.pType.create({ data: { name } });
        break;
      case 'weightUnit':
        createdRecord = await prisma.weightUnit.create({ data: { name } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid master data type' });
    }

    res.status(201).json(createdRecord);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create master data record' });
  }
});

// DELETE /api/master-data-post/:type/:id
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
        deletedRecord = await prisma.pCat.delete({ where: { id: recordId } });
        break;
      case 'subCat':
        deletedRecord = await prisma.subCat.delete({ where: { id: recordId } });
        break;
      case 'pType':
        deletedRecord = await prisma.pType.delete({ where: { id: recordId } });
        break;
      case 'weightUnit':
        deletedRecord = await prisma.weightUnit.delete({ where: { id: recordId } });
        break;
      case 'company':
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
        error: 'Cannot delete record: it is referenced by other active product or inventory records in the database.'
      });
    }
    res.status(500).json({ error: error.message || 'Failed to delete master data record' });
  }
});

export default router;
