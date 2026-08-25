import { useCallback, type RefObject } from 'react';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Custom hook providing print and PDF download actions for receipt components.
 * Centralizes all receipt output logic so no page duplicates it.
 */
export function useReceiptActions(contentRef: RefObject<HTMLDivElement | null>) {
  const handlePrint = useReactToPrint({
    contentRef,
  });

  const handleDownloadPDF = useCallback(async (filename?: string) => {
    const el = contentRef.current;
    if (!el) return;

    // Temporarily ensure the element is visible for capture
    const prevDisplay = el.style.display;
    el.style.display = 'block';

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10; // top margin

      // First page
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);

      // Additional pages if content overflows
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }

      pdf.save(filename || 'receipt.pdf');
    } finally {
      el.style.display = prevDisplay;
    }
  }, [contentRef]);

  return { handlePrint, handleDownloadPDF };
}
