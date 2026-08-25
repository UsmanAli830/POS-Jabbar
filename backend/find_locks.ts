const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "sqlserver://127.0.0.1:1433;database=RetailMasterDB;integratedSecurity=true;trustServerCertificate=true;"
    }
  }
});

async function findLocks() {
  try {
    console.log("Querying active transactions and locks...");
    // Just try to query a table that IS NOT Sale to prove we can connect
    const count = await prisma.location.count();
    console.log(`Connected! Location count: ${count}`);
    
    // Now try to run a raw query to find blocking sessions
    const blocks = await prisma.$queryRaw`
      SELECT 
        session_id, 
        blocking_session_id, 
        wait_type, 
        wait_time, 
        wait_resource 
      FROM sys.dm_exec_requests 
      WHERE blocking_session_id <> 0
    `;
    console.log("Blocking sessions:", blocks);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

findLocks();
