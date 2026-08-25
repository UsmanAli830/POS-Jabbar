import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantFilter, getTenantCompanyId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET all products
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const products = await prisma.productRec.findMany({
      where: tenantFilter,
      include: {
        pCat: true,
        subCat: true,
        pType: true,
        weightUnit: true,
        formula: true,
        company: true,
        activeType: true
      }
    });

    // Map to POS-compatible shape: add salePrice alias and UOM fields
    const mapped = products.map((p: any) => ({
      ...p,
      salePrice: p.retailPrice ?? 0,
      packSize: p.packSize ?? 1,
      baseUom: p.baseUom ?? 'PCS',
      bulkUom: p.bulkUom ?? 'CTN',
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products', details: error });
  }
});

// GET search product by barcode
router.get('/search', async (req, res) => {
  try {
    const { barcode } = req.query;
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode parameter is required' });
    }

    const tenantFilter = getTenantFilter(req);
    const product = await prisma.productRec.findFirst({
      where: {
        barCode: String(barcode),
        ...tenantFilter
      },
      include: {
        pCat: true,
        subCat: true,
        pType: true,
        weightUnit: true,
        formula: true,
        company: true,
        activeType: true
      }
    });

    if (product) {
      const p: any = product;
      const mapped = {
        ...p,
        salePrice: p.retailPrice ?? 0,
        packSize: p.packSize ?? 1,
        baseUom: p.baseUom ?? 'PCS',
        bulkUom: p.bulkUom ?? 'CTN',
      };
      res.json(mapped);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to search product', details: error });
  }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenantFilter = getTenantFilter(req);
    const product = await prisma.productRec.findFirst({
      where: { id, ...tenantFilter },
      include: {
        pCat: true,
        subCat: true,
        pType: true,
        weightUnit: true,
        formula: true,
        company: true,
        activeType: true
      }
    });
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product', details: error });
  }
});

function parseProductData(body: any) {
  const data = { ...body };

  // Convert strings to numbers if they exist
  const numericFields = [
    'retailPrice', 'costPrice', 'wholeSalePrice', 'tradePrice', 'currentStock', 'minLevel', 'dangerLevel',
    'pCatId', 'subCatId', 'pTypeId', 'weightUnitId', 'formulaId', 'companyId', 'activeTypeId'
  ];
  
  numericFields.forEach(field => {
    if (data[field] !== undefined && data[field] !== null) {
      if (data[field] === '') {
        data[field] = null;
      } else {
        data[field] = Number(data[field]);
      }
    }
  });

  // String optional unique fields
  if (data.barCode === '') data.barCode = null;
  if (data.productCode === '') data.productCode = null;

  // Strictly whitelist allowed fields for Prisma ProductRec model
  const allowedFields = [
    'productCode', 'barCode', 'productName', 
    'retailPrice', 'costPrice', 'wholeSalePrice', 'tradePrice', 'currentStock', 'minLevel', 'dangerLevel',
    'pCatId', 'subCatId', 'pTypeId', 'weightUnitId', 'formulaId', 'companyId', 'activeTypeId'
  ];

  const filteredData: any = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      filteredData[key] = data[key];
    }
  }

  return filteredData;
}

