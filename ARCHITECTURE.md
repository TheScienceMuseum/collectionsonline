# Collections Online — Architecture Guide

A developer-oriented guide to how the application is structured and how data flows through it. For a deeper dive including code quality notes, see `site-architecture-and-code-overview.md`.

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
/search/objects/makers/Science Museum, London/categories/Clocks?q=rocket&page=2
         │      │      │                       │          │
         type   key    value                   key        value
```

### Filter Pipeline

```
URL path
    │
    ▼
routes/route-helpers/parse-params.js
    │  - Extracts type (objects/people/documents/group/all)
    │  - Reads alternating key/value pairs
    │  - Escapes literal commas as \,  ← critical for names like "Science Museum, London"
    │
    ▼
lib/query-params/query-params.js
    │  Builds structured queryParams object:
    │  { q, pageNumber, type, filter: { objects: {...}, people: {...}, ... } }
    │
    ▼
lib/query-params/format-value.js
    │  HTML path: array already — unescapes \, → ,
    │  JSON path: string — splits on unescaped commas, then unescapes each value
    │
    ▼
lib/search.js  →  Elasticsearch function_score query
    │
    └── lib/facets/create-filters.js      which records to show
    └── lib/facets/aggs-all.js            count per facet value
    └── lib/facets/create-post-filter.js  which type tab is active
```

### Why Commas Are Tricky

Multiple filter values for the same key are separated by `,` in the URL. But some values *contain* commas (e.g. `Science Museum, London`). The solution:

- Literal commas inside a value are **escaped as `\,`** when building the URL
- `splitOnUnescapedCommas()` splits only on bare `,` — not `\,`
- After splitting, `\,` is unescaped back to `,`

This logic lives in `parse-params.js` (escaping) and `format-value.js` (unescaping). **Do not change either file without testing both the HTML path and the JSON/SPA path.**

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
| Wikidata | 30 days | `GET /wiki/{qcode}?clear` |
| Archive/document trees | 24 hours | Wait for TTL |
| Article/blog feeds | 24 hours | `GET /feeds/refresh` |
| HTTP responses | 1–24 hours (route-specific) | Deploy / CDN purge |

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
