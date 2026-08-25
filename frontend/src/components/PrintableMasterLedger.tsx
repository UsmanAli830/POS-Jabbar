import React, { useEffect } from 'react';

export type MasterLedgerRow = {
  date: string | Date;
  transactionType: string;
  referenceId?: string | null;
  remarks: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  customerName: string;
};

export type LedgerFilters = {
  startDate: string;
  endDate: string;
  customerName: string;
};

interface PrintableMasterLedgerProps {
  storeName: string;
  filters: LedgerFilters;
  transactions: MasterLedgerRow[];
}

const PrintableMasterLedger = React.forwardRef<HTMLDivElement, PrintableMasterLedgerProps>(({ storeName, filters, transactions }, ref) => {
  const isSpecificCustomer = filters.customerName !== 'All Customers';
  const statementTitle = isSpecificCustomer 
    ? `STATEMENT OF ACCOUNT - ${filters.customerName.toUpperCase()}`
    : 'MASTER TRANSACTION LEDGER';

  return (
    <div ref={ref} id="printable-master-ledger-container" className="print-active-container" style={{ display: 'block', padding: '20px', background: 'white' }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          
          .ledger-header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .store-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .statement-title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; }
          .entity-info { display: flex; flex-direction: column; gap: 5px; font-size: 14px; }
          
          .ledger-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          .ledger-table th, .ledger-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          .ledger-table th { background-color: #f1f5f9 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ledger-table td.amount { text-align: right; }
          
          .ledger-footer { margin-top: 20px; display: flex; justify-content: flex-end; font-size: 16px; font-weight: bold; }
          .ledger-footer span { border-top: 2px solid #000; padding-top: 5px; }
        }
      `}</style>
      
      <div className="ledger-header">
        <div className="store-name">{storeName || 'HBN Tech POS'}</div>
        <div className="statement-title">{statementTitle}</div>
        <div className="entity-info">
          <div><strong>Date Range:</strong> {filters.startDate || 'Beginning of Time'} to {filters.endDate || 'Present'}</div>
          <div><strong>Printed On:</strong> {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <table className="ledger-table">
        <thead>
          <tr>
            <th>Date</th>
            {!isSpecificCustomer && <th>Customer</th>}
            <th>Bill / Ref</th>
            <th>Remarks</th>
            <th className="amount">Debit (Dr)</th>
            <th className="amount">Credit (Cr)</th>
            <th className="amount">Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, idx) => (
            <tr key={idx}>
              <td>{new Date(t.date).toLocaleDateString()}</td>
              {!isSpecificCustomer && <td>{t.customerName}</td>}
              <td>{t.referenceId || '-'}</td>
              <td>{t.remarks || '-'}</td>
              <td className="amount">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
              <td className="amount">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
              <td className="amount">{t.runningBalance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default PrintableMasterLedger;
