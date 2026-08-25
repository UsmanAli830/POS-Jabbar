const { PrismaClient } = require('@prisma/client');

async function fix() {
  const prismaMaster = new PrismaClient({
    datasources: {
      db: {
        url: "sqlserver://localhost:1433;database=master;integratedSecurity=true;trustServerCertificate=true;"
      }
    }
  });

  try {
    console.log("Setting DB OFFLINE...");
    await prismaMaster.$executeRaw`ALTER DATABASE RetailMasterDB SET OFFLINE WITH ROLLBACK IMMEDIATE`;
    console.log("Setting DB ONLINE...");
    await prismaMaster.$executeRaw`ALTER DATABASE RetailMasterDB SET ONLINE`;
    
    const dbs = await prismaMaster.$queryRaw`SELECT name, state_desc FROM sys.databases WHERE name = 'RetailMasterDB'`;
    console.log("DB State:", dbs);
  } catch (e) {
    console.error("Error fixing DB:", e.message);
  } finally {
    await prismaMaster.$disconnect();
  }
}

fix();
