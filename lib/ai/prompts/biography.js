'use strict';

// Prompt registry for AI biographies.
//
// Auto-discovers prompt files from `/prompts/biographies/` at app startup.
// Each file is a self-contained version — drop a new .js file into the
// directory and it appears automatically.
//
// See `prompts/biographies/README.md` for the authoring workflow.
//
// Active version resolution:
//   1. config.aiBiographyPromptVersion if set AND the version exists
//   2. otherwise the version whose filename sorts last (so naming files
//      `YYYY-MM-vN-…` gives chronological auto-selection)
//
// When we iterate the prompt, we add a new file and keep the old one in
// place until it's no longer useful for A/B comparison, then delete. Git
// history preserves any removed version if we ever need it back.

const fs = require('fs');
const path = require('path');
const config = require('../../../config');

const PROMPT_DIR = path.resolve(__dirname, '../../../prompts/biographies');

function loadAll () {
  const map = {};
  let files;
  try {
    files = fs.readdirSync(PROMPT_DIR);
  } catch (err) {
    console.warn('AI prompts: could not read', PROMPT_DIR, '-', err.message);
    return map;
  }

  files
    .filter(function (f) {
      // .js only, skip drafts prefixed with _
      return f.endsWith('.js') && !f.startsWith('_');
    })
    .forEach(function (f) {
      const full = path.join(PROMPT_DIR, f);
      try {
        const mod = require(full);
        if (!mod || !mod.version || !mod.systemPrompt || typeof mod.buildUserPrompt !== 'function') {
          console.warn('AI prompts: skipping', f, '- missing version/systemPrompt/buildUserPrompt');
          return;
        }
        if (map[mod.version]) {
          console.warn('AI prompts: duplicate version', mod.version, 'in', f, '- already registered');
          return;
        }
        map[mod.version] = mod;
      } catch (err) {
        console.error('AI prompts: failed to load', f, '-', err.message);
      }
    });
  return map;
}

const VERSIONS = loadAll();
const SORTED_IDS = Object.keys(VERSIONS).sort();

function resolveActive () {
  const configured = config.aiBiographyPromptVersion;
  if (configured && VERSIONS[configured]) return configured;
  if (configured) {
    console.warn('AI prompts: configured version', configured, 'not found — falling back to latest available');
  }
  return SORTED_IDS[SORTED_IDS.length - 1] || null;
}

const ACTIVE_VERSION = resolveActive();

if (!ACTIVE_VERSION) {
  console.error('AI prompts: NO VERSIONS FOUND in', PROMPT_DIR, '- biography generation will fail.');
}

function listVersions () {
  return SORTED_IDS.slice();
}

function getVersion (versionId) {
  return VERSIONS[versionId] || null;
}

const active = VERSIONS[ACTIVE_VERSION] || {};

module.exports = {
  // Active version — default export for consumers that don't care about
  // version selection (the normal generation path).
  version: active.version,
  systemPrompt: active.systemPrompt,
  buildUserPrompt: active.buildUserPrompt,
  // Registry API for admin A/B comparison and regenerate-with-version.
  listVersions,
  getVersion,
  activeVersion: ACTIVE_VERSION
};
