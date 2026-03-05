'use strict';

const path = require('path');
const fs = require('fs');

// Only fingerprint in production — in dev/watch mode always use the unhashed path
// so that watchify updates are picked up immediately without stale hashed copies.
let manifest = {};
if (process.env.NODE_ENV === 'production') {
  try {
    const manifestPath = path.join(__dirname, '../../public/asset-manifest.json');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    // Manifest absent — fall back to unhashed paths.
  }
}

module.exports = function assetPath (name) {
  return '/' + (manifest[name] || name);
};
