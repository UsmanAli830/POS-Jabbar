import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getTenantFilter, getTenantCompanyId, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET all posts
router.get('/posts', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const posts = await prisma.postRec.findMany({
      where: tenantFilter.companyId ? {
        OR: [
          { companyId: tenantFilter.companyId },
          { companyId: null }
        ]
      } : {},
      include: {
        _count: {
          select: { employees: true }
        }
      }
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create post
router.post('/posts', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Category title is required.' });
    }
    const tenantCompanyId = getTenantCompanyId(req);
    const post = await prisma.postRec.create({
      data: {
        title: title.trim(),
        companyId: tenantCompanyId || undefined
      }
    });
    res.status(201).json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create category' });
  }
});

// PUT update post
router.put('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Category title is required.' });
    }
    const post = await prisma.postRec.update({
      where: { id: Number(id) },
      data: { title: title.trim() }
    });
    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update category' });
  }
});

// DELETE delete post
router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any employee is linked to this post
    const count = await prisma.employeeRec.count({
      where: { postRecId: Number(id) }
    });
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete category: employees are assigned to it.' });
    }

    const post = await prisma.postRec.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Category deleted successfully', post });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete category' });
  }
});

// GET all employees (supports /employees, /employees/dropdown, /dropdown, /list, /)
const fetchEmployeesHandler = async (req: any, res: any) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const employees = await prisma.employeeRec.findMany({
      where: {
        role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
        username: { notIn: ['admin', 'superadmin'] },
        ...tenantFilter
      },
      include: {
        postRec: true,
        permissions: true,
        salaries: { orderBy: { date: 'desc' } },
        advanceSalaries: { orderBy: { date: 'desc' } },
        attendance: { orderBy: { date: 'desc' } },
        sales: {
          orderBy: { date: 'desc' },
          include: { customerRec: true }
        },
        spotSales: {
          orderBy: { date: 'desc' },
          include: { customerRec: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    const sanitized = employees.map(emp => {
      const { password, ...rest } = emp;
      return rest;
    });
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch employees', details: error });
  }
};

router.get('/employees', fetchEmployeesHandler);
router.get('/employees/dropdown', fetchEmployeesHandler);
router.get('/employees/list', fetchEmployeesHandler);
router.get('/dropdown', fetchEmployeesHandler);
router.get('/list', fetchEmployeesHandler);
router.get('/', fetchEmployeesHandler);

// POST create employee
router.post('/employees', async (req, res) => {
  try {
    const { 
      name, phone, email, postRecId, empCNIC, address, joiningDate, 
      baseSalary, flatBonus, commissionRate, username, password, companyId, permissions 
    } = req.body;

    if (!postRecId) {
      return res.status(400).json({ error: 'Employee Category/Post is mandatory.' });
    }
    
    // Check if username is already taken
    if (username && username.trim() !== '') {
      const existing = await prisma.employeeRec.findUnique({
        where: { username: username.trim() }
      });
      if (existing) {
        return res.status(400).json({ error: `Username "${username.trim()}" is already in use by another staff member.` });
      }
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    const tenantCompanyId = getTenantCompanyId(req);
    const finalCompanyId = tenantCompanyId || (companyId ? Number(companyId) : undefined);

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employeeRec.create({
        data: {
          name,
          phone: phone || null,
          email: email || null,
          empCNIC: empCNIC || null,
          address: address || null,
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          baseSalary: Number(baseSalary || 0),
          flatBonus: Number(flatBonus || 0),
          commissionRate: Number(commissionRate || 0),
          postRecId: Number(postRecId),
          username: username && username.trim() !== '' ? username.trim() : null,
          password: hashedPassword,
          role: 'EMPLOYEE',
          companyId: finalCompanyId
        }
      });

      // Save permissions if passed
      if (Array.isArray(permissions)) {
        for (const p of permissions) {
          const route = typeof p === 'string' ? p : p.pageRoute;
          const isAllowed = typeof p === 'string' ? true : Boolean(p.isAllowed);
          if (!route || !isAllowed) continue;

          await tx.userPermission.create({
            data: {
              employeeRecId: employee.id,
              userLoginId: employee.id,
              pageRoute: route,
              isAllowed: true
            }
          });
        }
      }

      const created = await tx.employeeRec.findUnique({
        where: { id: employee.id },
        include: { permissions: true, postRec: true }
      });
      if (created) {
        const { password: _p, ...clean } = created;
        return clean;
      }
      return created;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create employee', details: error });
  }
});

// PUT update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, phone, email, postRecId, empCNIC, address, joiningDate, 
      baseSalary, flatBonus, commissionRate, username, password, companyId, permissions 
    } = req.body;

    if (!postRecId) {
      return res.status(400).json({ error: 'Employee Category/Post is mandatory.' });
    }

    const empId = Number(id);

    // Check username uniqueness if changed
    if (username && username.trim() !== '') {
      const existing = await prisma.employeeRec.findUnique({
        where: { username: username.trim() }
      });
      if (existing && existing.id !== empId) {
        return res.status(400).json({ error: `Username "${username.trim()}" is already in use by another staff member.` });
      }
    }

    const dataUpdate: any = {
      name,
      phone: phone || null,
      email: email || null,
      empCNIC: empCNIC || null,
      address: address || null,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      baseSalary: Number(baseSalary || 0),
      flatBonus: Number(flatBonus || 0),
      commissionRate: Number(commissionRate || 0),
      postRecId: Number(postRecId),
      username: username && username.trim() !== '' ? username.trim() : null
    };

    if (companyId) {
      dataUpdate.companyId = Number(companyId);
    }

    if (password && password.trim() !== '') {
      dataUpdate.password = await bcrypt.hash(password.trim(), 10);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Employee Record
      await tx.employeeRec.update({
        where: { id: empId },
        data: dataUpdate
      });

      // 2. If permissions array is provided, replace user permissions
      if (Array.isArray(permissions)) {
        await tx.userPermission.deleteMany({
          where: { employeeRecId: empId }
        });

        for (const p of permissions) {
          const route = typeof p === 'string' ? p : p.pageRoute;
          const isAllowed = typeof p === 'string' ? true : Boolean(p.isAllowed);
          if (!route || !isAllowed) continue;

          await tx.userPermission.create({
            data: {
              employeeRecId: empId,
              userLoginId: empId,
              pageRoute: route,
              isAllowed: true
            }
          });
        }
      }

      const updated = await tx.employeeRec.findUnique({
        where: { id: empId },
        include: { permissions: true, postRec: true }
      });
      if (updated) {
        const { password: _p, ...clean } = updated;
        return clean;
      }
      return updated;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update employee', details: error });
  }
});


// DELETE bulk delete
router.delete('/employees/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid employee IDs provided.' });
    }

    const result = await prisma.employeeRec.deleteMany({
      where: { id: { in: ids.map(id => Number(id)) } }
    });

    res.json({ message: 'Bulk operation completed', deletedCount: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to perform bulk delete', details: error });
  }
});

