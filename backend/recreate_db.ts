const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function recreate() {
  const prismaMaster = new PrismaClient({
    datasources: {
      db: {
        url: "sqlserver://localhost:1433;database=master;integratedSecurity=true;trustServerCertificate=true;"
      }
    }
  });

  try {
    console.log("Dropping RetailMasterDB...");
    await prismaMaster.$executeRaw`ALTER DATABASE RetailMasterDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE`;
    await prismaMaster.$executeRaw`DROP DATABASE RetailMasterDB`;
    console.log("Database dropped successfully.");
  } catch (e) {
    console.error("Error dropping DB:", e.message);
  } finally {
    await prismaMaster.$disconnect();
  }

  try {
    console.log("Running prisma db push...");
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log("Running seed...");
    execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit' });
    console.log("Database recreated and seeded!");
  } catch (e) {
    console.error("Error during prisma setup:", e.message);
  }
}

recreate();
