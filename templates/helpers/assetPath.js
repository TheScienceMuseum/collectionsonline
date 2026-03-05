'use strict';

const path = require('path');
const fs = require('fs');

// Load manifest once at startup. If absent (dev/watch mode), fall back to unhashed paths.
let manifest = {};
try {
  const manifestPath = path.join(__dirname, '../../public/asset-manifest.json');
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  // No manifest — development mode, unhashed paths used.
}

module.exports = function assetPath (name) {
  return '/' + (manifest[name] || name);
};