// POST process salary
router.post('/employees/:id/salary', async (req, res) => {
  try {
    const { id } = req.params;
    const { salaryAmount, deduction, extraIncentive, overtimeHours, overtimeRate, month, year } = req.body;

    const parsedSalary = Number(salaryAmount || 0);
    const parsedDed = Number(deduction || 0);
    const parsedInc = Number(extraIncentive || 0);
    const parsedOTHours = Number(overtimeHours || 0);
    const parsedOTRate = Number(overtimeRate || 0);
    const overtimePay = parsedOTHours * parsedOTRate;
    const netAmount = parsedSalary + parsedInc + overtimePay - parsedDed;

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.empSalary.create({
        data: {
          employeeRecId: Number(id),
          salaryAmount: parsedSalary,
          deduction: parsedDed,
          extraIncentive: parsedInc,
          overtimeHours: parsedOTHours,
          overtimeRate: parsedOTRate,
          netAmount,
          month: month ? Number(month) : null,
          year: year ? Number(year) : null,
          date: new Date()
        }
      });

      // Automatically update all PENDING_ADJUSTMENT advances of this employee to ADJUSTED
      await tx.empAdvanceSalary.updateMany({
        where: {
          employeeRecId: Number(id),
          status: 'PENDING_ADJUSTMENT'
        },
        data: {
          status: 'ADJUSTED',
          adjustedAt: new Date()
        }
      });

      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      let salaryExpenseHead = await tx.finHead.findFirst({ where: { name: 'Salary Expense' } });
      
      if (!salaryExpenseHead) {
        salaryExpenseHead = await tx.finHead.create({
          data: { name: 'Salary Expense' }
        });
      }

      let expHead = await tx.expHead.findFirst({ where: { name: 'Salaries' } });
      if (!expHead) {
        expHead = await tx.expHead.create({ data: { name: 'Salaries' } });
      }

      await tx.expenceRecord.create({
        data: {
          amount: netAmount,
          expHeadId: expHead.id,
          remarks: `Salary processed for employee ID: ${id} (${month}/${year})`
        }
      });

      if (cashInTillHead && salaryExpenseHead) {
        await tx.cashFlowMAIN.create({
          data: {
            description: `Salary Payment - Employee ID: ${id} (${month}/${year})`,
            details: {
              create: [
                {
                  finHeadId: salaryExpenseHead.id,
                  amount: netAmount,
                  transactionType: 'DR' // Debit Expense
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: netAmount,
                  transactionType: 'CR' // Credit Cash
                }
              ]
            }
          }
        });
      }

      return transaction;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process salary', details: error });
  }
});

