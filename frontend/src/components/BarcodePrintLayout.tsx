import React, { forwardRef } from 'react';
import Barcode from 'react-barcode';

export type PrintItem = {
  barcodeString: string;
  productName: string;
  price?: number;
  printQuantity: number;
};

type Props = {
  printQueue: PrintItem[];
};

const BarcodePrintLayout = forwardRef<HTMLDivElement, Props>(({ printQueue }, ref) => {
  // Flatten the queue based on printQuantity
  const expandedItems: PrintItem[] = [];
  printQueue.forEach(item => {
    for (let i = 0; i < item.printQuantity; i++) {
      expandedItems.push(item);
    }
  });

  return (
    <div style={{ display: 'none' }}>
      <div ref={ref} className="print-layout-container">
        <style>
          {`
            @media print {
              @page { margin: 0; size: A4; }
              body { margin: 0; padding: 10px; -webkit-print-color-adjust: exact; }
              .print-layout-container { display: flex !important; flex-wrap: wrap; gap: 10px; justify-content: flex-start; }
              .sticker-cell { width: 200px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; box-sizing: border-box; text-align: center; overflow: hidden; page-break-inside: avoid; }
              .sticker-brand { font-size: 11px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; font-family: sans-serif; }
              .sticker-title { font-size: 10px; font-weight: 700; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-family: sans-serif; }
              .sticker-sub { font-size: 9px; margin-bottom: 4px; font-family: sans-serif; }
              .sticker-price { font-size: 12px; font-weight: 900; margin-top: 4px; font-family: sans-serif; }
            }
          `}
        </style>
        {expandedItems.map((item: any, index: number) => (
          <div key={index} className="sticker-cell">
            <div className="sticker-brand">{item.company?.name || 'Wholesale ERP'}</div>
            <div className="sticker-title">{item.productName}</div>
            <div className="sticker-sub">
              {item.size ? `Sz: ${item.size}` : ''} 
              {item.size && item.productCode ? ' | ' : ''}
              {item.productCode ? `C: ${item.productCode}` : ''}
            </div>
            <Barcode value={item.barcodeString} format="CODE128" width={1.5} height={35} fontSize={11} margin={0} />
            {item.price !== undefined && (
              <div className="sticker-price">Rs. {Number(item.price).toFixed(2)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

BarcodePrintLayout.displayName = 'BarcodePrintLayout';

export default BarcodePrintLayout;
