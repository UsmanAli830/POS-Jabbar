import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runFinHeadTest() {
  console.log('🧪 Starting Financial Head Creation API Diagnostic Test...\n');

  try {
    const headName = `QA Bank HBL ${Date.now().toString().slice(-4)}`;

    const res = await fetch('http://localhost:3000/api/finance/heads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: headName })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`FinHead creation failed: ${errText}`);
    }

    const created = await res.json();
    console.log(`✅ Step 1: Created Financial Head via POST /api/finance/heads (ID: ${created.id}, Name: "${created.name}")`);

    // Verify GET /api/finance/heads
    const listRes = await fetch('http://localhost:3000/api/finance/heads');
    const allHeads = await listRes.json();
    const found = allHeads.find((h: any) => h.id === created.id);

    if (!found) {
      throw new Error(`❌ FINHEAD NOT FOUND in GET /api/finance/heads list!`);
    }

    console.log(`✅ Step 2: Found Financial Head in GET /api/finance/heads response list.`);

    // Cleanup
    await prisma.finHead.delete({ where: { id: created.id } });
    console.log('\n======================================');
    console.log('🎉 Financial Head Creation Test PASSED!');
    console.log('======================================\n');
  } catch (err: any) {
    console.error('\n❌ DIAGNOSTIC FAILURE:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFinHeadTest();
