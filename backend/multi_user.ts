const { PrismaClient } = require('@prisma/client');

async function multi() {
  const prismaMaster = new PrismaClient({
    datasources: {
      db: {
        url: "sqlserver://localhost:1433;database=master;integratedSecurity=true;trustServerCertificate=true;"
      }
    }
  });

  try {
    console.log("Setting MULTI_USER...");
    await prismaMaster.$executeRaw`ALTER DATABASE RetailMasterDB SET MULTI_USER WITH ROLLBACK IMMEDIATE`;
    console.log("Done.");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await prismaMaster.$disconnect();
  }
}

multi();
