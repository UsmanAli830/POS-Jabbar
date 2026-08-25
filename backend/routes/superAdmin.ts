import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { invalidateLicenseCache } from '../middleware/license';

const router = Router();
const prisma = new PrismaClient();

// All routes here strictly require Super Admin authentication
router.use(authenticate);
router.use(requireSuperAdmin);

// GET /api/super-admin/companies - List all company tenants, their admins, and license status
router.get('/companies', async (req: AuthenticatedRequest, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        employees: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            isAdmin: true,
            joiningDate: true,
            phone: true
          }
        },
        licenses: {
          orderBy: { id: 'desc' },
          take: 1
        }
      },
      orderBy: { id: 'desc' }
    });

    const formatted = companies.map(c => {
      const adminUser = c.employees.find(e => e.role === 'ADMIN' || (e.isAdmin && e.role !== 'SUPER_ADMIN'));
      const employeeCount = c.employees.filter(e => e.role === 'EMPLOYEE' || !e.isAdmin).length;
      const license = c.licenses[0] || null;

      const now = new Date();
      const issuedAt = license?.issuedAt ? new Date(license.issuedAt) : (c.createdAt ? new Date(c.createdAt) : now);
      const expiresAt = license ? new Date(license.expiresAt) : null;
      const isExpired = expiresAt ? now > expiresAt : false;
      const isLocked = license ? (license.isLocked || isExpired) : false;
      const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

      return {
        id: c.id,
        name: c.name,
        address: c.address || '',
        contactPerson: c.contactPerson || '',
        phone: c.phone || '',
        email: c.email || '',
        createdAt: c.createdAt,
        adminUser: adminUser ? {
          id: adminUser.id,
          name: adminUser.name,
          username: adminUser.username,
          phone: adminUser.phone,
          joiningDate: adminUser.joiningDate
        } : null,
        employeeCount,
        license: {
          id: license?.id,
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt?.toISOString(),
          isLocked: license?.isLocked || false,
          isExpired,
          effectiveLocked: isLocked,
          daysRemaining
        }
      };
    });

    res.json(formatted);
  } catch (error: any) {
    console.error('Super Admin get companies error:', error);
    res.status(500).json({ error: error.message || 'Failed to load company accounts' });
  }
});

// POST /api/super-admin/companies - Create a new Company Tenant, Admin User, and License
router.post('/companies', async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body || {};
    const companyName = (body.companyName || body.name || '').trim();
    const address = (body.address || '').trim();
    const contactPerson = (body.contactPerson || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim();
    const adminName = (body.adminName || '').trim();
    const adminUsername = (body.adminUsername || body.username || '').trim();
    const adminPassword = (body.adminPassword || body.initialPassword || body.password || '').trim();
    const startDate = body.startDate || body.fromDate || body.subscriptionStart;
    const expiresAt = body.expiresAt || body.toDate || body.subscriptionEnd;

    if (!companyName) {
      return res.status(400).json({ error: 'Company Name is required.' });
    }
    if (!adminUsername) {
      return res.status(400).json({ error: 'Admin Username is required.' });
    }
    if (!adminPassword) {
      return res.status(400).json({ error: 'Admin Password is required.' });
    }

    // Check if username already taken
    const existing = await prisma.employeeRec.findUnique({
      where: { username: adminUsername }
    });
    if (existing) {
      return res.status(400).json({ error: `Username "${adminUsername}" is already in use by another account.` });
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const targetIssued = startDate ? new Date(startDate) : new Date();
    const targetExpiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const defaultPost = await prisma.postRec.findFirst() || await prisma.postRec.create({ data: { title: 'Administration' } });

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { 
          name: companyName,
          address: address || null,
          contactPerson: contactPerson || null,
          phone: phone || null,
          email: email || null
        }
      });

      const adminUser = await tx.employeeRec.create({
        data: {
          name: (adminName && adminName.trim()) || `${companyName} Admin`,
          username: adminUsername.trim(),
          password: hashedPassword,
          role: 'ADMIN',
          isAdmin: true,
          companyId: company.id,
          postRecId: defaultPost.id,
          joiningDate: new Date(),
          phone: phone ? phone.trim() : null
        }
      });

      const license = await tx.softwareLicense.create({
        data: {
          companyId: company.id,
          issuedAt: targetIssued,
          expiresAt: targetExpiry,
          isLocked: false
        }
      });

      const { password: _p, ...cleanAdmin } = adminUser;
      return { company, adminUser: cleanAdmin, license };
    });

    invalidateLicenseCache();

    res.status(201).json({
      message: 'Company Tenant and Admin account created successfully!',
      company: result.company,
      admin: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        username: result.adminUser.username,
        role: result.adminUser.role
      },
      license: result.license
    });
  } catch (error: any) {
    console.error('Create company error:', error);
    res.status(500).json({ error: error.message || 'Failed to create company tenant' });
  }
});

