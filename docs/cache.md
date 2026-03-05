# Cache — Operations Guide

Redis caching is used to reduce Elasticsearch and external API load for three types of data: Wikidata entity panels, archive/document tree hierarchies, and external article feeds. All caching uses `@hapi/catbox` with `@hapi/catbox-redis` as the adapter. If Redis is unavailable a `NULL_CACHE` stub is used and the site degrades gracefully (data is fetched directly on every request).

---

## Cache Segments

| Segment | What it stores | Default TTL | Redis key format |
|---------|---------------|-------------|-----------------|
| `wikidata` | Wikidata entity JSON (processed by `configResponse`) | 30 days | `catbox:wikidata:{qCode}` |
| `documents` | Archive hierarchy trees (fonds + all children, sorted) | 24 hours | `catbox:documents:{fondsId}` |
| `feed` | External article feed JSON payloads | 24 hours | `catbox:feed:{encodedUrl}` |

Feed keys use `encodeURIComponent` on the full URL, e.g.:
```
catbox:feed:https%3A%2F%2Fwww.sciencemuseum.org.uk%2Fcollection-media%2Fcollection-usage%2Fobjects
```

Wikidata also maintains a short-lived **in-memory `Map` fallback** for when Redis is unavailable (1 minute in development, 5 minutes otherwise). The `/clearcache/wikidata/*` routes clear both Redis and the in-memory fallback.

---

## Configuration

All values can be set in `.corc` or as environment variables (prefix `co_` for `.corc` keys; direct uppercase names for secrets).

| Config key (`.corc`) | Env var | Default | Description |
|---------------------|---------|---------|-------------|
| `elasticacheEndpoint` | `ELASTICACHE_ENDPOINT` | — | Redis host:port (e.g. `127.0.0.1:6379`) |
| `wikidataCacheTtl` | `co_wikidataCacheTtl` | `2629746000` (~30 days) | Wikidata TTL in milliseconds |
| `articleCacheTtl` | `co_articleCacheTtl` | `86400000` (24 hours) | Article feed TTL in milliseconds |
| `documentCacheTtl` | `co_documentCacheTtl` | `86400000` (24 hours) | Document/archive TTL in milliseconds |
| `cacheClearToken` | `CACHE_CLEAR_TOKEN` | — | Secret token for admin routes (see below) |

**Legacy Redis config keys** (`elasticacheHost` + `elasticachePort`) are still supported but `elasticacheEndpoint` is preferred.

---

## Token Setup

All `/clearcache/*` and `/listcache/*` routes require a `?token=` query parameter. The token is compared using `crypto.timingSafeEqual` to prevent timing attacks.

