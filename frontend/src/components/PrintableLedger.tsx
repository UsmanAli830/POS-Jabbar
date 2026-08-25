import React from 'react';
import { useAuth } from '../context/AuthContext';

export type LedgerTransaction = {
  id?: number;
  date: string | Date;
  description?: string;
  debit: number;
  credit: number;
  referenceId?: string;
  remarks?: string;
  entityName?: string;
  runningBalance?: number;
};

interface PrintableLedgerProps {
  storeName?: string;
  storeAddress?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  periodOpeningBalance?: number;
  transactions: LedgerTransaction[];
  title?: string;
  entity?: any;
}

const PrintableLedger = React.forwardRef<HTMLDivElement, PrintableLedgerProps>(({
  storeName,
  storeAddress,
  customerName,
  startDate,
  endDate,
  periodOpeningBalance,
  transactions
}, ref) => {
  const { user } = useAuth();
  const finalStoreName = storeName || user?.companyName || 'Store ERP';
  const finalStoreAddress = storeAddress || user?.companyAddress || '';

  // Calculate totals and running balances
  let runningBalance = periodOpeningBalance || 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const rowsWithBalance = transactions.map(t => {
    totalDebit += (t.debit || 0);
    totalCredit += (t.credit || 0);
    runningBalance += ((t.debit || 0) - (t.credit || 0));
    return {
      ...t,
      runningBalance
    };
  });

  return (
    <div ref={ref} style={{ padding: '24px', background: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif', width: '100%' }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {finalStoreName}
        </h1>
        {finalStoreAddress && (
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#444444' }}>
            {finalStoreAddress}
          </p>
        )}
      </div>

      {/* SUB-HEADER SECTION */}
      <div style={{ marginBottom: '16px', padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
          Customer Statement of Account
        </div>
        <div style={{ fontSize: '12px', color: '#334155' }}>
          <strong>Customer:</strong> {customerName} &nbsp;|&nbsp; 
          <strong> Period:</strong> {startDate || 'Beginning'} to {endDate || 'Today'} &nbsp;|&nbsp; 
          <strong> Period Opening Balance:</strong> <span style={{ fontWeight: 'bold', color: (periodOpeningBalance || 0) >= 0 ? '#000' : '#dc2626' }}>Rs. {(periodOpeningBalance || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* LEDGER TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: '#0f172a', color: '#ffffff' }}>
            <th style={{ border: '1px solid #000', padding: '6px 8px', width: '90px' }}>Deal Date</th>
            <th style={{ border: '1px solid #000', padding: '6px 8px' }}>Description</th>
            <th style={{ border: '1px solid #000', padding: '6px 8px', width: '100px', textAlign: 'right' }}>Debit (Dr)</th>
            <th style={{ border: '1px solid #000', padding: '6px 8px', width: '100px', textAlign: 'right' }}>Credit (Cr)</th>
            <th style={{ border: '1px solid #000', padding: '6px 8px', width: '110px', textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          
          {/* ROW 0: PERIOD OPENING BALANCE */}
          <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
            <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{startDate || '-'}</td>
            <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontStyle: 'italic' }}>Opening Balance (B/F)</td>
            <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>-</td>
            <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>-</td>
            <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>Rs. {(periodOpeningBalance || 0).toLocaleString()}</td>
          </tr>

          {/* TRANSACTION ROWS */}
          {rowsWithBalance.map((t, idx) => (
            <tr key={t.id || idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                {new Date(t.date).toLocaleDateString()}
              </td>
              <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                {t.description}
              </td>
              <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: t.debit > 0 ? '#dc2626' : '#94a3b8', fontWeight: t.debit > 0 ? 'bold' : 'normal' }}>
                {t.debit > 0 ? `Rs. ${t.debit.toLocaleString()}` : '-'}
              </td>
              <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: t.credit > 0 ? '#16a34a' : '#94a3b8', fontWeight: t.credit > 0 ? 'bold' : 'normal' }}>
                {t.credit > 0 ? `Rs. ${t.credit.toLocaleString()}` : '-'}
              </td>
              <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                Rs. {(t.runningBalance || 0).toLocaleString()}
              </td>
            </tr>
          ))}

          {/* FOOTER SUMMARY ROW */}
          <tr style={{ background: '#e2e8f0', fontWeight: 'bold', borderTop: '2px solid #000' }}>
            <td colSpan={2} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
              Period Totals:
            </td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', color: '#dc2626' }}>
              Rs. {totalDebit.toLocaleString()}
            </td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', color: '#16a34a' }}>
              Rs. {totalCredit.toLocaleString()}
            </td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontSize: '12px' }}>
              Rs. {(runningBalance || 0).toLocaleString()}
            </td>
          </tr>

        </tbody>
      </table>

      {/* FOOTER SIGNATURE & TIMESTAMP */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
        <div>Generated on: {new Date().toLocaleString()}</div>
        <div>System Verified Account Statement</div>
      </div>
    </div>
  );
});

export default PrintableLedger;
