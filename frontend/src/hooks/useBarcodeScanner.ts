import { useEffect, useRef } from 'react';

export const useBarcodeScanner = (onScan: (barcode: string) => void, timeThreshold = 50) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0 && timeDiff <= timeThreshold) {
          onScan(bufferRef.current);
          e.preventDefault();
        }
        bufferRef.current = '';
      } else {
        if (e.key.length === 1) {
          // If the time difference is greater than the threshold, it means typing was slow.
          // Reset buffer, unless the buffer was already empty.
          if (timeDiff > timeThreshold) {
            bufferRef.current = '';
          }
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, timeThreshold]);
};
