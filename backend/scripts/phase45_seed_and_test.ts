import fs from 'fs';

const API_BASE = 'http://localhost:3000/api';

async function apiCall(endpoint: string, method: string = 'GET', body?: any) {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${method} ${endpoint}: ${res.status} ${errText}`);
  }
  return res.json();
}

async function runTests() {
  console.log("=========================================");
  console.log("PHASE 45: ADVANCED FEATURES TESTING & SEEDING");
  console.log("=========================================\n");

  const results: any[] = [];
  function assert(condition: boolean, testName: string) {
    results.push({ testName, passed: condition });
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.log(`❌ FAIL: ${testName}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // STEP 0: SEED DUMMY DATA
    // ---------------------------------------------------------
    console.log("--- STEP 0: SEEDING DATA ---");
    
    // Create QA Product
    const product = await apiCall('/products', 'POST', {
      productName: 'QA Test Product',
      productCode: `QA-PROD-${Date.now()}`,
      barCode: `QA-BAR-${Date.now()}`,
      salePrice: 1000,
      costPrice: 800,
      openingQty: 1000
    });

    const customers = [];
    const vendors = [];

    // Create 5 Customers with 3 locations
    for (let i = 1; i <= 5; i++) {
      const c = await apiCall('/customers', 'POST', {
        custName: `QA Customer ${i}`,
        openingBalance: 0
      });
      const cId = c.id;
      const locs = [];
      for (const locName of ['Lahore Office', 'Karachi Branch', 'Islamabad Depot']) {
        const loc = await apiCall(`/customers/${cId}/locations`, 'POST', { locationName: locName });
        locs.push(loc);
      }
      customers.push({ ...c, locations: locs });
    }

    // Create 5 Vendors with 2 locations
    for (let i = 1; i <= 5; i++) {
      const v = await apiCall('/vendors', 'POST', {
        companyName: `QA Vendor ${i}`,
        openingBalance: 0
      });
      const vId = v.id;
      const locs = [];
      for (const locName of ['Lahore Branch', 'Karachi Supply']) {
        const loc = await apiCall(`/vendors/${vId}/locations`, 'POST', { locationName: locName });
        locs.push(loc);
      }
      vendors.push({ ...v, locations: locs });
    }

    // Sales Invoices
    console.log("Seeding Sales Invoices...");
    for (let i = 0; i < 5; i++) {
      const cust = customers[i];
      for (let j = 0; j < 5; j++) {
        const loc = cust.locations[j % 3];
        await apiCall('/sales', 'POST', {
          customerId: cust.id,
          customerLocationId: loc.id,
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'Cash',
          paymentReceived: 0,
          total: 5000,
          subtotal: 5000,
          items: [{
            productId: product.id,
            quantity: 5,
            unitPrice: 1000,
            discPercent: j % 2 === 0 ? 10 : 0, 
            cashDiscount: j % 2 === 1 ? 500 : 0
          }]
        });
      }
    }

    // Purchase Orders
    console.log("Seeding Purchase Orders...");
    for (let i = 0; i < 5; i++) {
      const vend = vendors[i];
      for (let j = 0; j < 5; j++) {
        const loc = vend.locations[j % 2];
        await apiCall('/purchases', 'POST', {
          vendorId: vend.id,
          locationId: loc.id,
          date: new Date().toISOString().split('T')[0],
          total: 8000,
          subtotal: 8000,
          items: [{
            productId: product.id,
            quantity: 10,
            costPrice: 800
          }]
        });
      }
    }

    // Payments
    console.log("Seeding Payments...");
    for (let i = 0; i < 5; i++) {
      await apiCall('/payments/receive', 'POST', { customerId: customers[i].id, amount: 1000 });
      await apiCall('/payments/pay', 'POST', { vendorId: vendors[i].id, amount: 2000 });
    }
    
    assert(true, "Data Seeding Completed Successfully");

    // ---------------------------------------------------------
    // STEP 1: Test Return Credit Adjustment
    // ---------------------------------------------------------
    console.log("\n--- STEP 1: Test Return Credit Adjustment ---");
    // Customer 1
    const c1 = customers[0];
    const c1BalPreSale = (await apiCall(`/customers/${c1.id}/balance`)).balance;
    const sale1 = await apiCall('/sales', 'POST', {
      customerId: c1.id,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      paymentReceived: 0,
      total: 10000,
      subtotal: 10000,
      items: [{ productId: product.id, quantity: 10, unitPrice: 1000 }] // Rs. 10000
    });
    const c1BalPostSale = (await apiCall(`/customers/${c1.id}/balance`)).balance;
    
    await apiCall('/returns/sales', 'POST', {
      saleMainId: sale1.id,
      customerRecId: c1.id,
      returnDate: new Date().toISOString().split('T')[0],
      refundMode: 'CREDIT',
      items: [{ productRecId: product.id, qty: 3, price: 1000 }] // Rs. 3000
    });
    const c1BalPostReturn = (await apiCall(`/customers/${c1.id}/balance`)).balance;
    assert(c1BalPostSale - c1BalPreSale === 10000, "Customer balance increases by Sale amount");
    assert(c1BalPostSale - c1BalPostReturn === 3000, "Customer live balance decreases by Return amount (CREDIT mode)");

    // Customer 2
    const c2 = customers[1];
    const sale2 = await apiCall('/sales', 'POST', {
      customerId: c2.id,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      paymentReceived: 0,
      total: 5000,
      subtotal: 5000,
      items: [{ productId: product.id, quantity: 5, unitPrice: 1000 }] // Rs. 5000
    });
    const c2BalPostSale = (await apiCall(`/customers/${c2.id}/balance`)).balance;
    await apiCall('/returns/sales', 'POST', {
      saleMainId: sale2.id,
      customerRecId: c2.id,
      returnDate: new Date().toISOString().split('T')[0],
      refundMode: 'CASH',
      items: [{ productRecId: product.id, qty: 2, price: 1000 }] // Rs. 2000
    });
    const c2BalPostReturn = (await apiCall(`/customers/${c2.id}/balance`)).balance;
    assert(c2BalPostSale === c2BalPostReturn, "Customer balance does NOT decrease if refundMode is CASH");


    // ---------------------------------------------------------
    // STEP 2: Test Balance Sync Across All Transaction Types
    // ---------------------------------------------------------
    console.log("\n--- STEP 2: Test Balance Sync ---");
    // QA Customer 3
    const c3 = customers[2];
    const c3Bal1 = (await apiCall(`/customers/${c3.id}/balance`)).balance;
    const sale3 = await apiCall('/sales', 'POST', { customerId: c3.id, total: 1000, subtotal: 1000, items: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] });
    const c3Bal2 = (await apiCall(`/customers/${c3.id}/balance`)).balance;
    assert(c3Bal2 - c3Bal1 === 1000, "Sale increases customer balance");
    await apiCall('/payments/receive', 'POST', { customerId: c3.id, amount: 500 });
    const c3Bal3 = (await apiCall(`/customers/${c3.id}/balance`)).balance;
    assert(c3Bal2 - c3Bal3 === 500, "Payment decreases customer balance");
    await apiCall('/returns/sales', 'POST', { saleMainId: sale3.id, customerRecId: c3.id, refundMode: 'CREDIT', returnDate: new Date().toISOString().split('T')[0], items: [{ productRecId: product.id, qty: 1, price: 1000 }] });
    const c3Bal4 = (await apiCall(`/customers/${c3.id}/balance`)).balance;
    assert(c3Bal3 - c3Bal4 === 1000, "Return decreases customer balance");

    // QA Vendor 1
    const v1 = vendors[0];
    const v1Bal1 = (await apiCall(`/vendors/${v1.id}/balance`)).balance;
    const pur1 = await apiCall('/purchases', 'POST', { vendorId: v1.id, total: 8000, subtotal: 8000, items: [{ productId: product.id, quantity: 10, costPrice: 800 }] }); // 8000
    const v1Bal2 = (await apiCall(`/vendors/${v1.id}/balance`)).balance;
    assert(v1Bal2 - v1Bal1 === 8000, "Purchase increases vendor balance");
    await apiCall('/payments/pay', 'POST', { vendorId: v1.id, amount: 3000 });
    const v1Bal3 = (await apiCall(`/vendors/${v1.id}/balance`)).balance;
    assert(v1Bal2 - v1Bal3 === 3000, "Payment decreases vendor balance");
    await apiCall('/returns/purchases', 'POST', { purMainId: pur1.id, sellerRecId: v1.id, items: [{ productRecId: product.id, qty: 2, price: 800 }] }); // 1600
    const v1Bal4 = (await apiCall(`/vendors/${v1.id}/balance`)).balance;
    assert(v1Bal3 - v1Bal4 === 1600, "Purchase Return decreases vendor balance");

    // ---------------------------------------------------------
    // STEP 3: Test Multi-Location Invoice Filtering (Customer)
    // ---------------------------------------------------------
    console.log("\n--- STEP 3: Multi-Location Invoice Filtering ---");
    // Customer 1 already has 5 invoices from Seed (indices: 0, 1, 2, 0, 1 for locations)
    // Let's explicitly create 2 for Lahore Office, 3 for Karachi Branch
    const c1LocLahore = c1.locations.find((l: any) => l.locationName === 'Lahore Office').id;
    const c1LocKarachi = c1.locations.find((l: any) => l.locationName === 'Karachi Branch').id;
    
    for(let i=0; i<2; i++) await apiCall('/sales', 'POST', { customerId: c1.id, customerLocationId: c1LocLahore, date: new Date().toISOString().split('T')[0], total: 100, subtotal: 100, paymentMethod: 'Cash', paymentReceived: 0, items: [{ productId: product.id, quantity: 1, unitPrice: 100 }]});
    for(let i=0; i<3; i++) await apiCall('/sales', 'POST', { customerId: c1.id, customerLocationId: c1LocKarachi, date: new Date().toISOString().split('T')[0], total: 100, subtotal: 100, paymentMethod: 'Cash', paymentReceived: 0, items: [{ productId: product.id, quantity: 1, unitPrice: 100 }]});

    const c1AllInvoices = await apiCall(`/sales/customer-invoices/${c1.id}`);
    const lahoreInvoices = c1AllInvoices.filter((i: any) => i.customerLocationId === c1LocLahore);
    const karachiInvoices = c1AllInvoices.filter((i: any) => i.customerLocationId === c1LocKarachi);
    
    // Seed created 2 for Lahore, 2 for Karachi, 1 for Islamabad, plus our manual ones above (2 Lahore, 3 Karachi).
    // Total Lahore = 4, Total Karachi = 5.
    assert(lahoreInvoices.length === 4, `Lahore Office invoices count is correct (${lahoreInvoices.length})`);
    assert(karachiInvoices.length === 5, `Karachi Branch invoices count is correct (${karachiInvoices.length})`);


    // ---------------------------------------------------------
    // STEP 4: Test Multi-Location Vendor Returns
    // ---------------------------------------------------------
    console.log("\n--- STEP 4: Multi-Location Vendor Returns ---");
    const v1LocLahore = v1.locations.find((l: any) => l.locationName === 'Lahore Branch').id;
    const v1BalBefore = (await apiCall(`/vendors/${v1.id}/balance`)).balance;
    const pur4 = await apiCall('/purchases', 'POST', { vendorId: v1.id, locationId: v1LocLahore, date: new Date().toISOString().split('T')[0], total: 2500, subtotal: 2500, items: [{ productId: product.id, quantity: 5, costPrice: 500 }] });
    const purRtn4 = await apiCall('/returns/purchases', 'POST', { purMainId: pur4.id, sellerRecId: v1.id, items: [{ productRecId: product.id, qty: 2, price: 500 }] }); // Rs 1000
    const v1BalAfter = (await apiCall(`/vendors/${v1.id}/balance`)).balance;
    assert(v1BalBefore + 2500 - 1000 === v1BalAfter, "Vendor balance correctly updated after Purchase and subsequent Return");

    const v1History = await apiCall(`/ledger/vendor/${v1.id}`); 
    // Check if there is an entry for the return
    const hasReturnEntry = v1History.transactions.some((h: any) => h.remarks && h.remarks.includes('Purchase Return'));
    assert(hasReturnEntry, "Return is visible in the Vendor's history/ledger");

    console.log("\n=========================================");
    console.log("TEST RESULTS");
    console.table(results);
    
    const allPassed = results.every(r => r.passed);
    if (allPassed) {
      console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
    } else {
      console.log("\n❌ SOME TESTS FAILED.");
    }
  } catch (err) {
    console.error("Test script failed with error:", err);
  }
}

runTests();
