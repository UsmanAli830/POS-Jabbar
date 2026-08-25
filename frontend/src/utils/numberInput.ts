import React from 'react';

/**
 * Clean numeric string by removing leading zeros while preserving decimal values (e.g. "0.5" stays "0.5", "023" becomes "23")
 */
export function cleanNumericString(val: string): string {
  if (!val) return '';
  // Don't strip leading zero if it's decimal like "0.5" or "0."
  if (val.startsWith('0.') || val === '0') return val;
  // Replace leading zeros followed by digit: "023" -> "23"
  return val.replace(/^0+(?=\d)/, '');
}

/**
 * Parses numeric input value safely. Returns empty string if blank, or cleaned number.
 */
export function parseNumericValue(val: string | number): number | '' {
  if (val === '' || val === undefined || val === null) return '';
  const num = Number(cleanNumericString(String(val)));
  return isNaN(num) ? '' : num;
}

/**
 * Focus handler that automatically selects all text and clears "0" so typing replaces immediately
 */
export function handleNumericFocus(e: React.FocusEvent<HTMLInputElement>) {
  const target = e.target;
  if (target) {
    if (target.value === '0' || target.value === '0.00' || target.value === '0.0') {
      target.select();
    } else {
      target.select();
    }
  }
}

/**
 * Blur handler that restores "0" if input is left completely empty
 */
export function handleNumericBlur(
  e: React.FocusEvent<HTMLInputElement>,
  setter?: (val: any) => void,
  defaultValue: number | '' = 0
) {
  if (e.target.value === '' && setter) {
    setter(defaultValue);
  }
}