// POST process salary (Alternative global route)
router.post('/pay-salary', async (req, res) => {
  try {
    const { employeeId, month, year, baseSalary, deduction, extraIncentive, overtimeHours, overtimeRate, netAmount } = req.body;
    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required.' });
    }
    const parsedSalary = Number(baseSalary || 0);
    const parsedDed = Number(deduction || 0);
    const parsedInc = Number(extraIncentive || 0);
    const parsedOTHours = Number(overtimeHours || 0);
    const parsedOTRate = Number(overtimeRate || 0);
    const overtimePay = parsedOTHours * parsedOTRate;
    const parsedNet = netAmount != null ? Number(netAmount) : parsedSalary + parsedInc + overtimePay - parsedDed;

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.empSalary.create({
        data: {
          employeeRecId: Number(employeeId),
          salaryAmount: parsedSalary,
          deduction: parsedDed,
          extraIncentive: parsedInc,
          overtimeHours: parsedOTHours,
          overtimeRate: parsedOTRate,
          netAmount: parsedNet,
          month: month ? Number(month) : null,
          year: year ? Number(year) : null,
          date: new Date()
        }
      });

      await tx.empAdvanceSalary.updateMany({
        where: {
          employeeRecId: Number(employeeId),
          status: 'PENDING_ADJUSTMENT'
        },
        data: {
          status: 'ADJUSTED',
          adjustedAt: new Date()
        }
      });

      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      let salaryExpenseHead = await tx.finHead.findFirst({ where: { name: 'Salary Expense' } });
      
      if (!salaryExpenseHead) {
        salaryExpenseHead = await tx.finHead.create({
          data: { name: 'Salary Expense' }
        });
      }

      let expHead = await tx.expHead.findFirst({ where: { name: 'Salaries' } });
      if (!expHead) {
        expHead = await tx.expHead.create({ data: { name: 'Salaries' } });
      }

      await tx.expenceRecord.create({
        data: {
          amount: parsedNet,
          expHeadId: expHead.id,
          remarks: `Salary processed for employee ID: ${employeeId} (${month}/${year})`
        }
      });

      if (cashInTillHead && salaryExpenseHead) {
        await tx.cashFlowMAIN.create({
          data: {
            description: `Salary Payment - Employee ID: ${employeeId} (${month}/${year})`,
            details: {
              create: [
                {
                  finHeadId: salaryExpenseHead.id,
                  amount: parsedNet,
                  transactionType: 'DR'
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: parsedNet,
                  transactionType: 'CR'
                }
              ]
            }
          }
        });
      }

      return transaction;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process salary payout', details: error });
  }
});

// POST process advance salary

