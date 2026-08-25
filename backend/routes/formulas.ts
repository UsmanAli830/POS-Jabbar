import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET all formulas
router.get('/', async (req, res) => {
  try {
    const formulas = await prisma.formula.findMany({
      include: {
        components: {
          include: {
            rawMaterialProduct: true
          }
        },
        products: true // Bundled products using this formula
      }
    });
    res.json(formulas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch formulas', details: error });
  }
});

// CREATE a formula
router.post('/', async (req, res) => {
  try {
    const { name, components } = req.body;
    
    // Check if formula already exists
    const existing = await prisma.formula.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Formula with this name already exists' });
    }

    const formula = await prisma.formula.create({
      data: {
        name,
        components: {
          create: components.map((comp: any) => ({
            rawMaterialProductId: Number(comp.rawMaterialProductId),
            quantityRequired: Number(comp.quantityRequired)
          }))
        }
      },
      include: {
        components: true
      }
    });
    res.status(201).json(formula);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create formula', details: error });
  }
});

// DELETE formula
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.formula.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete formula', details: error });
  }
});

export default router;
