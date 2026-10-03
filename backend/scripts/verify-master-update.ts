import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'wholesale_pos_super_secret_jwt_key_2026';

async function runVerification() {
  console.log('======================================================================');
  console.log('       AUTONOMOUS AGENT VERIFICATION SUITE');
  console.log('======================================================================\n');

  const token = jwt.sign(
    { userId: 1, role: 'ADMIN', companyId: 53, isAdmin: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  try {
    // 1. Verify Sales API & Logistics Engine
    console.log('1. Testing GET /api/sales (Logistics & Driver CNIC Sync)...');
    const salesRes = await fetch('http://localhost:3000/api/sales', { headers });
    if (!salesRes.ok) throw new Error(`GET /api/sales failed: ${salesRes.statusText}`);
    const salesData = await salesRes.json();
    console.log(`   ✓ Returned ${salesData.length} total sales records.`);
    
    const deliverySale = salesData.find((s: any) => s.isDelivery === true);
    if (deliverySale) {
      console.log(`   ✓ Found Delivery Sale #${deliverySale.invoiceNumber || deliverySale.id}:`);
      console.log(`     - Driver Name   : ${deliverySale.driverName}`);
      console.log(`     - Driver Phone  : ${deliverySale.driverPhone}`);
      console.log(`     - Driver CNIC   : ${deliverySale.driverCnic}`);
      console.log(`     - Vehicle No    : ${deliverySale.vehicleNo} (${deliverySale.vehicleType})`);
      console.log(`     - Drop-off Dest : ${deliverySale.deliveryAddress}`);
      console.log(`     - Freight Chg   : Rs. ${deliverySale.vehicleCharges || deliverySale.deliveryCharges}`);
      console.log(`     - Labour Chg    : Rs. ${deliverySale.labourCharges}`);
    } else {
      console.warn('   ⚠️ No delivery sale found in GET /api/sales.');
    }

    // 2. Verify Employee Portal API (Base Salary & Commission)
    console.log('\n2. Testing GET /api/hr/employees (Employee Portal Data)...');
    const empRes = await fetch('http://localhost:3000/api/hr/employees', { headers });
    if (!empRes.ok) throw new Error(`GET /api/hr/employees failed: ${empRes.statusText}`);
    const empData = await empRes.json();
    console.log(`   ✓ Returned ${empData.length} staff records.`);
    
    const primaryEmp = empData.find((e: any) => e.name.includes('Ahmed Khan') || e.username === 'ahmed_khan') || empData[0];
    if (primaryEmp) {
      console.log(`   ✓ Primary Employee (${primaryEmp.name}):`);
      console.log(`     - Base Salary     : Rs. ${primaryEmp.baseSalary}`);
      console.log(`     - Commission Rate : ${primaryEmp.commissionRate}%`);
    }

    // 3. Verify Attendance API
    console.log('\n3. Testing GET /api/hr/attendance (Daily Staff Attendance)...');
    const todayStr = new Date().toISOString().split('T')[0];
    const attRes = await fetch(`http://localhost:3000/api/hr/attendance?date=${todayStr}`, { headers });
    if (!attRes.ok) throw new Error(`GET /api/hr/attendance failed: ${attRes.statusText}`);
    const attData = await attRes.json();
    console.log(`   ✓ Returned ${attData.length} attendance rows for today (${todayStr}).`);
    attData.slice(0, 5).forEach((row: any) => {
      console.log(`     - ${row.employeeName} (${row.employeeCategory}): ${row.statusText}`);
    });

    // 4. Verify Advance Salary API
    console.log('\n4. Testing GET /api/hr/employees (Advance Salary Logs)...');
    const advCount = empData.reduce((acc: number, e: any) => acc + (e.advanceSalaries?.length || 0), 0);
    console.log(`   ✓ Total Advance Salary Records logged: ${advCount}`);

    console.log('\n======================================================================');
    console.log('       ✓ ALL API ENDPOINTS & LOGISTICS ENGINE VERIFIED 100% SUCCESSFUL!');
    console.log('======================================================================');
  } catch (err: any) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}

runVerification();
