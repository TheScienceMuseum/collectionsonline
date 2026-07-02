'use strict';

// Anti-patterns file loader — reads prompts/biographies/anti-patterns.md
// at module init and exposes its content for appending to writer +
// reviewer prompts.
//
// The file is markdown, human-editable, versioned in git. When curators
// notice a class-wide pattern the model keeps getting wrong (or a
// class-wide sanction — "this pattern is actually fine, don't flag it"),
// a developer edits the file, opens a PR, and the rules take effect on
// the next server restart.
//
// Boundary between class-wide and subject-specific:
//   - Class-wide: applies to any subject. Add a rule to
//     prompts/biographies/anti-patterns.md.
//   - Subject-specific: applies to ONE subject only. Add a curator
//     decision on the affected sentence via the admin detail page;
//     rejections and clarifications on the CURATOR_DECISIONS item get
//     injected into the writer's prompt for that subject only.

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.resolve(__dirname, '../../prompts/biographies/anti-patterns.md');

let cached = null;
let loaded = false;

function load () {
  if (loaded) return cached;
  loaded = true;
  try {
    cached = fs.readFileSync(FILE_PATH, 'utf8').trim();
  } catch (err) {
    // Missing file is a graceful no-op — the pipeline still works,
    // just without class-wide guidance. Log so the operator knows.
    if (err.code !== 'ENOENT') {
      console.warn('anti-patterns: failed to read', FILE_PATH, '-', err.message);
    }
    cached = '';
  }
  return cached;
}

// Return the raw anti-patterns text (empty string if file is missing
// or empty). Callers usually want appendToPrompt() instead.
function getAntiPatternsText () {
  return load();
}

// Compose a system prompt with the anti-patterns block appended. Adds
// a small header so the model knows the appended section is class-wide
// guidance, not part of the base prompt. Returns the input unchanged
// when the anti-patterns file is empty / missing.
function appendToPrompt (basePrompt) {
  const text = load();
  if (!text) return basePrompt;
  const separator = '\n\n---\n\n## Class-wide rules (from anti-patterns.md)\n\n';
  return basePrompt + separator + text;
}

// Test seam — allow tests to reset the cache and inject alternative
// content without touching the real file. Pass '__empty__' to simulate
// a missing / empty file; pass any other string to inject that as the
// cached content.
function _resetForTests (override) {
  cached = null;
  loaded = false;
  if (override != null) {
    cached = override === '__empty__' ? '' : override;
    loaded = true;
  }
}

module.exports = {
  getAntiPatternsText,
  appendToPrompt,
  _resetForTests,
  FILE_PATH
};
