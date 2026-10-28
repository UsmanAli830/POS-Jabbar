/**
 * SUPPLIER ONLY — issue a signed, hardware-locked licence for one client PC.
 *
 *   npm run license:issue -- --company "Ali Sanitary Store" --hwid <client-hardware-id> --days 365 [--out license.key] [--companyId 1]
 *
 * Reads backend/license/private_key.pem, produces a signed license.key. Copy that
 * file to the client install's backend/ folder (next to the app), or to the path
 * given by the LICENSE_FILE env var. It will only validate on the machine whose
 * hardware id you passed, and only until it expires.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { canonical, LicensePayload } from '../license/license';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const company = arg('company');
const hwid = arg('hwid');
const days = Number(arg('days', '365'));
const companyIdRaw = arg('companyId');
const outPath = path.resolve(arg('out', path.resolve(__dirname, '../license.key'))!);
const privPath = process.env.LICENSE_PRIVATE_KEY || path.resolve(__dirname, '../license/private_key.pem');

if (!company || !hwid) {
  console.error('Usage: npm run license:issue -- --company "<name>" --hwid <hardware-id> [--days 365] [--companyId <n>] [--out <file>]');
  process.exit(1);
}
if (!fs.existsSync(privPath)) {
  console.error(`Private key not found at ${privPath}. Run "npm run license:keygen" first (supplier machine only).`);
  process.exit(1);
}
if (!isFinite(days) || days <= 0) {
  console.error('--days must be a positive number.');
  process.exit(1);
}

const now = new Date();
const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const payload: LicensePayload = {
  companyName: company,
  companyId: companyIdRaw != null ? Number(companyIdRaw) : null,
  hardwareId: hwid,
  issuedAt: now.toISOString(),
  expiresAt: expires.toISOString(),
  edition: 'standard',
};

const privateKey = crypto.createPrivateKey(fs.readFileSync(privPath));
const signature = crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64');

fs.writeFileSync(outPath, JSON.stringify({ ...payload, signature }, null, 2));
console.log('✓ Licence issued.');
console.log(`  Company:   ${company}`);
console.log(`  Bound to:  ${hwid}`);
console.log(`  Expires:   ${expires.toISOString()}`);
console.log(`  Written:   ${outPath}`);
console.log('\nCopy this file to the client machine (backend/license.key, or LICENSE_FILE path).');
