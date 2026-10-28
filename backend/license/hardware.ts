import crypto from 'crypto';
import { execSync } from 'child_process';
import os from 'os';

/**
 * Computes a stable, machine-specific fingerprint used to bind a licence to one
 * physical computer. On Windows it uses the OS MachineGuid (survives app
 * reinstalls, changes if moved to another machine). Falls back to hostname +
 * primary MAC on other platforms or if the registry read fails.
 *
 * The raw value is hashed so the licence file never exposes the machine's real
 * identifiers.
 */
export function getHardwareId(): string {
  let raw = '';

  try {
    if (process.platform === 'win32') {
      const out = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString();
      const m = out.match(/MachineGuid\s+REG_SZ\s+([A-Za-z0-9-]+)/i);
      if (m) raw = m[1];
    }
  } catch {
    // ignore — fall through to the cross-platform fallback
  }

  if (!raw) {
    const nets = os.networkInterfaces();
    let mac = '';
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (!n.internal && n.mac && n.mac !== '00:00:00:00:00:00') { mac = n.mac; break; }
      }
      if (mac) break;
    }
    raw = `${os.hostname()}|${mac}|${os.platform()}|${os.arch()}`;
  }

  return crypto.createHash('sha256').update(raw).digest('hex');
}
