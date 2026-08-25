import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Starting Development Demo Seed (Sample Data)...');

  const superHash = await bcrypt.hash('superadmin123!', 10);
  const adminHash = await bcrypt.hash('admin123', 10);
  const staffHash = await bcrypt.hash('1234', 10);

  // 1. Super Admin
  await prisma.employeeRec.upsert({
    where: { username: 'superadmin' },
    update: { role: 'SUPER_ADMIN', isAdmin: true, password: superHash, companyId: null },
    create: {
      name: 'System Super Administrator',
      username: 'superadmin',
      role: 'SUPER_ADMIN',
      isAdmin: true,
      password: superHash,
      companyId: null,
      joiningDate: new Date()
    }
  });

  await prisma.employeeRec.upsert({
    where: { username: 'admin' },
    update: { role: 'SUPER_ADMIN', isAdmin: true, password: adminHash, companyId: null },
    create: {
      name: 'Developer Super Admin',
      username: 'admin',
      role: 'SUPER_ADMIN',
      isAdmin: true,
      password: adminHash,
      companyId: null,
      joiningDate: new Date()
    }
  });

  // 2. Demo Company: Ali Sanitary Store
  let demoCompany = await prisma.company.findFirst({ where: { name: 'Ali Sanitary Store' } });
  if (!demoCompany) {
    demoCompany = await prisma.company.create({
      data: {
        name: 'Ali Sanitary Store',
        address: 'Main Commercial Market, Sector G-9, Islamabad',
        contactPerson: 'Ali Khan',
        phone: '0300-1234567',
        email: 'info@alisanitary.com'
      }
    });
  }

  // 3. Demo Company Admin
  const defaultPost = await prisma.postRec.findFirst({ where: { companyId: demoCompany.id } }) ||
    await prisma.postRec.create({ data: { title: 'General Manager', companyId: demoCompany.id } });

  await prisma.employeeRec.upsert({
    where: { username: 'ali_admin' },
    update: {
      name: 'Ali Khan (Store Admin)',
      role: 'ADMIN',
      isAdmin: true,
      password: adminHash,
      companyId: demoCompany.id,
      postRecId: defaultPost.id
    },
    create: {
      name: 'Ali Khan (Store Admin)',
      username: 'ali_admin',
      role: 'ADMIN',
      isAdmin: true,
      password: adminHash,
      companyId: demoCompany.id,
      postRecId: defaultPost.id,
      joiningDate: new Date(),
      phone: '0300-1234567'
    }
  });

  // 4. Demo Staff Member
  await prisma.employeeRec.upsert({
    where: { username: 'ali_cashier' },
    update: {
      name: 'Tariq Cashier',
      role: 'EMPLOYEE',
      isAdmin: false,
      password: staffHash,
      companyId: demoCompany.id,
      postRecId: defaultPost.id
    },
    create: {
      name: 'Tariq Cashier',
      username: 'ali_cashier',
      role: 'EMPLOYEE',
      isAdmin: false,
      password: staffHash,
      companyId: demoCompany.id,
      postRecId: defaultPost.id,
      joiningDate: new Date(),
      phone: '0312-9876543'
    }
  });

  // 5. Demo License
  const existingLicense = await prisma.softwareLicense.findFirst({ where: { companyId: demoCompany.id } });
  if (!existingLicense) {
    await prisma.softwareLicense.create({
      data: {
        companyId: demoCompany.id,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isLocked: false
      }
    });
  }

  console.log('✅ Demo Seed Finished! Ready for local development testing.');
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
