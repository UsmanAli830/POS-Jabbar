import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getHardwareId } from './hardware';

/**
 * Hardware-locked, supplier-signed licensing.
 *
 * The supplier holds an Ed25519 PRIVATE key (never shipped). Each client install
 * gets a `license.key` file: a JSON payload bound to that PC's hardware id and an
 * expiry date, signed with the private key. The app ships only the PUBLIC key and
 * verifies the signature + hardware match + expiry at startup.
 *
 * Result: copying the install to another PC fails (hardware mismatch), editing the
 * file fails (signature breaks), and the client cannot forge a licence (no private
 * key). Enforcement is OFF unless LICENSE_ENFORCEMENT=1 so dev/test are unaffected.
 */
export interface LicensePayload {
  companyName: string;
  companyId: number | null;
  hardwareId: string;
  issuedAt: string;
  expiresAt: string;
  edition: string;
}

export interface LicenseStatus {
  valid: boolean;
  reason?: string;
  payload?: LicensePayload;
}

function licenseFilePath(): string {
  return process.env.LICENSE_FILE || path.resolve(__dirname, '../license.key');
}
function publicKeyPath(): string {
  return process.env.LICENSE_PUBLIC_KEY || path.resolve(__dirname, 'public_key.pem');
}

/** Deterministic serialization so signing and verifying hash identical bytes. */
export function canonical(p: LicensePayload): string {
  return JSON.stringify({
    companyName: p.companyName,
    companyId: p.companyId ?? null,
    hardwareId: p.hardwareId,
    issuedAt: p.issuedAt,
    expiresAt: p.expiresAt,
    edition: p.edition ?? 'standard',
  });
}

export function isEnforced(): boolean {
  const v = String(process.env.LICENSE_ENFORCEMENT || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function verifyLicense(): LicenseStatus {
  try {
    const licenseFile = licenseFilePath();
    const publicKeyFile = publicKeyPath();
    if (!fs.existsSync(publicKeyFile)) return { valid: false, reason: 'PUBLIC_KEY_MISSING' };
    if (!fs.existsSync(licenseFile)) return { valid: false, reason: 'LICENSE_MISSING' };

    const raw = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
    const { signature, ...payload } = raw;
    if (!signature) return { valid: false, reason: 'NO_SIGNATURE' };

    const pub = fs.readFileSync(publicKeyFile);
    const ok = crypto.verify(null, Buffer.from(canonical(payload as LicensePayload)), pub, Buffer.from(signature, 'base64'));
    if (!ok) return { valid: false, reason: 'BAD_SIGNATURE' };

    if (payload.hardwareId !== getHardwareId()) return { valid: false, reason: 'HARDWARE_MISMATCH', payload };
    if (new Date() > new Date(payload.expiresAt)) return { valid: false, reason: 'EXPIRED', payload };

    return { valid: true, payload: payload as LicensePayload };
  } catch {
    return { valid: false, reason: 'VERIFY_ERROR' };
  }
}

/** Human-readable explanation for a verification reason, shown on the lock screen. */
export function reasonMessage(reason?: string): string {
  switch (reason) {
    case 'LICENSE_MISSING': return 'No licence file was found on this computer.';
    case 'PUBLIC_KEY_MISSING': return 'The licence public key is missing from this installation.';
    case 'NO_SIGNATURE': return 'The licence file is malformed.';
    case 'BAD_SIGNATURE': return 'The licence file is invalid or has been tampered with.';
    case 'HARDWARE_MISMATCH': return 'This licence is registered to a different computer. Software may not be copied between machines.';
    case 'EXPIRED': return 'This licence has expired. Please contact your software supplier to renew.';
    default: return 'This installation is not licensed for this computer.';
  }
}