router.post('/employees/:id/advance', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, remarks, date } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid advance amount is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.empAdvanceSalary.create({
        data: {
          employeeRecId: Number(id),
          amount: Number(amount),
          remarks: remarks || null,
          date: date ? new Date(date) : new Date(),
          status: 'PENDING_ADJUSTMENT'
        }
      });

      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      let empReceivableHead = await tx.finHead.findFirst({ where: { name: 'Employee Receivable' } });
      if (!empReceivableHead) {
        const assetGroup = await tx.finHeadMainGroup.findFirst({ where: { name: 'Asset' } });
        empReceivableHead = await tx.finHead.create({
          data: {
            name: 'Employee Receivable',
            finHeadMainGroupId: assetGroup ? assetGroup.id : undefined
          }
        });
      }

      if (cashInTillHead && empReceivableHead) {
        await tx.cashFlowMAIN.create({
          data: {
            description: `Employee Advance Salary - ID: ${id}`,
            details: {
              create: [
                {
                  finHeadId: empReceivableHead.id,
                  amount: Number(amount),
                  transactionType: 'DR'
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: Number(amount),
                  transactionType: 'CR'
                }
              ]
            }
          }
        });
      }

      return transaction;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process advance', details: error });
  }
});

// POST process advance salary (Alternative global route)
router.post('/advance', async (req, res) => {
  try {
    const { employeeId, amount, remarks, date } = req.body;
    if (!employeeId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid employeeId and amount are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.empAdvanceSalary.create({
        data: {
          employeeRecId: Number(employeeId),
          amount: Number(amount),
          remarks: remarks || null,
          date: date ? new Date(date) : new Date(),
          status: 'PENDING_ADJUSTMENT'
        }
      });

      const cashInTillHead = await tx.finHead.findFirst({ where: { name: 'Cash in Till' } });
      let empReceivableHead = await tx.finHead.findFirst({ where: { name: 'Employee Receivable' } });
      if (!empReceivableHead) {
        const assetGroup = await tx.finHeadMainGroup.findFirst({ where: { name: 'Asset' } });
        empReceivableHead = await tx.finHead.create({
          data: {
            name: 'Employee Receivable',
            finHeadMainGroupId: assetGroup ? assetGroup.id : undefined
          }
        });
      }

      if (cashInTillHead && empReceivableHead) {
        await tx.cashFlowMAIN.create({
          data: {
            description: `Employee Advance Salary - ID: ${employeeId}`,
            details: {
              create: [
                {
                  finHeadId: empReceivableHead.id,
                  amount: Number(amount),
                  transactionType: 'DR'
                },
                {
                  finHeadId: cashInTillHead.id,
                  amount: Number(amount),
                  transactionType: 'CR'
                }
              ]
            }
          }
        });
      }

      return transaction;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process advance', details: error });
  }
});

// POST clock-in
router.post('/clock-in', async (req, res) => {
  try {
    const { pinCode } = req.body;
    if (!pinCode) {
      return res.status(400).json({ error: 'PIN code is required' });
    }

    const employee = await prisma.employee.findUnique({
      where: { pinCode }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Invalid PIN' });
    }

    // Check if already clocked in (has an active shift)
    const activeShift = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        clockOut: null
      }
    });

    if (activeShift) {
      return res.status(200).json({ employee, shift: activeShift });
    }

    const newShift = await prisma.shift.create({
      data: {
        employeeId: employee.id,
        clockIn: new Date()
      }
    });

    res.status(200).json({ employee, shift: newShift });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clock in' });
  }
});

