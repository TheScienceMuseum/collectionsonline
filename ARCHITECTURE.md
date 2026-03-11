# Collections Online — Architecture Guide

A developer-oriented guide to how the application is structured and how data flows through it. For a deeper dive see `site-architecture-and-code-overview.md`.

---

## How a Page Gets to the Browser

### First Load (Server-Side Render)

```
Browser GET /objects/co123456
    │
    ▼
Hapi route handler  (routes/object.js)
    │  1. Fetch record from Elasticsearch by ID
    │  2. Fetch related items + child records in parallel
    │  3. buildJSONResponse()  →  JSON:API shape
    │
    ▼
lib/jsonapi-response.js
    │  Converts raw ES _source into a structured response:
    │  - attribute whitelist
    │  - image path rewriting (mediaPath / iiifPath)
    │  - child record merging (SPH/MPH hierarchies)
    │  - links, relationships, included resources
    │
    ▼
lib/transforms/json-to-html-data.js
    │  Flattens JSON:API into plain template-ready object:
    │  title, images, facts, details, displayLocation, jsonLD …
    │
    ▼
Hapi Vision  →  Handlebars template render
    │  templates/layouts/default.html
    │  templates/pages/object.html
    │  templates/partials/**
    │
    ▼
Full HTML page  +  <script src="/bundle.js">
```

### Subsequent Navigation (SPA / Client-Side)

After the first load, page.js intercepts link clicks and handles navigation without a full page reload.

```
User clicks link  →  page.js intercepts
    │
    ▼
client/routes/resources.js  (or search.js for search)
    │
    ├── load()    Fetch  GET /objects/co123456  with Accept: application/vnd.api+json
    │             Same route handler, returns JSON instead of HTML
    │             json-to-html-data.js transform runs client-side
    │
    ├── render()  Templates.objects(data)  →  DOM innerHTML replaced
    │             Only replaces #main-page (full pages) or .results-page (search)
    │
    └── listeners()  Re-attach DOM event handlers
```

The server and client use the **same route, the same transform, the same Handlebars templates** — the only difference is where they run. Content-type negotiation (`routes/route-helpers/content-type.js`) switches the response between HTML and JSON:API based on the `Accept` header.

---

## How Search Works

### URL Structure

Filters live in the URL **path**, not the query string:

```
/search/objects/makers/science-museum%252c-london/categories/clocks?q=rocket&page=2
         │      │      │                           │          │
         type   key    value (encoded)             key        value
```

### Filter Value Encoding

Filter values are encoded by `lib/helpers/encode-filter-value.js`:

| Character | Encoded as | Example |
|-----------|-----------|---------|
| space | `-` | `Science Museum` → `science-museum` |
| hyphen | `%252D` | `Rolls-Royce` → `rolls%252droyce` |
| slash | `%252F` | `Museum/Gallery` → `museum%252fgallery` |
| comma | `%252C` | `Science Museum, London` → `science-museum%252c-london` |

The double-encoding (`%25` = `%`) is intentional: Hapi pre-decodes `%25→%` in path params, leaving `%2X` for the app to decode with `decodeURIComponent`.

### Filter Pipeline

```
URL path (e.g. /search/objects/makers/science-museum%252c-london)
    │
    ▼  Hapi pre-decodes %25→% in path params
    │  → science-museum%2c-london
    ▼
routes/route-helpers/parse-params.js
    │  - Extracts type (objects/people/documents/group/all)
    │  - Reads alternating key/value pairs
    │  - Decodes each value: dashToSpace() then decodeURIComponent() × 2
    │    → 'Science Museum, London'
    │
    ▼
lib/query-params/query-params.js
    │  Builds structured queryParams object:
    │  { q, pageNumber, type, filter: { objects: {...}, people: {...}, ... } }
    │
    ▼
lib/query-params/format-value.js
    │  HTML path: wraps string in array → ['Science Museum, London']
    │  JSON path: splits on commas only when no part starts with a space
    │             (space-after-comma heuristic distinguishes literal commas
    │              in a value from multi-value separators)
    │
    ▼
lib/search.js  →  Elasticsearch function_score query
    │
    └── lib/facets/create-filters.js      which records to show
    └── lib/facets/aggs-all.js            count per facet value
    └── lib/facets/create-post-filter.js  which type tab is active
```

### Why Special Characters Are Tricky

Multiple filter values for the same key are separated by `,` in the URL. But some values *contain* commas, hyphens, or slashes. The canonical encoding scheme handles all of these:

