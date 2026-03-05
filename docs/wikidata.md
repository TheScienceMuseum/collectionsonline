# Wikidata Integration

The Wikidata integration fetches structured data from [Wikidata](https://www.wikidata.org) for people and companies in the collection, then renders it as a sidebar panel on person/organisation detail pages.

---

## Architecture

```
Browser
  └─ GET /people/{id}
       └─ Handlebars template renders <div id="wikiInfo" data-name="{qCode}">
            └─ client/lib/listeners/get-wiki-data.js
                 └─ GET /wiki/{qCode}
                      └─ routes/wiki.js  ──────────────────────────────────┐
                           ├─ lib/cached-wikidata.js  (Redis / memory)     │
                           ├─ Wikidata API  (wikibase-sdk)                  │
                           ├─ lib/wikidataQueries.js                       │
                           │    ├─ batchFetchEntities()                    │
                           │    ├─ collectNestedQCodes()                   │
                           │    ├─ extractNestedQCodeData()                │
                           │    ├─ extraContext()                          │
                           │    └─ fetchImageMetadata()                    │
                           └─ lib/getWikidataRelated.js (Elasticsearch)    │
                                                                           │
            ◄──────────────────────── JSON response ──────────────────────┘
       └─ Templates.wikiInfo() renders HTML into #wikiInfo
```

---

## Key Files

| File | Purpose |
|------|---------|
| `routes/wiki.js` | Route handler: cache lookup, Wikidata fetch, response assembly |
| `lib/wikidataQueries.js` | Entity label extraction, image metadata, context building |
| `lib/cached-wikidata.js` | Redis + in-memory cache layer |
| `bin/cache.js` | Catbox client initialisation (Redis or null stub) |
| `lib/getWikidataRelated.js` | Elasticsearch lookup: Q-code → collection record ID |
| `lib/wikibase.js` | `wikibase-sdk` instance (Wikidata API URL, SPARQL endpoint) |
| `fixtures/wikibasePropertiesConfig.js` | Which Wikidata properties to fetch, and how |
| `templates/partials/records/wiki-info.html` | Handlebars template for the sidebar panel |
| `client/lib/listeners/get-wiki-data.js` | Browser-side fetch and render |
| `test/wiki-response.test.js` | Offline regression tests |

---

## Data Flow

### 1. Route handler (`routes/wiki.js`)

`GET /wiki/{wikidata}` is the server-side endpoint. On each request:

1. **Cache check** — `fetchCache()` returns a stored result from Redis (or in-memory fallback). If found, the cached JSON is returned immediately.
2. **In-flight deduplication** — `wikiInFlight` is a `Map<qCode, Promise>`. If a fetch for the same Q-code is already running (e.g. concurrent page loads), subsequent requests await the same promise rather than firing duplicate Wikidata calls.
3. **Primary entity fetch** — `wikibase-sdk` builds the URL; `fetch()` retrieves `info`, `claims`, `labels`, and `sitelinks` for the Q-code.
4. **`res.ok` guard** — if Wikidata returns a non-2xx status (e.g. HTTP 429 rate-limit), the error is logged and `null` is returned (503 to client) rather than attempting to parse an HTML error body as JSON.
5. **`configResponse()`** — builds the processed response object (see below).
6. **Cache write** — result is stored via `setCache()` with a configurable TTL (default ~30 days).

### 2. `configResponse()` — response assembly

```
collectNestedQCodes()     ← scans all claims + qualifiers for Q-code references
      ↓
batchFetchEntities()      ← one HTTP call to Wikidata for all nested entity labels
      ↓
Promise.all over wikibasePropertiesConfig entries
      ├─ P18 / P154       → handleImageOrLogo()     (Wikimedia Commons redirect URL)
      ├─ P569 / P570 / P571 → handleDate()          (formatted date string)
      ├─ context=true     → handleContextProperty() (position + company + date range)
      └─ nest=true        → handleNestedProperty()  (label from prefetched entities)
      ↓
fetchImageMetadata()      ← Wikimedia Commons extmetadata API (caption / license)
      ↓
dedupeValueArray()        ← collapses repeated claims (e.g. 50× "Peabody Award" → 1)
      ↓
Wikipedia sitelink        ← entities[qCode].sitelinks.enwiki → obj.wikipediaUrl
```

### 3. Batch pre-fetch (`collectNestedQCodes` + `batchFetchEntities`)

Complex entities reference many nested Q-codes (e.g. an organisation's CEOs, subsidiaries, awards). Rather than fetching each label individually:

- `collectNestedQCodes()` scans every configured claim and its qualifiers, returning a deduplicated array of Q-code strings.
- `batchFetchEntities()` calls `wbk.getManyEntities()` (which automatically splits into ≤50-ID batches as required by the Wikidata API), requesting **labels only** — not claims. This keeps the batch response small regardless of entity complexity.
- The resulting `prefetchedEntities` map is passed down to every property handler. Label lookups hit the map instead of making individual API calls.

### 4. Related links (`lib/getWikidataRelated.js`)

For each nested Q-code value, `relatedWikidata(elastic, qCode)` runs an Elasticsearch term query:

```
{ term: { 'wikidata.keyword': 'https://www.wikidata.org/wiki/{qCode}' } }
```

against the `ciim` index. If a match is found, its `_id` (e.g. `cp20600`) is used to build a `related` link (`{rootUrl}/people/{id}`), which the template renders as an anchor tag.

Properties with the `displayLinked` action flag are **hidden** from the response when no matching collection record exists.

### 5. Image metadata (`fetchImageMetadata`)

After the main property loop, if the entity has a P18 (image) or P154 (logo) claim, `fetchImageMetadata()` calls the [Wikimedia Commons `extmetadata` API](https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata):

Returns an object (or `null` on failure):

```js
{
  caption,           // ImageDescription, HTML stripped
  license,           // LicenseShortName (e.g. "CC BY-SA 4.0")
  licenseUrl,        // LicenseUrl
  artist,            // Artist, HTML stripped
  requiresAttribution, // true if license contains "BY"
  commonsUrl         // https://commons.wikimedia.org/wiki/File:{filename}
}
```

The template renders this as a `<figcaption>` beneath the image: caption, a "Credit" link to the Commons file page (when `requiresAttribution` is true), and a license link.

### 6. Wikipedia sitelink

The primary Wikidata fetch requests `sitelinks` alongside `claims`. If an `enwiki` sitelink is present, `obj.wikipediaUrl` is set to the English Wikipedia URL. The client includes this in the `wikiData` object.

The template HTML block that would display a "Read more on Wikipedia" link is currently **commented out** and can be enabled by removing the `{{!-- --}}` wrapper in `templates/partials/records/wiki-info.html`.

---

## Caching (`lib/cached-wikidata.js`)

| Layer | TTL | When used |
|-------|-----|-----------|
| Redis (`@hapi/catbox-redis`) | ~30 days (configurable) | When Redis host is configured |
| In-memory `Map` | 5 minutes | When Redis is unavailable (local dev) |

Cache keys use `{ segment: 'wikidata', id: qCode }` → Redis key `catbox:wikidata:Q312`.

**Configuration:**
```
# .corc or environment variables (prefix co_)
wikidataCacheTtl    TTL in milliseconds (default: 2629746000 ≈ 30.4 days)
elasticacheEndpoint Redis host:port (e.g. 127.0.0.1:6379)
# or via environment variable:
ELASTICACHE_EP      host:port
```

**Clearing Wikidata cache entries** — use the token-gated admin routes:
```sh
# Clear a single entry
GET /clearcache/wikidata/Q937?token=<CACHE_CLEAR_TOKEN>

# Clear all entries
GET /clearcache/wikidata/all?token=<CACHE_CLEAR_TOKEN>
```

Both routes clear Redis **and** the in-memory fallback Map. See [`docs/cache.md`](cache.md) for full admin route documentation and token setup.

---

## Property Configuration (`fixtures/wikibasePropertiesConfig.js`)

Each entry maps a human-readable label to a Wikidata property ID and a set of action flags:

| Flag | Effect |
|------|--------|
| `nest` | Value is a Q-code — fetch its English label |
| `display` | Show in UI |
| `hide` | Include in JSON response but exclude from UI rendering |
| `context` | Build a contextual string from qualifiers (dates, company) |
| `list` | Render as `<li>` items rather than comma-separated inline |
| `displayLinked` | Only include the item if a matching collection record is found via Elasticsearch |

Example:
```js
'Employer(s)': {
  property: 'P108',
  action: [nest, match, display, displayLinked, context, list]
}
// → fetches label for each employer Q-code, builds "Apple Inc. (1997-2011)" context
//   string from qualifiers, adds a /people/{id} link if the employer is in the collection,
//   and hides the entry if no collection record is found.
```

---

## Testing (`test/wiki-response.test.js`)

Tests run offline against controlled fixtures in `test/fixtures/wikidata/`:

| Fixture | Entity |
|---------|--------|
| `steve-jobs-Q19837.json` | Steve Jobs (Q19837) — person with employer, image, birth/death dates |
| `apple-Q312.json` | Apple Inc. (Q312) — organisation with logo, inception, CEO, founded-by |
| `batch-labels.json` | Catch-all for `getManyEntities` batch requests |

**Run tests:**
```sh
npm run test:unit:tape
```

**Test coverage includes:**
- HTTP 200 + valid JSON response shape
- P18/P154 → Wikimedia Commons redirect URL
- P108 (Employer) label + date range context string
- P108/P169/P112 → `related` link when Elasticsearch returns a collection record
- P112 (Founded By) cross-link: Apple Inc. → Steve Jobs → `/people/cp50119`
- P108 cross-link: Steve Jobs → Apple Inc. → `/people/cp20600`
- P800 (Notable Work) nested label

**Mocking pattern:**
```js
// fetch-mock intercepts Wikidata HTTP calls
sandboxFetch.get(/ids=Q19837/, steveJobsFixture);
sandboxFetch.get((url) => url.includes('ids=Q312&'), appleFixture);
sandboxFetch.get(/wikidata\.org/, batchLabelsFixture); // catch-all

// sinon stubs Elasticsearch for related-link tests
sinon.stub(ctx.elastic, 'search').callsFake(async (opts) => {
  const queryStr = JSON.stringify(opts.body);
  return {
    body: { hits: { hits: queryStr.includes('Q312') ? [{ _id: 'cp20600' }] : [] } }
  };
});
```
