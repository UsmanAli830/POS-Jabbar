/**
 * Monetary rounding helper.
 *
 * Amounts are currently stored as SQLite REAL (Prisma Float). A full migration
 * to integer minor-units or Decimal is the correct long-term fix but is a large
 * data migration (125 fields). In the meantime, every computed total should be
 * rounded to 2 decimal places with this helper so floating-point artifacts
 * (e.g. 0.1 + 0.2) never leak into stored or displayed amounts.
 */
export function round2(value: number): number {
  if (!isFinite(value)) return 0;
  // +Number.EPSILON nudges values like 1.005 to round up correctly.
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
