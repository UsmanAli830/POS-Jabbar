import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET settings
router.get('/', async (req, res) => {
  try {
    let settings = await prisma.storeSettings.findFirst();
    
    // Fallback if somehow not seeded
    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {}
      });
    }

    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
});

// PUT update settings
router.put('/', async (req, res) => {
  try {
    const { storeName, storeAddress, receiptFooter, primaryColor, logoUrl, allowNegativeStock } = req.body;
    
    let settings = await prisma.storeSettings.findFirst();
    if (!settings) {
      settings = await prisma.storeSettings.create({ data: {} });
    }

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
    res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
});

export default router;
