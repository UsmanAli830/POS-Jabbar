import React from 'react';

type ReceiptProps = {
  storeName?: string;
  storeAddress?: string;
  receiptFooter?: string;
  invoiceNumber?: string;
  billNumber?: string;
  date?: string;
  cashierName?: string;
  items?: Array<any>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  data?: any;
};

const Receipt: React.FC<ReceiptProps> = (props) => {
  const data = props.data || props;
  const storeName = data.storeName || 'Wholesale ERP';
  const storeAddress = data.storeAddress || 'Main Warehouse';
  const receiptFooter = data.receiptFooter || 'Thank you for your business!';
  const invoiceNumber = data.invoiceNumber || '';
  const billNumber = data.billNumber;
  const date = data.date || new Date().toISOString();
  const cashierName = data.cashierName || 'Admin';
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = data.subtotal || 0;
  const discount = data.discount || 0;
  const tax = data.tax || 0;
  const total = data.total || 0;

  return (
    <div className="print-active-container" id="printable-receipt" style={{ display: 'none', fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', color: '#000', width: '80mm', margin: '0', padding: '0' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>{storeName}</h2>
        <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{storeAddress}</div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

      <div style={{ marginBottom: '8px' }}>
        {billNumber && <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Bill #: {billNumber}</div>}
        <div style={{ color: '#555', fontSize: '11px' }}>Inv: {invoiceNumber}</div>
        <div>Date: {new Date(date).toLocaleString()}</div>
        <div>Cashier: {cashierName}</div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '8px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ paddingBottom: '4px', fontWeight: 'bold' }}>Item</th>
            <th style={{ paddingBottom: '4px', fontWeight: 'bold', textAlign: 'center' }}>Qty</th>
            <th style={{ paddingBottom: '4px', fontWeight: 'bold', textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const name = item.name || item.productName || 'Item';
            const qty = item.quantity ?? item.qty ?? 1;
            const price = item.unitPrice ?? item.price ?? 0;
            const itemTotal = item.totalPrice ?? item.total ?? (qty * price);
            return (
              <tr key={idx}>
                <td style={{ paddingTop: '4px', paddingRight: '8px' }}>
                  <div style={{ wordBreak: 'break-word', lineHeight: '1.2' }}>{name}</div>
                  <div style={{ fontSize: '10px', marginTop: '2px' }}>@{Number(price).toFixed(2)}</div>
                </td>
                <td style={{ paddingTop: '4px', textAlign: 'center', verticalAlign: 'top' }}>{qty}</td>
                <td style={{ paddingTop: '4px', textAlign: 'right', verticalAlign: 'top' }}>{Number(itemTotal).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span>Subtotal:</span>
        <span>Rs. {subtotal.toLocaleString()}</span>
      </div>
      {discount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Discount:</span>
          <span>-Rs. {discount.toLocaleString()}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span>Tax:</span>
        <span>Rs. {tax.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>
        <span>Total:</span>
        <span>Rs. {total.toLocaleString()}</span>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px' }}>
        {receiptFooter}
      </div>
    </div>
  );
};

export default Receipt;