// PUT /api/super-admin/companies/:companyId - Edit Company Details, Duration, and Lock Status
router.put('/companies/:companyId', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = parseInt(String(req.params.companyId), 10);
    const { 
      companyName, address, contactPerson, phone, email,
      startDate, expiresAt, isLocked 
    } = req.body;

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    const companyUpdateData: any = {};
    if (companyName && companyName.trim()) companyUpdateData.name = companyName.trim();
    if (address !== undefined) companyUpdateData.address = address ? address.trim() : null;
    if (contactPerson !== undefined) companyUpdateData.contactPerson = contactPerson ? contactPerson.trim() : null;
    if (phone !== undefined) companyUpdateData.phone = phone ? phone.trim() : null;
    if (email !== undefined) companyUpdateData.email = email ? email.trim() : null;

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: companyUpdateData
    });

    let license = await prisma.softwareLicense.findFirst({
      where: { companyId },
      orderBy: { id: 'desc' }
    });

    const licenseUpdateData: any = {};
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) licenseUpdateData.issuedAt = parsedStart;
    }
    if (expiresAt) {
      const parsedExpiry = new Date(expiresAt);
      if (!isNaN(parsedExpiry.getTime())) licenseUpdateData.expiresAt = parsedExpiry;
    }
    if (typeof isLocked === 'boolean') {
      licenseUpdateData.isLocked = isLocked;
    }

    if (license) {
      if (Object.keys(licenseUpdateData).length > 0) {
        license = await prisma.softwareLicense.update({
          where: { id: license.id },
          data: licenseUpdateData
        });
      }
    } else {
      license = await prisma.softwareLicense.create({
        data: {
          companyId,
          issuedAt: licenseUpdateData.issuedAt || new Date(),
          expiresAt: licenseUpdateData.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isLocked: typeof licenseUpdateData.isLocked === 'boolean' ? licenseUpdateData.isLocked : false
        }
      });
    }

    invalidateLicenseCache();

    res.json({
      message: 'Company and subscription details updated successfully!',
      company: updatedCompany,
      license
    });
  } catch (error: any) {
    console.error('Update company error:', error);
    res.status(500).json({ error: error.message || 'Failed to update company details' });
  }
});

// PUT /api/super-admin/admin-credentials/:adminId - Reset credentials for a Company Admin
router.put('/admin-credentials/:adminId', async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = parseInt(String(req.params.adminId), 10);
    const { username, password, name } = req.body;

    if (isNaN(adminId)) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const employee = await prisma.employeeRec.findUnique({
      where: { id: adminId }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const updateData: any = {};
    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    if (username && username.trim() !== '') {
      const existing = await prisma.employeeRec.findUnique({
        where: { username: username.trim() }
      });
      if (existing && existing.id !== adminId) {
        return res.status(400).json({ error: 'Username already taken by another account.' });
      }
      updateData.username = username.trim();
    }

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.employeeRec.update({
      where: { id: adminId },
      data: updateData
    });

    res.json({
      message: 'Company Admin credentials successfully reset by Super Admin!',
      admin: {
        id: updated.id,
        name: updated.name,
        username: updated.username
      }
    });
  } catch (error: any) {
    console.error('Reset admin credentials error:', error);
    res.status(500).json({ error: error.message || 'Failed to update credentials' });
  }
});

// PUT /api/super-admin/company-license/:companyId - Update company license timeframe and lock status
router.put('/company-license/:companyId', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = parseInt(String(req.params.companyId), 10);
    const { startDate, expiresAt, isLocked } = req.body;

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    let license = await prisma.softwareLicense.findFirst({
      where: { companyId },
      orderBy: { id: 'desc' }
    });

    const updatePayload: any = {};
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) updatePayload.issuedAt = parsedStart;
    }
    if (expiresAt) {
      const parsedDate = new Date(expiresAt);
      if (!isNaN(parsedDate.getTime())) {
        updatePayload.expiresAt = parsedDate;
      }
    }
    if (typeof isLocked === 'boolean') {
      updatePayload.isLocked = isLocked;
    }

    if (license) {
      license = await prisma.softwareLicense.update({
        where: { id: license.id },
        data: updatePayload
      });
    } else {
      license = await prisma.softwareLicense.create({
        data: {
          companyId,
          issuedAt: updatePayload.issuedAt || new Date(),
          expiresAt: updatePayload.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isLocked: typeof updatePayload.isLocked === 'boolean' ? updatePayload.isLocked : false
        }
      });
    }

    invalidateLicenseCache();

    res.json({
      message: 'Company software license updated successfully!',
      license
    });
  } catch (error: any) {
    console.error('Update company license error:', error);
    res.status(500).json({ error: error.message || 'Failed to update license' });
  }
});

// POST /api/super-admin/toggle-lock/:companyId - Instant toggle lock switch
router.post('/toggle-lock/:companyId', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = parseInt(String(req.params.companyId), 10);
    const { isLocked } = req.body;

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    let license = await prisma.softwareLicense.findFirst({
      where: { companyId },
      orderBy: { id: 'desc' }
    });

    const targetLock = typeof isLocked === 'boolean' ? isLocked : !(license?.isLocked);

    if (license) {
      license = await prisma.softwareLicense.update({
        where: { id: license.id },
        data: { isLocked: targetLock }
      });
    } else {
      license = await prisma.softwareLicense.create({
        data: {
          companyId,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isLocked: targetLock
        }
      });
    }

    invalidateLicenseCache();

    res.json({
      message: `Company access has been ${targetLock ? 'LOCKED' : 'UNLOCKED'} successfully!`,
      isLocked: targetLock,
      license
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to toggle lock' });
  }
});

// POST /api/super-admin/change-password - Change Super Admin master password
router.post('/change-password', async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const userId = req.user?.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const superAdmin = await prisma.employeeRec.findUnique({
      where: { id: userId }
    });

    if (!superAdmin || !superAdmin.password) {
      return res.status(404).json({ error: 'Super Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, superAdmin.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.employeeRec.update({
      where: { id: superAdmin.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Super Admin password changed successfully!' });
  } catch (error: any) {
    console.error('Change super admin password error:', error);
    res.status(500).json({ error: error.message || 'Failed to change password' });
  }
});

export default router;

