# Software Protection & Client Deployment Guide

This explains how the app is protected against a client **reading the code,
editing it, or copying the install to another computer**, and how you (the
supplier) build, licence and install it.

> **Honest limit:** no on-prem software is 100% uncopyable by a determined
> expert. These layers stop any normal client and make resale impractical; a
> signed **EULA / licence contract** is your legal backstop. Add one.

---

## Layer 1 — Hardware-locked, supplier-signed licence (anti-copy)

Each install is bound to **one physical PC**. Copying the files to another
machine fails to start; editing the licence breaks its signature; the client
cannot forge one because only you hold the private key.

### One-time setup (your machine only)
```
cd backend
npm run license:keygen
```
- Creates `backend/license/public_key.pem` (ships with the app — safe) and
  `backend/license/private_key.pem` (**NEVER ship or commit — keep offline**).
- `private_key.pem` is already git-ignored. Move it to secure offline storage.
  If it leaks, anyone can mint licences for your software.

### Per client
1. On the client PC, get its hardware id:
   ```
   cd backend
   npm run license:hwid
   ```
2. On your machine, issue a licence bound to that id:
   ```
   npm run license:issue -- --company "Ali Sanitary Store" --hwid <that-id> --days 365
   ```
   This writes `backend/license.key` (git-ignored).
3. Copy `license.key` to the client's `backend/` folder (or the path in
   `LICENSE_FILE`).

### Enforcement
- Off by default (so dev/tests are never blocked).
- Turned **on** by the production launcher via `LICENSE_ENFORCEMENT=1`.
- If the licence is missing, tampered, expired, or on the wrong machine, the
  server starts in **locked mode**: a clear "Not licensed on this computer"
  page and all API calls return `403`. The app cannot be used.

To renew: issue a new `license.key` with a later `--days` and replace the file.

---

## Layer 2 — Compiled + obfuscated code (anti-read / anti-edit)

The client never receives `.ts` source. Production runs compiled, obfuscated
JavaScript.

### Build (your machine)
```
cd frontend && npm run build          # React -> frontend/dist (no source maps)
cd ../backend && npm run build:prod    # TypeScript -> backend/dist, then obfuscated
```
`build:prod` compiles to `backend/dist/` and obfuscates every file (hex names,
encoded strings). It also copies `public_key.pem` into `dist/license/`.

### Run (client)
Use **`Start_POS_Production.bat`** — it runs `node backend/dist/index.js` with
the licence enforced. It never runs raw source.

---

## What to SHIP vs NOT ship to the client

**Ship:**
- `backend/dist/` (compiled + obfuscated)
- `backend/node_modules/` (production deps only — third-party libs, not your IP)
- `backend/prisma/` (schema + generated client; plus a **fresh** `dev.db`, not your test DB)
- `backend/.env` (with a unique `JWT_SECRET` per install)
- `backend/license.key` (that client's hardware-bound licence)
- `frontend/dist/`
- `Start_POS_Production.bat`

**NEVER ship:**
- Any `.ts` source, `routes/`, `middleware/`, `tests/`, dev `scripts/`
- `backend/license/private_key.pem`
- `.git/`, source maps, `SYSTEM_AUDIT_REPORT.md`, this file

> Tip: build on your machine, then copy only the "Ship" list to the client. Do
> not `git clone` onto the client — that delivers all source.

---

## Recommended additional hardening (optional, higher effort)

1. **Encrypt the database** (SQLCipher) so the client can't open `dev.db` and
   read/lift your schema and data. Key derived from the licence/hardware.
2. **Single executable** — package `backend/dist` into one `.exe` with Node SEA
   or `pkg` (needs the Prisma query-engine binary bundled alongside), so there
   is no `node_modules` or `dist` folder to inspect at all.
3. **Electron app + installer** (electron-builder, asar + fuses) for a true
   "double-click, can't see the code" desktop product.
4. **Restrict the install folder** with NTFS permissions / run the server as a
   Windows Service under a restricted account, so the shop user can't read it.
5. **EULA / licence agreement** forbidding copying, reverse-engineering and
   redistribution — your legal recourse.

Items 1–3 are the natural next step once this is in the field.