// POST (Create a new product)
router.post('/', async (req, res) => {
  try {
    const parsedData = parseProductData(req.body);
    const tenantCompanyId = getTenantCompanyId(req);
    if (tenantCompanyId && !parsedData.companyId) {
      parsedData.companyId = tenantCompanyId;
    }
    const product = await prisma.productRec.create({
      data: parsedData
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create product', details: error });
  }
});

// POST (Bulk generate new products with barcodes)
router.post('/bulk-generate', async (req, res) => {
  try {
    const { 
      quantityToGenerate, 
      productName, 
      pCatId, 
      companyId, 
      retailPrice, 
      costPrice 
    } = req.body;

    const qty = parseInt(quantityToGenerate);
    if (isNaN(qty) || qty <= 0 || qty > 1000) {
      return res.status(400).json({ error: 'quantityToGenerate must be between 1 and 1000' });
    }

    const tenantCompanyId = getTenantCompanyId(req);
    const finalCompanyId = tenantCompanyId || (companyId ? Number(companyId) : null);

    const timestampBase = Date.now().toString().slice(-8);
    const baseCode = Math.floor(Math.random() * 90) + 10;

    const result = await prisma.$transaction(
      Array.from({ length: qty }).map((_, i) => {
        const sequence = i.toString().padStart(2, '0');
        const uniqueBarcode = `${timestampBase}${baseCode}${sequence}`;

        return prisma.productRec.create({
          data: {
            productCode: `BKG-${uniqueBarcode}`,
            barCode: uniqueBarcode,
            productName: `${productName} (${i + 1})`,
            costPrice: Number(costPrice) || 0,
            retailPrice: Number(retailPrice) || 0,
            currentStock: 0,
            minLevel: 0,
            pCatId: pCatId ? Number(pCatId) : null,
            companyId: finalCompanyId
          }
        });
      })
    );

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Bulk generation failed', details: error });
  }
});

// PUT (Bulk update products)
router.put('/bulk', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Expected array of updates' });
    }

    const result = await prisma.$transaction(
      updates.map(update => 
        prisma.productRec.update({
          where: { id: update.id },
          data: {
            retailPrice: update.retailPrice !== undefined ? Number(update.retailPrice) : undefined,
            costPrice: update.costPrice !== undefined ? Number(update.costPrice) : undefined,
            barCode: update.barCode !== undefined ? update.barCode : undefined,
            pCatId: update.pCatId !== undefined ? (update.pCatId ? Number(update.pCatId) : null) : undefined,
          }
        })
      )
    );

    res.json({ success: true, updatedCount: result.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Bulk update failed', details: error });
  }
});

// PUT (Update a single product)
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenantFilter = getTenantFilter(req);
    const existing = await prisma.productRec.findFirst({ where: { id, ...tenantFilter } });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    const parsedData = parseProductData(req.body);
    const tenantCompanyId = getTenantCompanyId(req);
    if (tenantCompanyId) {
      parsedData.companyId = tenantCompanyId;
    }

    const product = await prisma.productRec.update({
      where: { id },
      data: parsedData
    });
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update product', details: error });
  }
});

// DELETE (Bulk delete products)
router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Expected a non-empty array of ids' });
    }

    const tenantFilter = getTenantFilter(req);
    const result = await prisma.productRec.deleteMany({
      where: { id: { in: ids.map(id => parseInt(id)) }, ...tenantFilter }
    });
    
    res.json({ message: 'Products deleted successfully', count: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete products', details: error });
  }
});

// DELETE (Delete a product)
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenantFilter = getTenantFilter(req);
    const existing = await prisma.productRec.findFirst({ where: { id, ...tenantFilter } });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    await prisma.productRec.delete({
      where: { id }
    });
    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete product', details: error });
  }
});

// POST (Bulk upload products from CSV/Excel)
router.post('/bulk-upload', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) return res.status(400).json({ error: 'Expected array of products' });

    const tenantCompanyId = getTenantCompanyId(req);
    let createdCount = 0;
    for (const p of products) {
      if (!p.productName) continue;
      
      const parsedData = parseProductData(p);
      if (tenantCompanyId) {
        parsedData.companyId = tenantCompanyId;
      }

      if (!parsedData.productCode || parsedData.productCode.trim() === '') {
        parsedData.productCode = `CSV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000)}`;
      }
      if (!parsedData.barCode || parsedData.barCode.trim() === '') {
        parsedData.barCode = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
      }

      try {
        await prisma.productRec.create({
          data: parsedData
        });
        createdCount++;
      } catch (err: any) {
        console.error(`Skipping row due to error: ${err.message}`);
      }
    }

    res.status(201).json({ success: true, createdCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Bulk upload failed', details: error });
  }
});

export default router;
