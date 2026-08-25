"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var models, deletedSomething, _i, models_1, model, res, e_1, mainLocation, categories, i, cat, companies, i, comp, vendorNames, vendors, _a, vendorNames_1, name_1, account, _b, _c, admin, salesman1, salesman2, salesmen, customers, i, initialBalance, account, customer, products, i, purchasePrice, salePrice, stockQty, product, _loop_1, i;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    console.log("Cleaning database...");
                    models = [
                        prisma.saleItem, prisma.inventoryTransaction, prisma.customerTransaction,
                        prisma.vendorTransaction, prisma.employeeTransaction, prisma.customerShop,
                        prisma.sale, prisma.product, prisma.customer, prisma.vendor, prisma.employee,
                        prisma.accountHead, prisma.location, prisma.cityRecord, prisma.customerType,
                        prisma.supplierType, prisma.category, prisma.company
                    ];
                    deletedSomething = true;
                    _d.label = 1;
                case 1:
                    if (!deletedSomething) return [3 /*break*/, 8];
                    deletedSomething = false;
                    _i = 0, models_1 = models;
                    _d.label = 2;
                case 2:
                    if (!(_i < models_1.length)) return [3 /*break*/, 7];
                    model = models_1[_i];
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, model.deleteMany()];
                case 4:
                    res = _d.sent();
                    if (res.count > 0)
                        deletedSomething = true;
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _d.sent();
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [3 /*break*/, 1];
                case 8:
                    console.log("Database cleaned.");
                    // Seed Location
                    console.log("Seeding Location...");
                    return [4 /*yield*/, prisma.location.findFirst()];
                case 9:
                    mainLocation = _d.sent();
                    if (!!mainLocation) return [3 /*break*/, 11];
                    return [4 /*yield*/, prisma.location.create({ data: { name: 'Main Warehouse' } })];
                case 10:
                    mainLocation = _d.sent();
                    _d.label = 11;
                case 11:
                    categories = [];
                    i = 1;
                    _d.label = 12;
                case 12:
                    if (!(i <= 3)) return [3 /*break*/, 17];
                    return [4 /*yield*/, prisma.category.findFirst({ skip: i - 1 })];
                case 13:
                    cat = _d.sent();
                    if (!!cat) return [3 /*break*/, 15];
                    return [4 /*yield*/, prisma.category.create({ data: { name: "Category ".concat(i) } })];
                case 14:
                    cat = _d.sent();
                    _d.label = 15;
                case 15:
                    categories.push(cat);
                    _d.label = 16;
                case 16:
                    i++;
                    return [3 /*break*/, 12];
                case 17:
                    companies = [];
                    i = 1;
                    _d.label = 18;
                case 18:
                    if (!(i <= 3)) return [3 /*break*/, 23];
                    return [4 /*yield*/, prisma.company.findFirst({ skip: i - 1 })];
                case 19:
                    comp = _d.sent();
                    if (!!comp) return [3 /*break*/, 21];
                    return [4 /*yield*/, prisma.company.create({ data: { name: "Company ".concat(i) } })];
                case 20:
                    comp = _d.sent();
                    _d.label = 21;
                case 21:
                    companies.push(comp);
                    _d.label = 22;
                case 22:
                    i++;
                    return [3 /*break*/, 18];
                case 23:
                    // Seed Vendors
                    console.log("Seeding Vendors...");
                    vendorNames = ["National Distributors", "Global Supplies", "Prime Wholesale", "Apex Industries", "Nexus Trade"];
                    vendors = [];
                    _a = 0, vendorNames_1 = vendorNames;
                    _d.label = 24;
                case 24:
                    if (!(_a < vendorNames_1.length)) return [3 /*break*/, 28];
                    name_1 = vendorNames_1[_a];
                    return [4 /*yield*/, prisma.accountHead.create({ data: { headName: "Vendor: ".concat(name_1), headType: 'LIABILITY' } })];
                case 25:
                    account = _d.sent();
                    _c = (_b = vendors).push;
                    return [4 /*yield*/, prisma.vendor.create({
                            data: {
                                companyName: name_1,
                                contactPerson: 'Contact Person',
                                isActive: true,
                                accountHeadId: account.id
                            }
                        })];
                case 26:
                    _c.apply(_b, [_d.sent()]);
                    _d.label = 27;
                case 27:
                    _a++;
                    return [3 /*break*/, 24];
                case 28:
                    // Seed Employees
                    console.log("Seeding Employees...");
                    return [4 /*yield*/, prisma.employee.create({
                            data: { name: 'Super Admin', pinCode: '1111', role: 'ADMIN', baseSalary: 50000, commissionRate: 0, isActive: true }
                        })];
                case 29:
                    admin = _d.sent();
                    return [4 /*yield*/, prisma.employee.create({
                            data: { name: 'John Salesman', pinCode: '2222', role: 'SALESMAN', baseSalary: 20000, commissionRate: 5, isActive: true }
                        })];
                case 30:
                    salesman1 = _d.sent();
                    return [4 /*yield*/, prisma.employee.create({
                            data: { name: 'Mike Booker', pinCode: '3333', role: 'SALESMAN', baseSalary: 20000, commissionRate: 5, isActive: true }
                        })];
                case 31:
                    salesman2 = _d.sent();
                    salesmen = [salesman1, salesman2];
                    // Seed Customers
                    console.log("Seeding Customers...");
                    customers = [];
                    i = 1;
                    _d.label = 32;
                case 32:
                    if (!(i <= 10)) return [3 /*break*/, 38];
                    initialBalance = (i <= 3) ? (i * 500) : 0;
                    return [4 /*yield*/, prisma.accountHead.create({ data: { headName: "Customer: Shop ".concat(i), headType: 'ASSET', openingBalance: initialBalance } })];
                case 33:
                    account = _d.sent();
                    return [4 /*yield*/, prisma.customer.create({
                            data: {
                                name: "Customer Shop ".concat(i),
                                phone: "555-000".concat(i),
                                initialBalance: initialBalance,
                                creditLimit: 10000,
                                isActive: true,
                                accountHeadId: account.id,
                                transactions: initialBalance > 0 ? {
                                    create: [{
                                            transactionType: 'INITIAL_BALANCE',
                                            amount: initialBalance,
                                            remarks: 'Legacy Debt from previous system'
                                        }]
                                } : undefined
                            }
                        })];
                case 34:
                    customer = _d.sent();
                    if (!(i <= 2)) return [3 /*break*/, 36];
                    return [4 /*yield*/, prisma.customerShop.createMany({
                            data: [
                                { customerId: customer.id, shopName: "".concat(customer.name, " - Branch A"), address: '123 Main St' },
                                { customerId: customer.id, shopName: "".concat(customer.name, " - Branch B"), address: '456 Side Ave' }
                            ]
                        })];
                case 35:
                    _d.sent();
                    _d.label = 36;
                case 36:
                    customers.push(customer);
                    _d.label = 37;
                case 37:
                    i++;
                    return [3 /*break*/, 32];
                case 38:
                    // Seed Products
                    console.log("Seeding Products...");
                    products = [];
                    i = 1;
                    _d.label = 39;
                case 39:
                    if (!(i <= 30)) return [3 /*break*/, 44];
                    purchasePrice = 10 + (i * 2.5);
                    salePrice = purchasePrice * 1.25;
                    stockQty = i <= 3 ? 0 : (100 - i * 2);
                    return [4 /*yield*/, prisma.product.create({
                            data: {
                                productCode: "PROD-".concat(String(i).padStart(4, '0')),
                                barCode: "100000".concat(i),
                                productName: "Test Product ".concat(i),
                                salePrice: salePrice,
                                purchasePrice: purchasePrice,
                                stockQty: stockQty,
                                openingQty: stockQty,
                                categoryId: categories[i % 3].id,
                                companyId: companies[i % 3].id,
                                locationId: mainLocation.id
                            }
                        })];
                case 40:
                    product = _d.sent();
                    if (!(stockQty > 0)) return [3 /*break*/, 42];
                    return [4 /*yield*/, prisma.inventoryTransaction.create({
                            data: {
                                productId: product.id,
                                locationId: mainLocation.id,
                                transactionType: 'OPENING',
                                quantity: stockQty,
                                referenceNotes: 'Initial Seed'
                            }
                        })];
                case 41:
                    _d.sent();
                    _d.label = 42;
                case 42:
                    products.push(product);
                    _d.label = 43;
                case 43:
                    i++;
                    return [3 /*break*/, 39];
                case 44:
                    // Seed Sales
                    console.log("Seeding Sales...");
                    _loop_1 = function (i) {
                        var customer, salesman, items, subtotal, saleItemsData, tax, total, paymentMethod, d, sale, _e, items_1, item, qty;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    customer = customers[i % customers.length];
                                    salesman = salesmen[i % salesmen.length];
                                    items = [
                                        products[(i * 2) % 30],
                                        products[(i * 3) % 30],
                                        products[(i * 5) % 30]
                                    ];
                                    subtotal = 0;
                                    saleItemsData = items.map(function (p) {
                                        var qty = 2;
                                        var total = qty * p.salePrice;
                                        subtotal += total;
                                        return {
                                            productId: p.id,
                                            quantity: qty,
                                            unitPrice: p.salePrice,
                                            totalPrice: total,
                                            pieces: qty,
                                            netAmount: total
                                        };
                                    });
                                    tax = subtotal * 0.05;
                                    total = subtotal + tax;
                                    paymentMethod = i % 2 === 0 ? 'Cash' : 'Credit / Unpaid';
                                    d = new Date();
                                    d.setDate(d.getDate() - i); // Past days
                                    return [4 /*yield*/, prisma.sale.create({
                                            data: {
                                                invoiceNumber: "INV-1000".concat(i),
                                                billNumber: "BILL-".concat(Date.now(), "-").concat(i),
                                                date: d,
                                                subtotal: subtotal,
                                                taxAmount: tax,
                                                discountAmount: 0,
                                                total: total,
                                                locationId: mainLocation.id,
                                                paymentMethod: paymentMethod,
                                                paymentStatus: paymentMethod === 'Cash' ? 'PAID' : 'PENDING',
                                                amountPaid: paymentMethod === 'Cash' ? total : 0,
                                                customerId: customer.id,
                                                salesmanId: salesman.id,
                                                saleItems: { create: saleItemsData }
                                            }
                                        })];
                                case 1:
                                    sale = _f.sent();
                                    if (!(paymentMethod === 'Credit / Unpaid')) return [3 /*break*/, 3];
                                    return [4 /*yield*/, prisma.customerTransaction.create({
                                            data: {
                                                customerId: customer.id,
                                                date: d,
                                                transactionType: 'SALE_ON_CREDIT',
                                                amount: total,
                                                referenceId: sale.billNumber
                                            }
                                        })];
                                case 2:
                                    _f.sent();
                                    _f.label = 3;
                                case 3: 
                                // Add Commission EmployeeTransaction
                                return [4 /*yield*/, prisma.employeeTransaction.create({
                                        data: {
                                            employeeId: salesman.id,
                                            date: d,
                                            transactionType: 'COMMISSION_EARNED',
                                            amount: subtotal * (salesman.commissionRate / 100),
                                            remarks: "Commission for Sale ".concat(sale.billNumber)
                                        }
                                    })];
                                case 4:
                                    // Add Commission EmployeeTransaction
                                    _f.sent();
                                    _e = 0, items_1 = items;
                                    _f.label = 5;
                                case 5:
                                    if (!(_e < items_1.length)) return [3 /*break*/, 9];
                                    item = items_1[_e];
                                    qty = 2;
                                    // Deduct from Product stock
                                    return [4 /*yield*/, prisma.product.update({
                                            where: { id: item.id },
                                            data: { stockQty: { decrement: qty } }
                                        })];
                                case 6:
                                    // Deduct from Product stock
                                    _f.sent();
                                    // InventoryTx OUT
                                    return [4 /*yield*/, prisma.inventoryTransaction.create({
                                            data: {
                                                productId: item.id,
                                                locationId: mainLocation.id,
                                                transactionType: 'OUT',
                                                quantity: qty,
                                                referenceNotes: "Sale ".concat(sale.billNumber)
                                            }
                                        })];
                                case 7:
                                    // InventoryTx OUT
                                    _f.sent();
                                    _f.label = 8;
                                case 8:
                                    _e++;
                                    return [3 /*break*/, 5];
                                case 9: return [2 /*return*/];
                            }
                        });
                    };
                    i = 1;
                    _d.label = 45;
                case 45:
                    if (!(i <= 10)) return [3 /*break*/, 48];
                    return [5 /*yield**/, _loop_1(i)];
                case 46:
                    _d.sent();
                    _d.label = 47;
                case 47:
                    i++;
                    return [3 /*break*/, 45];
                case 48:
                    console.log("Seeding complete!");
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
