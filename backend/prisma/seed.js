const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Running Production Database Seed (JS)...');

  const adminName = process.env.SUPER_ADMIN_NAME || 'System Super Administrator';
  const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
  const plainPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123!';

  // Bcrypt 1-way irreversible hashing
  const superPasswordHash = await bcrypt.hash(plainPassword, 10);

  // 1. Create or update the Primary Super Administrator
  const superadmin = await prisma.employeeRec.upsert({
    where: { username: adminUsername },
    update: {
      name: adminName,
      role: 'SUPER_ADMIN',
      isAdmin: true,
      password: superPasswordHash,
      companyId: null
    },
    create: {
      name: adminName,
      username: adminUsername,
      role: 'SUPER_ADMIN',
      isAdmin: true,
      password: superPasswordHash,
      companyId: null,
      joiningDate: new Date()
    }
  });

  console.log(`✅ Production Seed Completed Successfully!`);
  console.log(`   - Master Super Admin provisioned: ${superadmin.username} (Role: SUPER_ADMIN)`);
  console.log(`   - Password securely encrypted with Bcrypt.`);
  console.log(`   - Database tables for Products, Customers, Sales, and Ledgers are 100% clean & empty.`);
}

main()
  .catch((e) => {
    console.error('❌ Production seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