- `encodeFilterValue()` (in `lib/helpers/encode-filter-value.js`) encodes hyphens, slashes and commas with `%252X` before replacing spaces with `-`
- `parse-params.js` decodes with `dashToSpace()` then two passes of `decodeURIComponent()` — the second pass is a no-op server-side (Hapi already did one decode) but is required for the SPA client path which has no Hapi pre-decode
- `format-value.js` uses a space-after-comma heuristic: multi-value separators never have a following space; literal commas in place/collection names always do

**Do not change `encode-filter-value.js`, `parse-params.js` or `format-value.js` without testing both the HTML (server) path and the JSON/SPA path.**

### Facet Counts

The three-part Elasticsearch pattern:

| Part | Purpose | File |
|------|---------|------|
| `filters` | What records match the current search | `lib/facets/create-filters.js` |
| `aggregations` | How many records match each facet option | `lib/facets/aggs-all.js` |
| `post_filter` | Which type tab (objects/people/docs) is active | `lib/facets/create-post-filter.js` |

Aggregations wrap the current active filters, so facet counts always reflect the narrowed result set.

---

## Type Mapping

Internal Elasticsearch types differ from external URL types. Always use `lib/type-mapping.js` — never hardcode type strings.

| URL (external) | Elasticsearch (internal) |
|----------------|--------------------------|
| `people` | `agent` |
| `objects` | `object` |
| `documents` | `archive` |
| `group` | `mgroup` |

---

## Museum Names

Museum names go through three layers:

1. **Short codes** (`fixtures/museums.js`) — used in URLs: `scm`, `nrm`, `sim`, `nsmm`, `locomotion`
2. **Code → name mapping** (`lib/museum-mapping.js`) — `museumMap.toLong('scm')` → `'Science Museum'`
3. **Old name remapping** (`lib/helpers/search-results-to-template-data/pillbox-ondisplay.js`) — some ES records still contain old names (e.g. `National Media Museum`); these are remapped for display only

On-display filters query both `location.name.value.lower` (old schema) and `facility.name.value.lower` (new schema) with an OR, so both old and new indexed records are covered.

---

## Caching

All caching uses `@hapi/catbox` + Redis. If Redis is unavailable, a `NULL_CACHE` stub (`bin/cache.js`) returns null for all reads — the site degrades gracefully.

| What | TTL | How to clear |
|------|-----|-------------|
| Wikidata | 30 days (configurable) | `GET /clearcache/wikidata/{qcode}?token=` or `/all` |
| Archive/document trees | 24 hours (configurable) | `GET /clearcache/documents/{id}?token=` or `/all` |
| Article/blog feeds | 24 hours (configurable) | `GET /clearcache/articles/{slug}?token=` or `/all` |
| HTTP responses | 1–24 hours (route-specific) | Deploy / CDN purge |

Article feeds are also pre-warmed at startup and automatically re-warmed when cleared via the route. See [`docs/cache.md`](docs/cache.md) for the full admin route reference, token setup, and article slugs.

---

## Asset Build

```
npm run build
    ├── build:js   browserify client/main.js  →  public/bundle.js
    │              (includes pre-compiled Handlebars templates via brfs)
    └── build:css  SCSS + autoprefixer        →  public/bundle.css
```

**Do not edit `client/templates.js` directly** — it is generated by the build system. Edit the source `.html` files in `templates/` and rebuild.

---

## Key Files at a Glance

| File | What it does |
|------|-------------|
| `bin/server.mjs` | ESM entry point — starts ES client + Hapi server |
| `server.js` | Hapi setup — registers Vision, Inert, routes |
| `routes/index.js` | Central route registry |
| `lib/jsonapi-response.js` | ES `_source` → JSON:API shape (559 lines) |
| `lib/transforms/json-to-html-data.js` | JSON:API → template data (1051 lines) |
| `lib/transforms/search-results-to-template-data.js` | ES aggregations → search page data |
| `lib/search.js` | Elasticsearch query builder |
| `lib/search-weights.js` | Quality / analytics scoring |
| `lib/facets/create-filters.js` | Filter clause builder (14 filter types) |
| `lib/facets/aggs-all.js` | Facet aggregation builder |
| `lib/type-mapping.js` | Internal ↔ external type conversion |
| `lib/museum-mapping.js` | Museum short code ↔ full name |
| `client/main.js` | Browserify entry — registers page.js routes |
| `client/templates.js` | Pre-compiled Handlebars templates (build artifact) |

---

## Testing

```bash
npm run test:unit:tape   # Offline unit tests (preferred locally — no ES needed)
npm run test:unit        # Sync fixtures from live ES, then run tests
npm run test:endtoend    # Nightwatch e2e (requires server on :8000)
npm run test:lint        # Semistandard linting only
```

Unit tests use sinon stubs for Elasticsearch and Redis — no real services needed.