// POST clock-out
router.post('/clock-out', async (req, res) => {
  try {
    const { shiftId } = req.body;
    if (!shiftId) {
      return res.status(400).json({ error: 'Shift ID is required' });
    }

    const shift = await prisma.shift.findUnique({
      where: { id: Number(shiftId) }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const clockOut = new Date();
    const diffMs = clockOut.getTime() - new Date(shift.clockIn).getTime();
    const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    const updatedShift = await prisma.shift.update({
      where: { id: Number(shiftId) },
      data: {
        clockOut,
        totalHours
      }
    });
    res.status(200).json(updatedShift);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clock out' });
  }
});

// Helper to seed AttendanceStatus records dynamically
async function ensureAttendanceStatuses() {
  const defaultStatuses = [
    { id: 1, status: 'Present' },
    { id: 2, status: 'Absent' },
    { id: 3, status: 'Leave' },
    { id: 4, status: 'Late' },
    { id: 5, status: 'Half-Day' }
  ];
  for (const ds of defaultStatuses) {
    const exists = await prisma.attandenceStatus.findUnique({ where: { id: ds.id } });
    if (!exists) {
      await prisma.attandenceStatus.create({ data: ds });
    }
  }
}

// Helper to map statusText value to statusId
const mapStatusToId = (statusText: string): number => {
  switch (statusText) {
    case 'PRESENT': return 1;
    case 'ABSENT': return 2;
    case 'LEAVE': return 3;
    case 'LATE': return 4;
    case 'HALFDAY': return 5;
    default: return 1;
  }
};

// GET /api/hr/attendance?date=YYYY-MM-DD
router.get('/attendance', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD).' });
    }

    await ensureAttendanceStatuses();

    const queryDate = new Date(date as string);
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    const tenantFilter = getTenantFilter(req);
    const logged = await prisma.empAttandence.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        employeeRec: tenantFilter.companyId ? { companyId: tenantFilter.companyId } : undefined
      },
      include: {
        status: true
      }
    });

    const employees = await prisma.employeeRec.findMany({
      where: {
        role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
        username: { notIn: ['admin', 'superadmin'] },
        ...tenantFilter
      },
      include: { postRec: true }
    });

    const result = employees.map(emp => {
      const match = logged.find(l => l.employeeRecId === emp.id);
      return {
        id: match ? match.id : undefined,
        employeeRecId: emp.id,
        employeeName: emp.name,
        employeeCategory: emp.postRec?.title || 'Staff',
        statusText: match ? (match.statusText || match.status?.status?.toUpperCase() || 'PRESENT') : 'PRESENT',
        lateMinutes: match ? (match.lateMinutes || 0) : 0
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch attendance', details: error });
  }
});

// POST /api/hr/attendance
router.post('/attendance', async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) and records array are required.' });
    }

    await ensureAttendanceStatuses();

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const results = [];
    for (const rec of records) {
      const { employeeRecId, statusText, lateMinutes } = rec;
      const statusId = mapStatusToId(statusText);

      const existing = await prisma.empAttandence.findFirst({
        where: {
          employeeRecId: Number(employeeRecId),
          date: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      if (existing) {
        const updated = await prisma.empAttandence.update({
          where: { id: existing.id },
          data: {
            statusId,
            statusText,
            lateMinutes: Number(lateMinutes || 0)
          }
        });
        results.push(updated);
      } else {
        const created = await prisma.empAttandence.create({
          data: {
            date: new Date(date),
            employeeRecId: Number(employeeRecId),
            statusId,
            statusText,
            lateMinutes: Number(lateMinutes || 0)
          }
        });
        results.push(created);
      }
    }

    res.json({ message: 'Attendance records saved successfully', count: results.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save attendance', details: error });
  }
});

// GET /api/hr/attendance/monthly-summary?month=MM&year=YYYY
router.get('/attendance/monthly-summary', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'month (MM) and year (YYYY) are required.' });
    }

    const m = Number(month);
    const y = Number(year);

    const startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const tenantFilter = getTenantFilter(req);
    const employees = await prisma.employeeRec.findMany({
      where: {
        role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
        username: { notIn: ['admin', 'superadmin'] },
        ...tenantFilter
      },
      include: {
        postRec: true,
        attendance: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            status: true
          }
        }
      }
    });

    const summary = employees.map(emp => {
      const atts = emp.attendance || [];
      
      const totalPresents = atts.filter(a => (a.statusText || a.status?.status?.toUpperCase()) === 'PRESENT').length;
      const totalAbsents = atts.filter(a => (a.statusText || a.status?.status?.toUpperCase()) === 'ABSENT').length;
      const totalLeaves = atts.filter(a => (a.statusText || a.status?.status?.toUpperCase()) === 'LEAVE').length;
      const totalLates = atts.filter(a => (a.statusText || a.status?.status?.toUpperCase()) === 'LATE').length;
      const totalHalfDays = atts.filter(a => (a.statusText || a.status?.status?.toUpperCase()) === 'HALFDAY').length;

      return {
        employeeRecId: emp.id,
        employeeName: emp.name,
        employeeCategory: emp.postRec?.title || 'Staff',
        totalPresents,
        totalAbsents,
        totalLeaves,
        totalLates,
        totalHalfDays
      };
    });

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch summary', details: error });
  }
});

export default router;

