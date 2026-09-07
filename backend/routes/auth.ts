import { Router } from 'express';
import prisma from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'pos_secret_key_2024';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, loginGate } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const employee = await prisma.employeeRec.findUnique({
      where: { username: username.trim() },
      include: {
        permissions: true,
        company: {
          include: {
            licenses: {
              orderBy: { id: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!employee || !employee.password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    let targetGate = req.body.gate || req.body.loginGate;
    if (targetGate === 'COMPANY_ADMIN') {
      targetGate = 'ADMIN';
    }

    let role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' = 'EMPLOYEE';
    if (employee.role === 'SUPER_ADMIN' || (employee.username === 'superadmin' && !employee.companyId)) {
      role = 'SUPER_ADMIN';
    } else if (employee.role === 'ADMIN' || employee.isAdmin) {
      role = 'ADMIN';
    } else {
      role = 'EMPLOYEE';
    }

    // --- STRICT 3-GATE AUTHORIZATION CHECKS ---
    if (targetGate === 'SUPER_ADMIN') {
      if (role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          error: 'Access Denied: This portal is strictly reserved for the Software Supplier (Super Admin).'
        });
      }
    } else if (targetGate === 'ADMIN') {
      if (role !== 'ADMIN') {
        if (role === 'SUPER_ADMIN') {
          return res.status(403).json({
            error: 'Access Denied: Super Administrators must sign in through the Super Admin Portal.'
          });
        }
        return res.status(403).json({
          error: 'Access Denied: This portal is strictly for Company Administrators. Staff members must sign in via the Employee Portal.'
        });
      }
    } else if (targetGate === 'EMPLOYEE') {
      if (role !== 'EMPLOYEE') {
        if (role === 'SUPER_ADMIN') {
          return res.status(403).json({
            error: 'Access Denied: Super Administrators must sign in through the Super Admin Portal.'
          });
        }
        return res.status(403).json({
          error: 'Access Denied: This portal is strictly for Store Staff & Cashiers. Company Admins must sign in via the Company Admin Portal.'
        });
      }
    } else {
      // No gate specified — block login entirely to prevent silent bypass
      return res.status(400).json({
        error: 'Login gate is required. Please select a portal (SUPER_ADMIN, ADMIN, or EMPLOYEE).'
      });
    }

    // --- CLIENT COMPANY LICENSE LOCKOUT CHECK ---
    if (role !== 'SUPER_ADMIN' && employee.company) {
      const license = employee.company.licenses?.[0];
      if (license) {
        const isExpired = license.expiresAt && new Date() > new Date(license.expiresAt);
        if (license.isLocked || isExpired) {
          return res.status(403).json({
            error: 'LICENSE_EXPIRED',
            message: 'Your store software subscription has expired or has been locked by the software supplier. Please contact your administrator to renew.',
            isLocked: Boolean(license.isLocked),
            isExpired: Boolean(isExpired),
            expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString() : null
          });
        }
      }
    }

    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
    const allowedPermissions = employee.permissions.filter(p => p.isAllowed).map(p => p.pageRoute);

    const token = jwt.sign(
      {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        role,
        isAdmin,
        companyId: employee.companyId
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userPayload = {
      id: employee.id,
      name: employee.name,
      username: employee.username,
      role,
      isAdmin,
      companyId: employee.companyId,
      companyName: employee.company?.name || 'Retail ERP',
      companyAddress: employee.company?.address || '',
      companyPhone: employee.company?.phone || '',
      companyContact: employee.company?.contactPerson || '',
      companyEmail: employee.company?.email || '',
      permissions: allowedPermissions
    };

    res.json({
      token,
      user: userPayload,
      employee: userPayload
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const employee = await prisma.employeeRec.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        company: true
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' = 'EMPLOYEE';
    if (employee.role === 'SUPER_ADMIN' || employee.username === 'superadmin' || employee.username === 'admin') {
      role = 'SUPER_ADMIN';
    } else if (employee.role === 'ADMIN' || employee.isAdmin) {
      role = 'ADMIN';
    }

    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
    const allowedPermissions = employee.permissions.filter(p => p.isAllowed).map(p => p.pageRoute);

    const userPayload = {
      id: employee.id,
      name: employee.name,
      username: employee.username,
      role,
      isAdmin,
      companyId: employee.companyId,
      companyName: employee.company?.name || 'Retail ERP',
      companyAddress: employee.company?.address || '',
      companyPhone: employee.company?.phone || '',
      companyContact: employee.company?.contactPerson || '',
      companyEmail: employee.company?.email || '',
      permissions: allowedPermissions
    };

    res.json({
      user: userPayload,
      employee: userPayload
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

// PUT /api/auth/change-credentials
router.put('/change-credentials', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { username, password } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const employee = await prisma.employeeRec.findUnique({
      where: { id: userId }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Block Employees from modifying their credentials: Tier 3 security policy
    if (employee.role === 'EMPLOYEE' || (!employee.isAdmin && employee.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({
        error: 'Access Denied: Employees are not authorized to modify their credentials. Please contact your Company Admin.'
      });
    }

    // Block Company Admin password changes: Tier 2 security policy
    const isCompanyAdmin = (employee.role === 'ADMIN' || employee.isAdmin) && 
                           employee.role !== 'SUPER_ADMIN' && 
                           employee.username !== 'admin' && 
                           employee.username !== 'superadmin';

    if (isCompanyAdmin) {
      return res.status(403).json({
        error: 'Notice: Admin credentials can only be updated by the Software Supplier.'
      });
    }

    if (!username && !password) {
      return res.status(400).json({ error: 'Provide at least a username or a password to update' });
    }

    const dataUpdate: any = {};
    if (username && username.trim() !== '') {
      // Check if username is already taken by another employee
      const existing = await prisma.employeeRec.findUnique({
        where: { username: username.trim() }
      });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Username is already in use by another employee' });
      }
      dataUpdate.username = username.trim();
    }

    if (password && password.trim() !== '') {
      dataUpdate.password = await bcrypt.hash(password.trim(), 10);
    }

    const updatedEmployee = await prisma.employeeRec.update({
      where: { id: userId },
      data: dataUpdate
    });

    res.json({
      message: 'Credentials updated successfully',
      employee: {
        id: updatedEmployee.id,
        name: updatedEmployee.name,
        username: updatedEmployee.username
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update credentials' });
  }
});

export default router;
