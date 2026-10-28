/**
 * Super Admin password recovery — run ON THE SERVER MACHINE only.
 *
 * The Super Admin is the top account and has no one above it to reset its
 * password through the UI (and exposing that as a web endpoint is exactly the
 * takeover hole we closed). Physical/console access to the server is the proof
 * of identity for this recovery.
 *
 * Usage (from backend/):
 *   npm run reset:superadmin -- <newPassword> [username]
 *   npm run reset:superadmin -- "N3wStr0ngPass!"            # resets "superadmin"
 *   npm run reset:superadmin -- "N3wStr0ngPass!" superadmin
 */
import bcrypt from 'bcryptjs';
import prisma from '../db';

async function main() {
  const newPassword = process.argv[2];
  const username = (process.argv[3] || 'superadmin').trim();

  if (!newPassword || newPassword.length < 8) {
    console.error('ERROR: provide a new password of at least 8 characters.');
    console.error('Usage: npm run reset:superadmin -- "<newPassword>" [username]');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  const existing = await prisma.employeeRec.findUnique({ where: { username } });
  if (existing) {
    await prisma.employeeRec.update({
      where: { username },
      data: { password: hashed, role: 'SUPER_ADMIN', isAdmin: true, companyId: null }
    });
    console.log(`✓ Password reset for existing Super Admin "${username}".`);
  } else {
    await prisma.employeeRec.create({
      data: {
        name: 'System Super Administrator',
        username,
        password: hashed,
        role: 'SUPER_ADMIN',
        isAdmin: true,
        companyId: null
      }
    });
    console.log(`✓ Created new Super Admin "${username}".`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Failed to reset Super Admin:', err);
  await prisma.$disconnect();
  process.exit(1);
});