**Generate a token:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# example: a3f8e2c1d4b6a9f0e3c2d5b8a1f4e7c0
```

**Development (`.corc`):**
```json
{
  "cacheClearToken": "a3f8e2c1d4b6a9f0e3c2d5b8a1f4e7c0"
}
```

**Production (environment variable):**
```
CACHE_CLEAR_TOKEN=a3f8e2c1d4b6a9f0e3c2d5b8a1f4e7c0
```

Requests without a token or with a wrong token return `401 Unauthorised`. Requests to bulk routes (`/all`) when Redis is not configured return `503 Redis not available`.

---

## Startup Behaviour

Article feeds are **pre-warmed at startup** by `lib/feeds.js` (called from `bin/server.mjs`). Feeds are fetched sequentially to avoid triggering Cloudflare rate-limiting on the external endpoints. If an endpoint fails, a 60-second cooldown prevents hammering it.

Wikidata and document caches are **populated on demand** — a cache miss triggers a fetch and the result is stored for subsequent requests.

---

## Admin Routes

### `/listcache` — Inspect cache contents

List what is currently in each Redis segment. Useful before deciding what to clear.

| Route | Returns |
|-------|---------|
| `GET /listcache/wikidata?token=` | All cached Q-codes |
| `GET /listcache/articles?token=` | All cached feed URLs with their hostname and label |
| `GET /listcache/documents?token=` | All cached fondsIds |

**Example response** — `/listcache/wikidata?token=<TOKEN>`:
```json
{
  "segment": "wikidata",
  "count": 3,
  "keys": ["Q937", "Q42", "Q1234"]
}
```

**Example response** — `/listcache/articles?token=<TOKEN>`:
```json
{
  "segment": "articles",
  "count": 2,
  "keys": [
    {
      "url": "https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects",
      "host": "www.sciencemuseum.org.uk",
      "label": "Science Museum"
    }
  ]
}
```

---

### `/clearcache/wikidata` — Clear Wikidata cache

Clears entries from **both Redis and the in-memory fallback**. Individual entries are re-fetched from the Wikidata API the next time a user loads that person/organisation page.

| Route | Effect |
|-------|--------|
| `GET /clearcache/wikidata/all?token=` | SCAN + DELETE all `catbox:wikidata:*` keys, clear in-memory Map |
| `GET /clearcache/wikidata/{qcode}?token=` | Drop a single Q-code (e.g. `Q937`) |

**Example response** — `/clearcache/wikidata/all?token=<TOKEN>`:
```json
{ "cleared": "wikidata", "count": 42 }
```

**Example response** — `/clearcache/wikidata/Q937?token=<TOKEN>`:
```json
{ "cleared": "wikidata", "qcode": "Q937" }
```

---

### `/clearcache/articles` — Clear article feed cache

Clears entries from Redis and **immediately re-warms** them (fetching fresh data from the external feed endpoints). Re-warming runs sequentially, matching the startup warm-up behaviour, to avoid Cloudflare rate-limiting.

| Route | Effect |
|-------|--------|
| `GET /clearcache/articles/all?token=` | Drop all feeds, re-warm all endpoints |
| `GET /clearcache/articles/{host}?token=` | Drop feeds for one hostname via SCAN glob, re-warm it |

The `{host}` parameter is the feed URL's hostname (e.g. `www.sciencemuseum.org.uk`). Uses a Redis SCAN glob `catbox:feed:*{host}*` so it catches all keys for that host regardless of URL path. If the host is not recognised, a `404` is returned listing all available hosts.

**Example response** — `/clearcache/articles/all?token=<TOKEN>`:
```json
{
  "cleared": "articles",
  "dropped": 10,
  "rewarmed": [
    { "host": "www.sciencemuseum.org.uk", "label": "Science Museum", "url": "https://...", "warmed": true },
    { "host": "www.railwaymuseum.org.uk", "label": "Railway Museum", "url": "https://...", "warmed": true }
  ]
}
```

**Example response** — `/clearcache/articles/www.sciencemuseum.org.uk?token=<TOKEN>`:
```json
{
  "cleared": "articles",
  "host": "www.sciencemuseum.org.uk",
  "dropped": 1,
  "rewarmed": [
    { "label": "Science Museum", "url": "https://...", "warmed": true }
  ]
}
```

**Article feed hosts** (from `fixtures/article-endpoints.js`):

| Host | Label |
|------|-------|
| `www.scienceandmediamuseum.org.uk` | National Science and Media Museum |
| `www.scienceandindustrymuseum.org.uk` | Science and Industry Museum |
| `www.sciencemuseum.org.uk` | Science Museum |
| `www.railwaymuseum.org.uk` | Railway Museum |
| `blog.sciencemuseum.org.uk` | Science Museum Blog |
| `blog.railwaymuseum.org.uk` | Railway Museum Blog |
| `blog.scienceandmediamuseum.org.uk` | Science and Media Museum Blog |
| `blog.scienceandindustrymuseum.org.uk` | Science and Industry Museum Blog |
| `www.sciencemuseumgroup.org.uk` | Science Museum Group |
| `blog.sciencemuseumgroup.org.uk` | Science Museum Group Blog |

---

### `/clearcache/documents` — Clear archive/document cache

Clears document hierarchy trees from Redis. Entries are re-fetched from Elasticsearch the next time a user loads that archive page.

| Route | Effect |
|-------|--------|
| `GET /clearcache/documents/all?token=` | SCAN + DELETE all `catbox:documents:*` keys |
| `GET /clearcache/documents/{id}?token=` | Drop a single fondsId (e.g. `aa110000001`) |

**Example response** — `/clearcache/documents/all?token=<TOKEN>`:
```json
{ "cleared": "documents", "count": 15 }
```

**Example response** — `/clearcache/documents/aa110000001?token=<TOKEN>`:
```json
{ "cleared": "documents", "id": "aa110000001" }
```

---

## Key Files

| File | Purpose |
|------|---------|
| `bin/cache.js` | Catbox client initialisation; exports `cache` (Catbox) and `redis` (raw ioredis for SCAN/DEL) |
| `lib/cache-admin.js` | SCAN helpers, token validation, article host helpers |
| `routes/cache-admin.js` | All `/clearcache/*` and `/listcache/*` route handlers |
| `lib/cached-wikidata.js` | Wikidata Redis + in-memory cache layer |
| `lib/cached-document.js` | Archive hierarchy cache layer |
| `lib/cached-feed.js` | Article feed cache layer |
| `lib/feeds.js` | Startup feed warm-up (called from `bin/server.mjs`) |
| `fixtures/article-endpoints.js` | Feed endpoint URLs and labels |
| `config.js` | Config loader — reads `.corc` or `co_*` / `CACHE_CLEAR_TOKEN` env vars |
| `.corc.template` | Template showing all available config keys |
