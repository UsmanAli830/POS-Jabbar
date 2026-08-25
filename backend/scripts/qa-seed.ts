import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging existing database records...');

  // 1. Details & Child Transactions
  await prisma.bookingItem.deleteMany({});
  await prisma.customerReturn.deleteMany({});
  await prisma.paymentReceipt.deleteMany({});
  await prisma.invoiceExpense.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.formulaComponent.deleteMany({});
  await prisma.damagedStock.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.customerTransaction.deleteMany({});
  await prisma.vendorTransaction.deleteMany({});
  await prisma.employeeTransaction.deleteMany({});
  await prisma.shift.deleteMany({});
  
  await prisma.saleInvDtl.deleteMany({});
  await prisma.purDtl.deleteMany({});
  await prisma.spotSaleDtl.deleteMany({});
  await prisma.manualSaleRtnDtl.deleteMany({});
  await prisma.settlementDtl.deleteMany({});
  await prisma.assetDTL.deleteMany({});
  await prisma.empAttandence.deleteMany({});
  await prisma.empSalary.deleteMany({});
  await prisma.empAdvanceSalary.deleteMany({});
  await prisma.cashFlowDTL.deleteMany({});

  // 2. Main Transaction Headers
  await prisma.bookingSheet.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.saleMain.deleteMany({});
  await prisma.purMain.deleteMany({});
  await prisma.spotSaleMain.deleteMany({});
  await prisma.manualSaleRtnMain.deleteMany({});
  await prisma.settlementMain.deleteMany({});
  await prisma.assetMain.deleteMany({});
  await prisma.cashFlowMAIN.deleteMany({});
  await prisma.recovery.deleteMany({});
  await prisma.manualCredit.deleteMany({});
  await prisma.finHead.deleteMany({});

  // Core Records
  await prisma.customerRec.deleteMany({});
  await prisma.sellerRec.deleteMany({});
  await prisma.employeeRec.deleteMany({});
  await prisma.productRec.deleteMany({});
  await prisma.assetRec.deleteMany({});

  // Legacy Core
  await prisma.product.deleteMany({});
  await prisma.customerShop.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.accountHead.deleteMany({});

  // Lookup Lookups
  await prisma.pCat.deleteMany({});
  await prisma.subCat.deleteMany({});
  await prisma.pType.deleteMany({});
  await prisma.weightUnit.deleteMany({});
  await prisma.formula.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.activeType.deleteMany({});
  await prisma.zone.deleteMany({});
  await prisma.areaRecord.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.loadType.deleteMany({});
  await prisma.vanRec.deleteMany({});
  await prisma.postRec.deleteMany({});
  await prisma.assetType.deleteMany({});

  console.log('✅ Database purged.');

  // --- SEED LOOKUPS ---
  console.log('🌱 Seeding lookup tables (20 records each)...');

  // Locations
  const locations = [];
  for (let i = 1; i <= 20; i++) {
    locations.push(await prisma.location.create({ data: { name: `Warehouse ${i}` } }));
  }

  // PCats
  const pCats = [];
  for (let i = 1; i <= 20; i++) {
    pCats.push(await prisma.pCat.create({ data: { name: `Category ${i}` } }));
  }

  // SubCats
  const subCats = [];
  for (let i = 1; i <= 20; i++) {
    subCats.push(await prisma.subCat.create({
      data: { name: `SubCategory ${i}`, pCatId: pCats[i - 1].id }
    }));
  }

  // PTypes
  const pTypes = [];
  for (let i = 1; i <= 20; i++) {
    pTypes.push(await prisma.pType.create({ data: { name: `Product Type ${i}` } }));
  }

  // WeightUnits
  const weightUnits = [];
  for (let i = 1; i <= 20; i++) {
    weightUnits.push(await prisma.weightUnit.create({ data: { name: `Weight Unit ${i}` } }));
  }

  // Formulas
  const formulas = [];
  for (let i = 1; i <= 20; i++) {
    formulas.push(await prisma.formula.create({ data: { name: `Formula ${i}` } }));
  }

  // Companies (Brands)
  const companies = [];
  for (let i = 1; i <= 20; i++) {
    companies.push(await prisma.company.create({ data: { name: `Brand ${i}` } }));
  }

  // ActiveTypes
  const activeTypes = [];
  for (let i = 1; i <= 20; i++) {
    activeTypes.push(await prisma.activeType.create({ data: { name: `Status ${i}` } }));
  }

  // Zones
  const zones = [];
  for (let i = 1; i <= 20; i++) {
    zones.push(await prisma.zone.create({ data: { name: `Zone ${i}` } }));
  }

  // AreaRecords
  const areaRecords = [];
  for (let i = 1; i <= 20; i++) {
    areaRecords.push(await prisma.areaRecord.create({ data: { name: `Area Record ${i}` } }));
  }

  // Routes
  const routes = [];
  for (let i = 1; i <= 20; i++) {
    routes.push(await prisma.route.create({ data: { name: `Route ${i}` } }));
  }

  // LoadTypes
  const loadTypes = [];
  for (let i = 1; i <= 20; i++) {
    loadTypes.push(await prisma.loadType.create({ data: { name: `Load Type ${i}` } }));
  }

  // VanRecs
  const vanRecs = [];
  for (let i = 1; i <= 20; i++) {
    vanRecs.push(await prisma.vanRec.create({ data: { name: `Van ${i}` } }));
  }

  // PostRecs
  const postRecs = [];
  for (let i = 1; i <= 20; i++) {
    postRecs.push(await prisma.postRec.create({ data: { title: `Post Title ${i}` } }));
  }

  // AssetTypes
  const assetTypes = [];
  for (let i = 1; i <= 20; i++) {
    assetTypes.push(await prisma.assetType.create({ data: { name: `Asset Type ${i}` } }));
  }

  console.log('✅ Lookup tables seeded.');

  // --- SEED CORE RECORDS ---
  console.log('🌱 Seeding core records (20 records each)...');

  // Seed default accounting heads for ledger posting (Sales Revenue and Cash in Till)
  console.log('🌱 Seeding FinHeads for Ledger accounting...');
  const salesHead = await prisma.finHead.create({ data: { name: 'Sales Revenue' } });
  const cashHead = await prisma.finHead.create({ data: { name: 'Cash in Till' } });
  const inventoryHead = await prisma.finHead.create({ data: { name: 'Inventory Asset' } });

  // 1. Products (ProductRec)
  const products = [];
  for (let i = 1; i <= 20; i++) {
    const cost = 500 + i * 150; // PKR 650 to 3500
    products.push(await prisma.productRec.create({
      data: {
        productCode: `PRD-${1000 + i}`,
        barCode: `777888${100 + i}`,
        productName: `PKR Product ${i}`,
        costPrice: cost,
        retailPrice: cost * 1.25, // 25% markup
        wholeSalePrice: cost * 1.15,
        tradePrice: cost * 1.12,
        currentStock: 100 + i * 10,
        minLevel: 10,
        dangerLevel: 5,
        pCatId: pCats[i - 1].id,
        subCatId: subCats[i - 1].id,
        pTypeId: pTypes[i - 1].id,
        weightUnitId: weightUnits[i - 1].id,
        formulaId: formulas[i - 1].id,
        companyId: companies[i - 1].id,
        activeTypeId: activeTypes[i - 1].id
      }
    }));
  }

  // 2. Customers (CustomerRec)
  const customers = [];
  for (let i = 1; i <= 20; i++) {
    const cust = await prisma.customerRec.create({
      data: {
        custName: `QA Customer ${i}`,
        businessName: `Customer Business ${i}`,
        custCNIC: `42101-${1000000 + i}-1`,
        creditLimit: 150000 + i * 10000,
        openingBalance: 10000 + i * 2500, // PKR 12.5k to 60k
        phone: `+92-300-12345${i.toString().padStart(2, '0')}`,
        email: `customer${i}@qa.com`,
        address: `Shop #${i}, Commercial Market, Karachi, Pakistan`,
        isActive: true,
        zoneId: zones[i - 1].id,
        areaRecordId: areaRecords[i - 1].id,
        routeId: routes[i - 1].id,
        loadTypeId: loadTypes[i - 1].id,
        vanRecId: vanRecs[i - 1].id
      }
    });

    // Create Account Head for Customer
    await prisma.finHead.create({
      data: {
        name: `Customer: ${cust.custName}`,
        customerRecId: cust.id
      }
    });

    customers.push(cust);
  }

  // 3. Vendors (SellerRec)
  const vendors = [];
  for (let i = 1; i <= 20; i++) {
    const vendor = await prisma.sellerRec.create({
      data: {
        companyName: `QA Vendor Ltd ${i}`,
        contactPerson: `Vendor Representative ${i}`,
        sellerCNIC: `42101-${2000000 + i}-3`,
        phone: `+92-321-76543${i.toString().padStart(2, '0')}`,
        email: `vendor${i}@qa.com`,
        address: `Warehouse #${i}, Industrial Area, Lahore, Pakistan`,
        isActive: true,
        openingBalance: 25000 + i * 5000 // PKR 30k to 125k
      }
    });

    // Create Account Head for Vendor
    await prisma.finHead.create({
      data: {
        name: `Vendor: ${vendor.companyName}`,
        sellerRecId: vendor.id
      }
    });

    vendors.push(vendor);
  }

  // 4. Employees (EmployeeRec)
  const employees = [];
  for (let i = 1; i <= 20; i++) {
    employees.push(await prisma.employeeRec.create({
      data: {
        name: `QA Employee ${i}`,
        phone: `+92-333-88888${i.toString().padStart(2, '0')}`,
        email: `employee${i}@qa.com`,
        empCNIC: `42101-${3000000 + i}-5`,
        joiningDate: new Date(`2025-01-${i.toString().padStart(2, '0')}`),
        baseSalary: 40000 + i * 4000, // PKR 44k to 120k
        postRecId: postRecs[i - 1].id
      }
    }));
  }

  // 5. Assets (AssetRec)
  const assets = [];
  for (let i = 1; i <= 20; i++) {
    assets.push(await prisma.assetRec.create({
      data: {
        name: `Fixed Asset ${i}`,
        assetTypeId: assetTypes[i - 1].id,
        value: 120000 + i * 25000, // PKR 145k to 620k
        employeeRecId: employees[i - 1].id
      }
    }));
  }

  console.log('✅ Core records seeded.');

  // --- SEED TRANSACTION DATA ---
  console.log('🌱 Seeding transactions (20 records each)...');

  // 1. Sales (SaleMain)
  const sales = [];
  for (let i = 1; i <= 20; i++) {
    const custIdx = i - 1;
    const prodIdx = i - 1;
    const amount = products[prodIdx].retailPrice * 5; // sale of 5 items
    sales.push(await prisma.saleMain.create({
      data: {
        customerRecId: customers[custIdx].id,
        totalAmount: amount,
        date: new Date(`2026-08-${i.toString().padStart(2, '0')}T10:00:00Z`),
        details: {
          create: [
            {
              productRecId: products[prodIdx].id,
              qty: 5,
              price: products[prodIdx].retailPrice
            }
          ]
        }
      }
    }));
  }

  // 2. Purchases (PurMain)
  const purchases = [];
  for (let i = 1; i <= 20; i++) {
    const vendIdx = i - 1;
    const prodIdx = i - 1;
    const amount = products[prodIdx].costPrice * 20; // purchase of 20 items
    purchases.push(await prisma.purMain.create({
      data: {
        sellerRecId: vendors[vendIdx].id,
        totalAmount: amount,
        date: new Date(`2026-08-${i.toString().padStart(2, '0')}T12:00:00Z`),
        details: {
          create: [
            {
              productRecId: products[prodIdx].id,
              qty: 20,
              price: products[prodIdx].costPrice
            }
          ]
        }
      }
    }));
  }

  // 3. Recoveries (Recovery)
  const recoveries = [];
  for (let i = 1; i <= 20; i++) {
    const custIdx = i - 1;
    recoveries.push(await prisma.recovery.create({
      data: {
        customerRecId: customers[custIdx].id,
        amount: 5000 + i * 1000, // PKR 6k to 25k
        date: new Date(`2026-08-${i.toString().padStart(2, '0')}T14:00:00Z`),
        remarks: `QA Recovery Seed Payment #${i}`
      }
    }));
  }

  // 4. Asset Mains / Details
  const assetMains = [];
  for (let i = 1; i <= 20; i++) {
    const assetIdx = i - 1;
    assetMains.push(await prisma.assetMain.create({
      data: {
        date: new Date(`2026-08-${i.toString().padStart(2, '0')}T16:00:00Z`),
        description: `Acquisition/Maintenance of QA Asset ${i}`,
        totalAmount: 15000 + i * 5000,
        details: {
          create: [
            {
              assetRecId: assets[assetIdx].id,
              amount: 15000 + i * 5000
            }
          ]
        }
      }
    }));
  }

  // --- SEED LEGACY TABLES TO KEEP DASHBOARD AND POS HAPPY ---
  console.log('🌱 Seeding legacy models for backward compatibility...');

  // Legacy Employee
  const legacyAdmin = await prisma.employee.create({
    data: { name: 'Super Admin', pinCode: '1111', role: 'ADMIN', baseSalary: 50000, commissionRate: 0, isActive: true }
  });
  const legacySalesman = await prisma.employee.create({
    data: { name: 'John Salesman', pinCode: '2222', role: 'SALESMAN', baseSalary: 20000, commissionRate: 5, isActive: true }
  });

  // Legacy Category & Company
  const legacyCat = await prisma.category.create({ data: { name: 'Legacy Cat' } });
  const legacyCompany = await prisma.company.create({ data: { name: 'Legacy Company' } });

  // Legacy Products & Customers
  for (let i = 1; i <= 20; i++) {
    const purchasePrice = 500 + i * 150;
    const salePrice = purchasePrice * 1.25;
    const pCode = `L-PRD-${1000 + i}`;
    
    // Seed AccountHead for Legacy Customer
    const accountHead = await prisma.accountHead.create({
      data: { headName: `Legacy Customer Account #${i}`, headType: 'ASSET', openingBalance: 15000 }
    });

    const legacyCust = await prisma.customer.create({
      data: {
        name: `Legacy Customer ${i}`,
        phone: `+92-300-99999${i.toString().padStart(2, '0')}`,
        initialBalance: 15000,
        creditLimit: 200000,
        isActive: true,
        accountHeadId: accountHead.id
      }
    });

    await prisma.customerShop.create({
      data: { customerId: legacyCust.id, shopName: `Legacy Customer ${i} - Branch A`, address: 'Karachi, Pakistan' }
    });

    const legacyProd = await prisma.product.create({
      data: {
        productCode: pCode,
        barCode: `999000${100 + i}`,
        productName: `Legacy PKR Product ${i}`,
        salePrice: salePrice,
        wholesalePrice: salePrice * 0.9,
        tradePrice: salePrice * 0.88,
        costPrice: purchasePrice,
        minLevel: 5,
        reorderLevel: 10,
        dangerLevel: 2,
        openingQty: 150,
        stockQty: 150,
        isActive: true,
        isShownInList: true,
        packSize: 1,
        baseUom: 'PCS',
        bulkUom: 'CTN',
        categoryId: legacyCat.id,
        companyId: legacyCompany.id,
        locationId: locations[0].id
      }
    });

    // Create Initial Stock Inventory Transaction for Legacy Products
    await prisma.inventoryTransaction.create({
      data: {
        productId: legacyProd.id,
        locationId: locations[0].id,
        transactionType: 'IN',
        quantity: 150,
        referenceNotes: 'Legacy Seed stock'
      }
    });
  }

  console.log('✅ Legacy compatible data seeded.');
  console.log('🎉 QA Database seeding complete! 20 records inserted in all main tables.');
}

main()
  .catch((e) => {
    console.error('❌ QA Seeder failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
