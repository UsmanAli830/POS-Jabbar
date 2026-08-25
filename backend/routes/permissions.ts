import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Standard permission modules defined for the system
export const STANDARD_MODULES = [
  // Sales
  { key: 'pos', name: 'Cash Register (POS)', category: 'Sales' },
  { key: 'sales', name: 'Sales Invoicing & Orders', category: 'Sales' },
  { key: 'bookings', name: 'Order Booking Sheet', category: 'Sales' },
  { key: 'sales-return', name: 'Sales Returns', category: 'Sales' },
  { key: 'promotions', name: 'Promotions & Discounts', category: 'Sales' },

  // Inventory
  { key: 'products', name: 'Product Catalog', category: 'Inventory' },
  { key: 'inventory', name: 'Inventory Control', category: 'Inventory' },
  { key: 'purchases', name: 'Purchase Management', category: 'Inventory' },
  { key: 'purchase-return', name: 'Purchase Returns', category: 'Inventory' },
  { key: 'returns', name: 'Damages & Wastage', category: 'Inventory' },
  { key: 'barcode-studio', name: 'Barcode Studio', category: 'Inventory' },
  { key: 'bulk', name: 'Bulk Price & Stock Update', category: 'Inventory' },
  { key: 'formulas', name: 'Formulas & Production', category: 'Inventory' },

  // Reports
  { key: 'dashboard', name: 'Executive Dashboard', category: 'Reports' },
  { key: 'sales-analysis', name: 'Sales & Profit Analysis', category: 'Reports' },
  { key: 'balance-sheet', name: 'Balance Sheet Audit', category: 'Reports' },
  { key: 'unified-statement', name: 'Unified Ledger & Profit Statement', category: 'Reports' },
  { key: 'profit-loss', name: 'Profit & Loss Statement', category: 'Reports' },
  { key: 'reports-master', name: 'Reports & Analytics Master', category: 'Reports' },
  { key: 'bill-ledger', name: 'Sales Ledger (Bill Register)', category: 'Reports' },
  { key: 'receipt-center', name: 'Receipt Center', category: 'Reports' },

  // Accounts
  { key: 'customer-dues', name: 'Customer Dues Management', category: 'Accounts' },
  { key: 'vendor-dues', name: 'Vendor Dues Management', category: 'Accounts' },
  { key: 'general-ledger', name: 'Master General Ledger', category: 'Accounts' },
  { key: 'cash-recovery', name: 'Cash Recovery (Customers)', category: 'Accounts' },
  { key: 'vendor-payments', name: 'Vendor Payments', category: 'Accounts' },
  { key: 'pending-payments', name: 'Pending Payments', category: 'Accounts' },
  { key: 'advance-salary', name: 'Advance Salary Logger', category: 'Accounts' },
  { key: 'attendance', name: 'Employee Attendance', category: 'Accounts' },
  { key: 'payroll', name: 'Payroll & Salary Disbursal', category: 'Accounts' },
  { key: 'assets-expenses', name: 'Assets & Expenses Hub', category: 'Accounts' },

  // Management
  { key: 'customers', name: 'Customer Master', category: 'Manage' },
  { key: 'vendors', name: 'Vendor Master', category: 'Manage' },
  { key: 'employees', name: 'Employee Master', category: 'Manage' },
  { key: 'employee-portal', name: 'Employee Self-Service Portal', category: 'Manage' },
  { key: 'change-password', name: 'Change Credentials', category: 'Manage' },
  { key: 'settings', name: 'Store Settings', category: 'Manage' }
];

// GET /api/permissions/modules - List all defined modules
router.get('/modules', authenticate, (req, res) => {
  res.json(STANDARD_MODULES);
});

// GET /api/permissions/employees - List all employees for permission control (Admin only)
router.get('/employees', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.username === 'superadmin' || req.user?.username === 'admin';
    const where: any = {};
    if (!isSuper) {
      where.role = { not: 'SUPER_ADMIN' };
      where.username = { notIn: ['admin', 'superadmin'] };
      where.companyId = req.user?.companyId ? Number(req.user.companyId) : -1;
    }

    const employees = await prisma.employeeRec.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        isAdmin: true,
        role: true,
        companyId: true,
        postRec: {
          select: {
            id: true,
            title: true
          }
        },
        permissions: true
      },
      orderBy: { id: 'asc' }
    });
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch employees' });
  }
});

// GET /api/permissions/employee/:employeeId - Get permissions for specific employee (Admin only)
router.get('/employee/:employeeId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const employeeId = parseInt(String(req.params.employeeId), 10);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const employee = await prisma.employeeRec.findUnique({
      where: { id: employeeId },
      include: {
        permissions: true,
        postRec: true
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const isRequesterSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.username === 'admin' || req.user?.username === 'superadmin';
    const isTargetSuper = employee.role === 'SUPER_ADMIN' || employee.username === 'admin' || employee.username === 'superadmin';

    if (isTargetSuper && !isRequesterSuper) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!isRequesterSuper && req.user?.companyId && employee.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      employee: {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        role: employee.role,
        isAdmin: employee.isAdmin,
        companyId: employee.companyId,
        postRec: employee.postRec
      },
      permissions: employee.permissions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch permissions' });
  }
});

// PUT /api/permissions/employee/:employeeId - Update permissions for specific employee (Admin only)
router.put('/employee/:employeeId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const employeeId = parseInt(String(req.params.employeeId), 10);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const { permissions, isAdmin } = req.body; // permissions: Array<{ pageRoute: string, isAllowed: boolean }>

    const employee = await prisma.employeeRec.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const isRequesterSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.username === 'admin' || req.user?.username === 'superadmin';
    const isTargetSuper = employee.role === 'SUPER_ADMIN' || employee.username === 'admin' || employee.username === 'superadmin';

    if (isTargetSuper && !isRequesterSuper) {
      return res.status(403).json({ error: 'Cannot modify Super Administrator permissions.' });
    }

    // Update isAdmin if specified (prevent revoking admin on master 'admin')
    if (typeof isAdmin === 'boolean') {
      await prisma.employeeRec.update({
        where: { id: employeeId },
        data: {
          isAdmin: isTargetSuper ? true : isAdmin
        }
      });
    }

    // Upsert or delete permissions
    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        if (!p.pageRoute) continue;
        await prisma.userPermission.upsert({
          where: {
            employeeRecId_pageRoute: {
              employeeRecId: employeeId,
              pageRoute: p.pageRoute
            }
          },
          update: {
            isAllowed: Boolean(p.isAllowed)
          },
          create: {
            employeeRecId: employeeId,
            userLoginId: employeeId,
            pageRoute: p.pageRoute,
            isAllowed: Boolean(p.isAllowed)
          }
        });
      }
    }

    const updatedPermissions = await prisma.userPermission.findMany({
      where: { employeeRecId: employeeId }
    });

    res.json({
      message: 'Permissions saved successfully',
      permissions: updatedPermissions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update permissions' });
  }
});

// GET /api/permissions/my-permissions - Get current logged-in user permissions
router.get('/my-permissions', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const employee = await prisma.employeeRec.findUnique({
      where: { id: userId },
      include: {
        permissions: true
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const isAdmin = employee.isAdmin || employee.username === 'admin';
    const allowed = isAdmin 
      ? STANDARD_MODULES.map(m => m.key) 
      : employee.permissions.filter(p => p.isAllowed).map(p => p.pageRoute);

    res.json({
      isAdmin,
      permissions: allowed,
      rawPermissions: employee.permissions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch current user permissions' });
  }
});

export default router;
