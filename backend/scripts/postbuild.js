/**
 * Runs after `tsc -p tsconfig.build.json`. Two jobs:
 *   1. Copy the licence public key into dist/license/ (tsc doesn't copy .pem).
 *   2. Obfuscate every compiled .js in dist/ so the shipped code is not readable.
 *
 * Obfuscation settings are deliberately moderate (no control-flow flattening or
 * self-defending) so they don't break Prisma/Express at runtime while still
 * making the code impractical to read or edit.
 */
const fs = require('fs');
const path = require('path');
const JO = require('javascript-obfuscator');

const DIST = path.resolve(__dirname, '../dist');

if (!fs.existsSync(DIST)) {
  console.error('postbuild: dist/ not found — run the TypeScript build first.');
  process.exit(1);
}

// 1. Copy licence public key (safe to ship) next to the compiled licence module.
const pub = path.resolve(__dirname, '../license/public_key.pem');
if (fs.existsSync(pub)) {
  const destDir = path.join(DIST, 'license');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(pub, path.join(destDir, 'public_key.pem'));
  console.log('postbuild: copied public_key.pem -> dist/license/');
} else {
  console.warn('postbuild: no public_key.pem found (run "npm run license:keygen"). Enforcement will fail until it exists.');
}

// 2. Obfuscate all compiled JS in place.
const options = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  splitStrings: false,
  numbersToExpressions: false,
  unicodeEscapeSequence: false,
};

let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.js')) {
      const code = fs.readFileSync(p, 'utf8');
      const obf = JO.obfuscate(code, options).getObfuscatedCode();
      fs.writeFileSync(p, obf);
      count++;
    }
  }
}
walk(DIST);
console.log(`postbuild: obfuscated ${count} JS files in dist/`);
