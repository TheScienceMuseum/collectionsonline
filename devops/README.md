# devops/

Infrastructure tooling that's not part of the application's runtime — local
development setup, schema bootstrap scripts, future deploy / WAF / backup
configuration. Anything that's *about* running the app rather than *run by*
the app.

Top-level structure:

| Folder | What's in it |
|---|---|
| `dynamodb-local/` | Spinning up a local DynamoDB instance for the AI biographies feature: docker-compose template + table-creation script. |

Future additions (each in its own subfolder):

- `waf/` — production WAF rules (currently lives at the repo root in `/waf-rules`, gitignored)
- `deploy/` — production deploy scripts when they exist
- `backup/` — scheduled backup tooling once the production cron is set up

## Conventions

- Each subfolder is a coherent concern (one piece of infrastructure, one
  workflow). Shared utilities can live at this level or under a `common/`
  if it ever becomes a thing.
- Committed files are templates / example configs / generic scripts.
  Per-developer working copies live in `development/` (gitignored).
- README in each subfolder explains its specific usage. This top-level
  README just inventories what's here.
