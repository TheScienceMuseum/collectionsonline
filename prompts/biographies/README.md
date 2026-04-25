# AI biography prompts

Each file in this directory is one **prompt version** used by the AI biography
generator. Versions are loaded automatically at startup by
`lib/ai/prompts/biography.js` — no registry edit is needed when you add one.

## Adding a new prompt version

1. **Copy an existing file** and rename it using the convention
   `YYYY-MM-vN-short-description.js`. For example:
   ```
   cp prompts/biographies/2026-04-v4-anti-pattern.js \
      prompts/biographies/2026-05-v5-curator-examples.js
   ```

2. **Edit the new file:**
   - Update the `version` constant at the top to match the filename (e.g.
     `'2026-05-v5-curator-examples'`). **This must be unique** — it's the key
     stored on every generated record.
   - Edit the `systemPrompt` and/or `buildUserPrompt` as desired.
   - Tweak `TONE_EXAMPLES`, `ANTI_PATTERN_EXAMPLE`, or other arrays as needed.

3. **Restart the server** (or let nodemon pick it up). The new version will
   appear in the admin "Regenerate with prompt version" dropdown straight away.

4. **Optional: make it the default** for new generations by setting
   `aiBiographyPromptVersion` in `.corc` (or the `AI_BIOGRAPHY_PROMPT_VERSION`
   env var):
   ```json
   "aiBiographyPromptVersion": "2026-05-v5-curator-examples"
   ```
   If you don't set this, the system picks the version whose filename sorts
   last (so naming files `YYYY-MM-vN-…` gives chronological auto-selection).

## File shape

Every prompt file must export an object with these three fields:

```js
module.exports = {
  version: '2026-05-v5-curator-examples',  // must match filename, unique
  systemPrompt: 'You are a curator...',     // string passed as system message
  buildUserPrompt: function (personData, relatedItems, wikidataContext) {
    // build and return the user prompt string
    return '...';
  }
};
```

Anything else in the module is internal.

## Archiving / removing old versions

**Don't delete old versions.** Records stored in DynamoDB reference them by ID
via the `promptVersion` field — deleting breaks the compare view and any
admin that tries to regenerate with that version.

If a version is unhelpful, just bump `aiBiographyPromptVersion` to a newer one
and leave the old file in place as historical record.

## Conventions

- **Filename format**: `YYYY-MM-vN-short-description.js` — date + sequence +
  human-readable slug. Sorting by filename gives chronological order.
- **`version` constant**: must exactly match the filename (minus `.js`).
- **No external dependencies**: prompt files should be self-contained —
  don't `require` anything beyond built-in Node modules. Keeps them
  reviewable by non-developers.
- **Ignore files starting with `_`**: the auto-loader skips files prefixed
  with an underscore, so `_draft.js` or `_scratch.js` are safe for WIP.
