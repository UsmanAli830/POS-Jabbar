const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const start = Date.now();
    console.log("Connecting using .env...");
    const count = await prisma.location.count();
    console.log(`Connected in ${Date.now() - start}ms. Locations:`, count);
  } catch (e) {
    console.error("Prisma error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
