import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import ReceiptDocument, { type ReceiptType, type ReceiptData } from './ReceiptDocument';
import { useReceiptActions } from '../hooks/useReceiptActions';

type ReceiptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: ReceiptType;
  data: ReceiptData;
};

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, type, data }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { handlePrint, handleDownloadPDF } = useReceiptActions(receiptRef);

  if (!isOpen) return null;

  const invNum = data.invoiceNumber || data.purchaseInvoiceNumber || data.id || 'Receipt';
  const filename = `${invNum.toString().startsWith('INV') ? invNum : `INV-${invNum}`}-Receipt.pdf`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          width: '95%', maxWidth: '850px', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'receiptModalIn 0.2s ease-out',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎉</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Transaction Receipt — {data.invoiceNumber || data.purchaseInvoiceNumber || 'Completed'}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => handlePrint()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: '#16a34a', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                color: '#fff', transition: 'all 0.15s', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; }}
            >
              <Printer size={15} /> Print Receipt
            </button>
            <button
              onClick={() => handleDownloadPDF(filename)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                background: '#fff', cursor: 'pointer',
                fontWeight: 600, fontSize: '13px', color: '#334155', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
            >
              <Download size={15} /> Download PDF
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: '#0284c7', color: '#fff', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0369a1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0284c7'; }}
            >
              {type === 'sale' ? 'New Sale' : 'Close'}
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
                color: '#94a3b8', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f1f5f9' }}>
          <div style={{
            maxWidth: '600px', margin: '0 auto',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
            borderRadius: '8px', overflow: 'hidden',
          }}>
            <ReceiptDocument ref={receiptRef} type={type} data={data} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes receiptModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media print {
          body * { visibility: hidden !important; }
          .print-active-container, .print-active-container * { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
};

export default ReceiptModal;
