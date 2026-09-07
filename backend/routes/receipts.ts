import { Router } from 'express';
import prisma from '../db';
import { getTenantFilter } from '../middleware/auth';

const router = Router();

/**
 * GET /api/receipts/search
 * Unified search across all transaction types for the Receipt Center with strict tenant isolation.
 * Query params: customerName, vendorName, invoiceNumber, type, dateFrom, dateTo, customerLocationId, finHeadId
 */
router.get('/search', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const {
      customerName,
      vendorName,
      invoiceNumber,
      type,
      dateFrom,
      dateTo,
      customerLocationId,
    } = req.query;

    const dateFromParsed = dateFrom ? new Date(dateFrom as string) : undefined;
    const dateToParsed = dateTo ? new Date(dateTo as string + 'T23:59:59.999Z') : undefined;

    const results: any[] = [];

    // ---- SALES ----
    if (!type || type === 'sale') {
      const salesWhere: any = { ...tenantFilter };
      if (dateFromParsed || dateToParsed) {
        salesWhere.date = {};
        if (dateFromParsed) salesWhere.date.gte = dateFromParsed;
        if (dateToParsed) salesWhere.date.lte = dateToParsed;
      }
      if (customerName) {
        salesWhere.customerRec = { custName: { contains: customerName as string }, ...tenantFilter };
      }
      if (invoiceNumber) {
        const invId = parseInt((invoiceNumber as string).replace(/\D/g, ''));
        if (!isNaN(invId)) salesWhere.id = invId;
      }
      if (customerLocationId) {
        salesWhere.saleLocations = { some: { customerLocationId: Number(customerLocationId) } };
      }

      const sales = await prisma.saleMain.findMany({
        where: salesWhere,
        include: {
          customerRec: true,
          details: { include: { productRec: true } },
          saleLocations: { include: { customerLocation: true } },
        },
        orderBy: { date: 'desc' },
        take: 100,
      });

      for (const sale of sales) {
        let status = 'Paid';
        if (sale.returnAmount > 0 && sale.returnAmount >= sale.totalAmount) {
          status = 'Returned';
        } else if (sale.paymentReceived >= sale.totalAmount && sale.totalAmount > 0) {
          status = 'Paid';
        } else if (sale.paymentReceived > 0) {
          status = 'Partially Paid';
        } else {
          status = 'Pending';
        }

        results.push({
          id: sale.id,
          type: 'sale',
          date: sale.date,
          invoiceNumber: `INV-${sale.id}`,
          accountName: (sale.customerRec as any)?.custName || 'Walk-in',
          amount: sale.totalAmount,
          status,
          rawData: sale,
        });
      }
    }

    // ---- PURCHASES ----
    if (!type || type === 'purchase') {
      const purWhere: any = { ...tenantFilter };
      if (dateFromParsed || dateToParsed) {
        purWhere.date = {};
        if (dateFromParsed) purWhere.date.gte = dateFromParsed;
        if (dateToParsed) purWhere.date.lte = dateToParsed;
      }
      if (vendorName) {
        purWhere.sellerRec = { companyName: { contains: vendorName as string }, ...tenantFilter };
      }
      if (invoiceNumber) {
        const invId = parseInt((invoiceNumber as string).replace(/\D/g, ''));
        if (!isNaN(invId)) purWhere.id = invId;
      }

      const purchases = await prisma.purMain.findMany({
        where: purWhere,
        include: {
          sellerRec: true,
          details: { include: { productRec: true } },
        },
        orderBy: { date: 'desc' },
        take: 100,
      });

      for (const pur of purchases) {
        results.push({
          id: pur.id,
          type: 'purchase',
          date: pur.date,
          invoiceNumber: `PUR-${pur.id}`,
          accountName: pur.sellerRec?.companyName || 'Unknown Vendor',
          amount: pur.totalAmount,
          status: 'Paid',
          rawData: pur,
        });
      }
    }

    // ---- SALES RETURNS (ManualSaleRtnMain) ----
    if (!type || type === 'sales-return') {
      const srWhere: any = { ...tenantFilter };
      if (dateFromParsed || dateToParsed) {
        srWhere.date = {};
        if (dateFromParsed) srWhere.date.gte = dateFromParsed;
        if (dateToParsed) srWhere.date.lte = dateToParsed;
      }
      if (customerName) {
        srWhere.customerRec = { custName: { contains: customerName as string }, ...tenantFilter };
      }

      const salesReturns = await prisma.manualSaleRtnMain.findMany({
        where: srWhere,
        include: {
          customerRec: true,
          details: { include: { productRec: true } },
        },
        orderBy: { date: 'desc' },
        take: 100,
      });

      for (const sr of salesReturns) {
        let status = 'Returned';
        if (sr.customerRecId) {
          status = 'Adjusted in Balance';
        } else {
          status = 'Cash Refunded';
        }

        results.push({
          id: sr.id,
          type: 'sales-return',
          date: sr.date,
          invoiceNumber: `RET-${sr.id}`,
          accountName: (sr.customerRec as any)?.custName || 'Walk-in',
          amount: sr.totalAmount,
          status,
          rawData: sr,
        });
      }
    }

    // ---- PURCHASE RETURNS (PurRtnMain) ----
    if (!type || type === 'purchase-return') {
      const prWhere: any = { ...tenantFilter };
      if (dateFromParsed || dateToParsed) {
        prWhere.date = {};
        if (dateFromParsed) prWhere.date.gte = dateFromParsed;
        if (dateToParsed) prWhere.date.lte = dateToParsed;
      }
      if (vendorName) {
        prWhere.sellerRec = { companyName: { contains: vendorName as string }, ...tenantFilter };
      }

      const purchaseReturns = await prisma.purRtnMain.findMany({
        where: prWhere,
        include: {
          sellerRec: true,
          details: { include: { productRec: true } },
        },
        orderBy: { date: 'desc' },
        take: 100,
      });

      for (const pr of purchaseReturns) {
        results.push({
          id: pr.id,
          type: 'purchase-return',
          date: pr.date,
          invoiceNumber: `PR-${pr.id}`,
          accountName: pr.sellerRec?.companyName || 'Unknown Vendor',
          amount: pr.totalAmount,
          status: 'Returned',
          rawData: pr,
        });
      }
    }

    // ---- PAYMENTS (Recovery from Customers) ----
    if (!type || type === 'payment') {
      const recWhere: any = {
        customerRec: { ...tenantFilter }
      };
      if (dateFromParsed || dateToParsed) {
        recWhere.date = {};
        if (dateFromParsed) recWhere.date.gte = dateFromParsed;
        if (dateToParsed) recWhere.date.lte = dateToParsed;
      }
      if (customerName) {
        recWhere.customerRec = { custName: { contains: customerName as string }, ...tenantFilter };
      }

      const recoveries = await prisma.recovery.findMany({
        where: recWhere,
        include: { customerRec: true },
        orderBy: { date: 'desc' },
        take: 100,
      });

      for (const rec of recoveries) {
        results.push({
          id: rec.id,
          type: 'payment',
          date: rec.date,
          invoiceNumber: `RCV-${rec.id}`,
          accountName: (rec.customerRec as any)?.custName || 'Customer',
          amount: rec.amount,
          status: 'Received',
          rawData: { ...rec, voucherType: 'Payment Received (Customer)' },
        });
      }
    }

    // ---- SALARY (EmpSalary) ----
    if (!type || type === 'salary') {
      const salWhere: any = {
        employeeRec: { ...tenantFilter }
      };
      if (dateFromParsed || dateToParsed) {
        salWhere.date = {};
        if (dateFromParsed) salWhere.date.gte = dateFromParsed;
        if (dateToParsed) salWhere.date.lte = dateToParsed;
      }

      const salaries = await prisma.empSalary.findMany({
        where: salWhere,
        include: { employeeRec: { include: { postRec: true } } },
        orderBy: { date: 'desc' },
        take: 100,
      });

      for (const sal of salaries) {
        results.push({
          id: sal.id,
          type: 'salary',
          date: sal.date,
          invoiceNumber: `SAL-${sal.id}`,
          accountName: sal.employeeRec?.name || 'Employee',
          amount: sal.netAmount || (sal.salaryAmount - (sal.deduction || 0)),
          status: 'Paid',
          rawData: sal,
        });
      }
    }

    // Sort all results by date descending
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(results);
  } catch (error: any) {
    console.error('Receipt search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search receipts' });
  }
});

export default router;
