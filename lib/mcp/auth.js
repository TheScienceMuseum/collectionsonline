'use strict';

// Who is calling /mcp.
//
// config.mcpClients maps a client name to its token and tier:
//   { "copilot": { "token": "<32+ chars>", "tier": "internal" } }
// (env: co_mcpClients__copilot__token=… / co_mcpClients__copilot__tier=…).
// A bare string value is shorthand for { token, tier: 'internal' }.
//
// config.mcpAccess:
//   'token' (default) — every request needs a valid token.
//   'open'            — no token needed (public tier); a valid token still
//                       upgrades the caller to its tier, and a wrong token is
//                       rejected rather than silently downgraded.
//
// Deliberately separate from lib/ai/admin-auth.js, whose resolver falls back
// to the admin and cache-clear tokens.

const safeEquals = require('../helpers/safe-equals');

const MIN_TOKEN_LENGTH = 32;
const TIERS = ['internal', 'public'];

const clients = (config) => {
  const raw = config.mcpClients || {};
  return Object.keys(raw).map((name) => {
    const entry = typeof raw[name] === 'string' ? { token: raw[name] } : (raw[name] || {});
    return {
      name,
      token: entry.token,
      tier: TIERS.includes(entry.tier) ? entry.tier : 'internal'
    };
  }).filter((c) => typeof c.token === 'string' && c.token.length >= MIN_TOKEN_LENGTH);
};

const presentedToken = (request, config) => {
  const header = request.headers.authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(header);
  if (bearer) return bearer[1].trim();
  if (request.headers['x-api-key']) return String(request.headers['x-api-key']).trim();
  const allowQuery = config.mcpAllowQueryKey === true || config.mcpAllowQueryKey === 'true';
  if (allowQuery && request.query && request.query.key) return String(request.query.key).trim();
  return null;
};

/**
 * @returns {{ ok: true, client: string, tier: string } | { ok: false, message: string }}
 */
const authenticate = (request, config) => {
  const token = presentedToken(request, config);
  const open = config.mcpAccess === 'open';

  if (!token) {
    return open
      ? { ok: true, client: 'anonymous', tier: 'public' }
      : { ok: false, message: 'Missing token. Send Authorization: Bearer <token> or X-API-Key.' };
  }

  // Compare against every client (no early exit) so timing doesn't reveal
  // which entry, if any, matched.
  let match = null;
  clients(config).forEach((c) => {
    if (safeEquals(token, c.token) && !match) match = c;
  });

  return match
    ? { ok: true, client: match.name, tier: match.tier }
    : { ok: false, message: 'Invalid token.' };
};

module.exports = { authenticate, MIN_TOKEN_LENGTH };
