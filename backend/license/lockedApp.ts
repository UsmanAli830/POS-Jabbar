import express from 'express';
import { LicenseStatus, reasonMessage } from './license';

/**
 * When licence enforcement is on and the licence is invalid (missing, tampered,
 * expired, or the install was copied to another PC), the server starts this
 * minimal app instead of the real one. It serves a clear lock screen for the
 * browser and 403 for API calls, so the application cannot be used until a valid
 * licence is installed — but the client still gets an explanatory message.
 */
export function createLockedApp(status: LicenseStatus) {
  const app = express();
  const message = reasonMessage(status.reason);

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(403).json({ error: 'LICENSE_INVALID', reason: status.reason, message });
    }
    res.status(403).type('html').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Software Not Licensed</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0f172a; color:#e2e8f0; font-family:'Segoe UI',system-ui,sans-serif; }
  .card { max-width:460px; padding:40px; background:#1e293b; border:1px solid #334155;
    border-radius:16px; text-align:center; }
  .lock { font-size:48px; margin-bottom:12px; }
  h1 { font-size:20px; margin:0 0 10px; color:#f8fafc; }
  p { color:#94a3b8; line-height:1.6; margin:0 0 8px; }
  .code { margin-top:16px; font-size:12px; color:#64748b; }
</style></head>
<body><div class="card">
  <div class="lock">🔒</div>
  <h1>Software Not Licensed on This Computer</h1>
  <p>${message}</p>
  <p>Please contact your software supplier to activate this installation.</p>
  <div class="code">Reference: ${status.reason || 'UNLICENSED'}</div>
</div></body></html>`);
  });

  return app;
}
