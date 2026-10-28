/**
 * SUPPLIER ONLY — run this ONCE, on your own machine, to create the signing keys.
 *
 *   npm run license:keygen
 *
 * Writes:
 *   backend/license/public_key.pem   -> SHIP this inside the app (safe, public)
 *   backend/license/private_key.pem  -> KEEP OFFLINE, never ship, never commit
 *
 * The private key is what lets you (and only you) issue licences. If it leaks,
 * anyone can mint licences for your software, so store it securely (offline/USB).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const dir = path.resolve(__dirname, '../license');
const pubPath = path.join(dir, 'public_key.pem');
const privPath = path.join(dir, 'private_key.pem');

if (fs.existsSync(privPath)) {
  console.error(`Refusing to overwrite existing ${privPath}. Delete it manually if you really intend to rotate keys (this invalidates every issued licence).`);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));

console.log('✓ Key pair generated.');
console.log(`  Public  (ship this):   ${pubPath}`);
console.log(`  Private (KEEP SECRET): ${privPath}`);
console.log('\nIMPORTANT: move private_key.pem somewhere safe and offline. Do NOT commit or ship it.');
