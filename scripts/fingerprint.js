'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, '..', 'public');

function hashFile (filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

const manifest = {};

for (const name of ['bundle.js', 'bundle.css', 'barcode.js']) {
  const src = path.join(PUBLIC, name);
  if (!fs.existsSync(src)) {
    console.warn(`[fingerprint] ${name} not found, skipping`);
    continue;
  }

  // Remove any old hashed copies of this file (and their source maps)
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const re = new RegExp(`^${base}-[a-f0-9]{8}\\${ext}(\\.map)?$`);
  for (const f of fs.readdirSync(PUBLIC)) {
    if (re.test(f)) fs.unlinkSync(path.join(PUBLIC, f));
  }

  const hash = hashFile(src);
  const hashed = `${base}-${hash}${ext}`;
  fs.copyFileSync(src, path.join(PUBLIC, hashed));

  // Copy source map if present
  const mapSrc = src + '.map';
  if (fs.existsSync(mapSrc)) {
    fs.copyFileSync(mapSrc, path.join(PUBLIC, hashed + '.map'));
  }

  manifest[name] = hashed;
  console.log(`[fingerprint] ${name} → ${hashed}`);
}

fs.writeFileSync(
  path.join(PUBLIC, 'asset-manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('[fingerprint] manifest written');
