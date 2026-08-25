const { PrismaClient } = require('@prisma/client');

async function test() {
  // Connect without specifying a database, or connect to master
  const prismaMaster = new PrismaClient({
    datasources: {
      db: {
        url: "sqlserver://localhost:1433;database=master;integratedSecurity=true;trustServerCertificate=true;"
      }
    }
  });

  try {
    const dbs = await prismaMaster.$queryRaw`SELECT name, state_desc FROM sys.databases`;
    console.log("Databases on server:", dbs);
  } catch (e) {
    console.error("Error connecting to master:", e.message);
  } finally {
    await prismaMaster.$disconnect();
  }
}

test();
