# MCP server: Operations Guide

`/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) endpoint. AI agents (Microsoft Copilot Studio, Claude, Claude Code, VS Code / GitHub Copilot) use it to search the collection, read records, navigate parts and archives, and get exact counts.

It reads only the public catalogue, the same Elasticsearch index as the website, and only returns what the public record pages already show.

It is stateless Streamable HTTP. Every `POST /mcp` is answered by a fresh server instance; `GET` and `DELETE` return `405`. The code is in `routes/mcp.js` and `lib/mcp/`.

---

## Tools

All tools are read-only.

| Tool | Answers |
|------|---------|
| `get_collection_overview` | Totals by type, images and licences, objects on display by museum and gallery, archive levels, recent publishing activity, accepted vocabulary, definitions. Cached for 1 hour. |
| `search_collection` | Find records by free text (ranked like the website search) and/or filters. `sort=most_viewed` uses lifetime page views. |
| `get_record` | One record in full: description, makers, dates, materials, identifiers, display location, images with licence and credit. Also its parent, top-level object, archive and groups, and its parts/children: listed inline up to 50, otherwise summarised. |
| `get_hierarchy` | Paged parts, group members and archive children with child counts. `depth=2` for archive series → files. Per-level counts for a whole archive. |
| `count_records` | Exact counts for any combination of filters. |
| `breakdown_records` | Exact counts grouped by a dimension (museum, gallery, category, maker, licence, decade made, month added…). `match` finds exact filter values. |

### Shared filters

All optional; they combine with AND:
- **Display:** `museum`, `gallery`, `on_display`
- **Images:** `has_image`, `image_licence`
- **Objects:** `category`, `collection`, `maker`, `place_made`, `object_type`, `material`
- **Archives:** `archive`, `archive_id`, `level`
- **Structure:** `parent_id`, `group_id`
- **People:** `occupation`, `birth_place`, `person_or_organisation`
- **Years:** `made_from`/`made_to`, `born_from`/`born_to`
- **Admin dates:** `added_from`/`added_to`, `republished_from`/`republished_to`. These take ISO dates or ES date math, e.g. `now-1M/M` for last month.
- **Scope:** `include_component_parts`

The query is built by `lib/mcp/query/filters.js`. It is deliberately separate from the website's facet code.

### Definitions

These are also sent to agents in the server instructions and in `get_collection_overview`.

- **Component parts** (SPH children) are hidden from website search. They are excluded from counts and search unless `include_component_parts=true`, or the query asks for the children of a record (`parent_id`) or the members of a group (`group_id`).
- **Has image:** at least one image is published (`multimedia.@admin.source`).
- **Licence:** a record counts for a licence when at least one of its images carries it.
- **On display:** an `ondisplay` entry exists. Gallery breakdowns use the "Museum, Gallery" composite, so same-named galleries at different museums stay apart.
- **Added:** first published online (`@admin.added`).
- **Republished:** last re-published online (`@admin.processed`). This follows catalogue edits but also bulk reprocessing, so it is not strictly the last edit date. The index has no source-system edit date.
- **Page views:** lifetime website page views since Aug 2015 (`enhancement.analytics.current.cumulative_views`).

---

## Configuration

Set values in `.corc` or as environment variables. Never commit tokens.

| Config key (`.corc`) | Env var | Default | Description |
|---|---|---|---|
| `mcpEnabled` | `MCP_ENABLED` | `false` | Kill switch. `/mcp` returns `404` when off. |
| `mcpAccess` | `MCP_ACCESS` | `token` | `token`: every call needs a token. `open`: anyone can call (public tier); a valid token still gets its own tier, and a wrong token is rejected. |
| `mcpClients` | `co_mcpClients__<name>__token`, `co_mcpClients__<name>__tier` | `{}` | Named clients, `{ "<name>": { "token": "…", "tier": "internal" \| "public" } }`. Tokens must be at least 32 characters; shorter ones are ignored. |
| `mcpAllowQueryKey` | `MCP_ALLOW_QUERY_KEY` | `false` | Also accept `?key=<token>`, for clients that can't send headers. URL tokens end up in access logs, so give such a client its own token. |
| `mcpMaxConcurrentAggregations` | `MCP_MAX_CONCURRENT_AGGREGATIONS` | `3` | Heavy aggregation queries allowed at once per instance. Others wait up to 2s, then get a "busy, retry" answer. |
| `mcpGa4MeasurementId` | `MCP_GA4_MEASUREMENT_ID` | — | GA4 measurement ID for agent-traffic events (optional). |
| `mcpGa4ApiSecret` | `MCP_GA4_API_SECRET` | — | GA4 Measurement Protocol API secret, from GA4 Admin → Data streams → Measurement Protocol API secrets. |

Generate a token:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

**Auth.** Clients send `Authorization: Bearer <token>` or `X-API-Key: <token>`. MCP tokens are separate from the admin and cache-clear tokens, which are never accepted here.

**Tiers.** Today every tier gets the same tools. Tiers exist so that internal-only tools can later be registered for `internal` tokens without changing the public surface (see `lib/mcp/server.js`).

---

## Infrastructure

- **CloudFront** needs a dedicated `/mcp*` behaviour:
  - allow `POST`;
  - caching disabled;
  - forward the `Authorization`, `X-API-Key`, `Accept`, `Content-Type` and `Mcp-Protocol-Version` headers, and the query string.
- **Rate limiting is done by the WAF on `/mcp*`, not in the app.** The app only guards Elasticsearch, with 8s query timeouts, size caps and the aggregation concurrency cap.
- **To shut out anonymous traffic quickly:**
  - set `MCP_ACCESS=token`, which takes effect on restart; or
  - for an instant block without a restart, add a WAF rule that blocks `/mcp*` requests with no `Authorization`/`X-API-Key` header.
- **Agents call from their vendor's cloud,** not the user's machine. The endpoint must be publicly reachable, and an IP allowlist won't work as a gate.

---

## Analytics

- **Log line.** Every tool call writes one JSON log line: `{"evt":"mcp_tool","tool":…,"client":…,"tier":…,"ok":…,"ms":…,"results":…,"q":…}`.
- **GA4 event.** When the GA4 settings are present, each call also sends an `mcp_tool_call` event, with `traffic_source_type=agent`. Register `traffic_source_type` (and optionally `tool`, `client`) as custom dimensions in GA4 to report on them.
- No IP addresses or tokens are logged or sent. Anonymous callers appear as `client=anonymous`.

---

## Connecting clients

A remote MCP server is added by URL; no plugin or `.mcpb` bundle is needed.

- **Claude (Team/Enterprise).** An org Owner adds it once: Organization settings → Connectors → Add → Custom → Web, then the name and URL. Members enable it themselves.
  - Claude's connector dialog offers "No sign in" or OAuth.
  - So with `mcpAccess=token`, use the `?key=` form (enable `mcpAllowQueryKey` and issue Claude its own token).
  - With `open`, choose "No sign in".
- **Microsoft Copilot Studio.** In the agent, go to Tools → Add a tool → New tool → Model Context Protocol, then enter a name, description and the URL.
  - Auth: API key, type Header, header `Authorization`, value `Bearer <token>`.
  - Publish the agent to Teams / Microsoft 365 Copilot.
  - Generative orchestration must be on.
- **Claude Code:**
  ```bash
  claude mcp add --transport http smg-collection https://<host>/mcp --header "Authorization: Bearer <token>"
  ```
- **VS Code / GitHub Copilot.** Add the URL and header in `.vscode/mcp.json`.

### Local testing

Run the app with `MCP_ENABLED=true` and a dev client token, then point an MCP client at `http://localhost:8000/mcp`. For example, use the MCP Inspector or the Claude Code command above. Tests: `test/mcp-*.test.js`.
