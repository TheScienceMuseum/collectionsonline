'use strict';

// Admin auth.
//
// Two paths, both config-driven, no DB / session store:
//   1. Named users via `config.adminUsers` — a plain object of
//      { username: token } pairs. Preferred: attributes notes/flags/
//      reviews to the actual person, revocable by deleting the entry.
//   2. Shared break-glass `config.adminToken` (legacy) — no username
//      required, attributed as 'admin'. Kept so a typo in adminUsers
//      doesn't lock you out of your own tool.
//
// Revocation model: live cookies are re-verified against the current
// config on every request (no server-side session). Remove a user's
// entry from .corc, nodemon picks it up, their cookie fails the next
// page load, they land back on the login screen.
//
// Cookie carries BOTH username + token. Username alone isn't enough
// (cookies are visitor-editable), and we never issue an HMAC or
// signed session — the token acts as the proof-of-identity and the
// username tells us which config entry to compare against.

const crypto = require('crypto');

// Usernames are kept deliberately simple: lowercase alphanumeric with
// hyphens, 2–30 chars. Prevents quirky attribution like `staff: "Jamie "`
// on notes and makes the .corc shape easy to eyeball.
const USERNAME_RE = /^[a-z0-9-]{2,30}$/;

// Timing-safe equality. Returns false rather than throwing on any
// edge case so a malformed cookie / payload lands as "rejected" not
// "500". Short-circuits on length mismatch since timingSafeEqual
// requires equal-length buffers.
function safeEquals (a, b) {
  if (a == null || b == null) return false;
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_) {
    return false;
  }
}

// Given a token alone, figure out which user it belongs to. Used both
// by the login flow (to attribute a fresh session) and by per-request
// re-validation (to verify a cookie's claim still holds against the
// current config). O(n) over adminUsers — at <20 users this is
// imperceptible, and since tokens are random 128-bit values the lookup
// is effectively a linear password check that can't be short-circuited
// by knowing usernames.
//
// Every comparison uses timing-safe equality so the response time
// doesn't leak which user (if any) matched. Falls through to the
// break-glass shared admin token when no named user owns it.
//
// Returns the resolved username (lowercase) or null.
function resolveTokenToUser (token, config) {
  if (!token) return null;
  const adminUsers = (config && config.adminUsers) || {};
  const keys = Object.keys(adminUsers);
  for (let i = 0; i < keys.length; i++) {
    if (safeEquals(token, adminUsers[keys[i]])) {
      return keys[i].toLowerCase();
    }
  }
  const fallback = (config && (config.adminToken || config.cacheClearToken));
  if (fallback && safeEquals(token, fallback)) return 'admin';
  return null;
}

// Per-request re-validation: does this (username, token) cookie pair
// still resolve to the same user in the current config? Defends against
// a tampered cookie claiming a different identity — if the token
// resolves to a DIFFERENT username than the cookie says, we reject
// rather than trust either value.
function validateCredentials (username, token, config) {
  const resolved = resolveTokenToUser(token, config);
  if (!resolved) return null;
  if (username && USERNAME_RE.test(username)) {
    return resolved === username.toLowerCase() ? resolved : null;
  }
  // No username on the cookie (break-glass path): accept any token-owner
  // resolution. Login flow always sets both cookies so this branch is
  // only hit for legacy single-cookie sessions mid-migration.
  return resolved;
}

// Boolean re-verifier for a logged-in request's cookies. Re-runs
// validateCredentials against the live config so a revoked user is
// kicked on their next page load.
function validateAdminToken (request, config) {
  const state = request.state || {};
  return validateCredentials(state.adminUser, state.adminToken, config) !== null;
}

// Who is logged in? Reads the username cookie (trusting it — the
// paired token cookie has already been validated by requireAuth at
// route-handler time). Used by `staffOf()` in admin-ai.js when
// attributing notes, flags, reviews.
function getStaffIdentity (request) {
  const username = (request.state || {}).adminUser;
  if (username && USERNAME_RE.test(username)) return username;
  return 'admin';
}

// Issue both cookies atomically on successful login. The 'admin'
// fallback on username is for the break-glass path (where only the
// token matched; no named user resolved).
function setAdminCookie (h, creds, isProduction) {
  const opts = {
    ttl: 24 * 60 * 60 * 1000,
    isSecure: isProduction,
    isHttpOnly: true,
    isSameSite: 'Strict',
    path: '/admin'
  };
  h.state('adminToken', creds.token, opts);
  h.state('adminUser', creds.username || 'admin', opts);
  return h;
}

module.exports = {
  resolveTokenToUser,
  validateCredentials,
  validateAdminToken,
  getStaffIdentity,
  setAdminCookie,
  USERNAME_RE
};
