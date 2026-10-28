import dotenv from 'dotenv';
dotenv.config();

// Single source of truth for the JWT signing secret. Previously three files
// each had their own fallback — and two of them DIFFERED — so if JWT_SECRET
// was ever unset, tokens signed by auth would fail verification in the licence
// guard. Everything now imports from here so sign and verify always agree.
const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // In production a missing secret is fatal — never silently fall back.
    throw new Error('JWT_SECRET is not set. Refusing to start without a configured secret.');
  }
  // eslint-disable-next-line no-console
  console.warn('[SECURITY] JWT_SECRET is not set; using an insecure development fallback. Set it in backend/.env before deploying.');
}

export const JWT_SECRET: string = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
