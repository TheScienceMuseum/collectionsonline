'use strict';

// Unit tests for the admin-auth module.
//
// History note: this file used to test a function called `isValidToken`
// that returned a boolean. The module was refactored (see lib/ai/admin-auth.js
// header — named admin users with attribution) and `isValidToken` was
// replaced by:
//   - `resolveTokenToUser(token, config)` → resolved username | null
//   - `validateCredentials(username, token, config)` → resolved username | null
//   - `validateAdminToken(request, config)` → boolean (cookie re-verifier)
//
// Tests now exercise the current API directly. Coverage maps onto the
// previous suite plus the new named-user behaviour the refactor added.

const test = require('tape');
const adminAuth = require('../lib/ai/admin-auth');

// -----------------------------------------------------------------------
// resolveTokenToUser — token-to-username resolution
// -----------------------------------------------------------------------

test('resolveTokenToUser: matches named user → returns username', function (t) {
  const config = { adminUsers: { jamie: 'token-jamie', alice: 'token-alice' } };
  t.equal(adminAuth.resolveTokenToUser('token-jamie', config), 'jamie');
  t.equal(adminAuth.resolveTokenToUser('token-alice', config), 'alice');
  t.end();
});

test('resolveTokenToUser: lowercases the resolved username', function (t) {
  // Defensive — usernames in config are usually already lowercase, but
  // any mixed-case key gets normalised on the way out so callers can
  // compare without thinking about case.
  const config = { adminUsers: { Jamie: 'tok' } };
  t.equal(adminAuth.resolveTokenToUser('tok', config), 'jamie');
  t.end();
});

test('resolveTokenToUser: falls back to break-glass adminToken → returns "admin"', function (t) {
  const config = { adminToken: 'shared-secret' };
  t.equal(adminAuth.resolveTokenToUser('shared-secret', config), 'admin');
  t.end();
});

test('resolveTokenToUser: falls back to legacy cacheClearToken → returns "admin"', function (t) {
  // Backwards compat: pre-named-users, cacheClearToken doubled as admin
  // token. Kept as a fallback so existing deploys don't break on upgrade.
  const config = { cacheClearToken: 'legacy-token' };
  t.equal(adminAuth.resolveTokenToUser('legacy-token', config), 'admin');
  t.end();
});

test('resolveTokenToUser: prefers adminToken over cacheClearToken when both set', function (t) {
  const config = { adminToken: 'primary', cacheClearToken: 'secondary' };
  t.equal(adminAuth.resolveTokenToUser('primary', config), 'admin');
  t.equal(adminAuth.resolveTokenToUser('secondary', config), null,
    'cacheClearToken not used when adminToken is set');
  t.end();
});

test('resolveTokenToUser: prefers named user over break-glass when both could match', function (t) {
  // adminUsers checked first; falls through to adminToken only if no
  // named user owns the token.
  const config = {
    adminUsers: { jamie: 'shared' },
    adminToken: 'shared'
  };
  t.equal(adminAuth.resolveTokenToUser('shared', config), 'jamie',
    'named user wins over break-glass');
  t.end();
});

test('resolveTokenToUser: returns null for non-matching token', function (t) {
  const config = { adminToken: 'right' };
  t.equal(adminAuth.resolveTokenToUser('wrong', config), null);
  t.end();
});

test('resolveTokenToUser: returns null for empty / nullish input', function (t) {
  const config = { adminToken: 'right' };
  t.equal(adminAuth.resolveTokenToUser('', config), null, 'empty token');
  t.equal(adminAuth.resolveTokenToUser(null, config), null, 'null token');
  t.equal(adminAuth.resolveTokenToUser(undefined, config), null, 'undefined token');
  t.end();
});

test('resolveTokenToUser: returns null when no config tokens defined', function (t) {
  t.equal(adminAuth.resolveTokenToUser('any', {}), null, 'empty config');
  t.equal(adminAuth.resolveTokenToUser('any', { adminToken: '' }), null, 'empty admin token');
  t.equal(adminAuth.resolveTokenToUser('any', { adminUsers: {} }), null, 'empty users map');
  t.end();
});

// -----------------------------------------------------------------------
// validateCredentials — per-request re-verification of cookie pairs
// -----------------------------------------------------------------------

test('validateCredentials: matched username + token → returns username', function (t) {
  const config = { adminUsers: { jamie: 'tok' } };
  t.equal(adminAuth.validateCredentials('jamie', 'tok', config), 'jamie');
  t.end();
});

test('validateCredentials: tampered cookie claiming wrong username is rejected', function (t) {
  // Attack vector: visitor edits the username cookie to claim a different
  // identity while keeping their valid token. Resolution must not succeed
  // if the token resolves to a different user than the cookie claims.
  const config = { adminUsers: { jamie: 'tok-jamie', alice: 'tok-alice' } };
  t.equal(adminAuth.validateCredentials('alice', 'tok-jamie', config), null,
    'token belongs to jamie, cookie says alice → reject');
  t.end();
});

test('validateCredentials: break-glass token with no username cookie → returns "admin"', function (t) {
  // Legacy single-cookie sessions mid-migration: only the token cookie
  // is present, no username cookie. Falls through and accepts.
  const config = { adminToken: 'shared' };
  t.equal(adminAuth.validateCredentials(undefined, 'shared', config), 'admin');
  t.equal(adminAuth.validateCredentials('', 'shared', config), 'admin');
  t.end();
});

test('validateCredentials: malformed username falls through to break-glass path', function (t) {
  // A malformed username cookie (special chars, too short, etc.) is
  // treated as "no username" by validateCredentials and falls through to
  // the break-glass branch. The session itself remains valid because the
  // token resolves correctly. Attribution-time injection is prevented
  // separately by getStaffIdentity, which returns 'admin' for any
  // non-USERNAME_RE-matching cookie value (covered below).
  //
  // Why split it this way: the legacy single-cookie session path needs
  // validateCredentials to accept token-only auth. Treating malformed
  // usernames as "tampered → reject" would also reject legacy sessions
  // mid-migration. The defence-in-depth lives at the attribution layer
  // where the actual identity-trust decision happens.
  const config = { adminUsers: { jamie: 'tok' } };
  t.equal(adminAuth.validateCredentials('jamie<script>', 'tok', config), 'jamie',
    'malformed username treated as missing → resolves token-owner');
  t.equal(adminAuth.validateCredentials('a', 'tok', config), 'jamie',
    'too-short username treated as missing → resolves token-owner');
  t.end();
});

test('validateCredentials: invalid token → returns null regardless of username', function (t) {
  const config = { adminUsers: { jamie: 'right-tok' } };
  t.equal(adminAuth.validateCredentials('jamie', 'wrong-tok', config), null);
  t.end();
});

// -----------------------------------------------------------------------
// validateAdminToken — Hapi-request boolean re-verifier
// -----------------------------------------------------------------------

test('validateAdminToken: valid cookie pair → true', function (t) {
  const config = { adminUsers: { jamie: 'tok' } };
  const request = { state: { adminUser: 'jamie', adminToken: 'tok' } };
  t.ok(adminAuth.validateAdminToken(request, config));
  t.end();
});

test('validateAdminToken: break-glass cookie (token only) → true', function (t) {
  const config = { adminToken: 'shared' };
  const request = { state: { adminToken: 'shared' } };
  t.ok(adminAuth.validateAdminToken(request, config));
  t.end();
});

test('validateAdminToken: invalid token → false', function (t) {
  const config = { adminToken: 'right' };
  const request = { state: { adminToken: 'wrong' } };
  t.notOk(adminAuth.validateAdminToken(request, config));
  t.end();
});

test('validateAdminToken: tampered username cookie → false', function (t) {
  const config = { adminUsers: { jamie: 'tok-jamie', alice: 'tok-alice' } };
  const request = { state: { adminUser: 'alice', adminToken: 'tok-jamie' } };
  t.notOk(adminAuth.validateAdminToken(request, config),
    'token belongs to jamie, cookie claims alice');
  t.end();
});

test('validateAdminToken: handles missing state / cookie', function (t) {
  const config = { adminToken: 'right' };
  t.notOk(adminAuth.validateAdminToken({}, config), 'no state');
  t.notOk(adminAuth.validateAdminToken({ state: {} }, config), 'no cookie');
  t.notOk(adminAuth.validateAdminToken({ state: { adminToken: '' } }, config), 'empty token');
  t.end();
});

// -----------------------------------------------------------------------
// getStaffIdentity — attribution helper
// -----------------------------------------------------------------------

test('getStaffIdentity: returns username cookie when valid', function (t) {
  const request = { state: { adminUser: 'jamie' } };
  t.equal(adminAuth.getStaffIdentity(request), 'jamie');
  t.end();
});

test('getStaffIdentity: returns "admin" when no username cookie set', function (t) {
  // Break-glass path attribution.
  t.equal(adminAuth.getStaffIdentity({}), 'admin', 'no state');
  t.equal(adminAuth.getStaffIdentity({ state: {} }), 'admin', 'no cookie');
  t.end();
});

test('getStaffIdentity: returns "admin" when username cookie is malformed', function (t) {
  // Defensive — never propagate a tampered username into note attribution.
  const request = { state: { adminUser: 'jamie<script>' } };
  t.equal(adminAuth.getStaffIdentity(request), 'admin');
  t.end();
});

// -----------------------------------------------------------------------
// USERNAME_RE — sanity coverage of the regex
// -----------------------------------------------------------------------

test('USERNAME_RE: accepts simple lowercase usernames', function (t) {
  t.ok(adminAuth.USERNAME_RE.test('jamie'));
  t.ok(adminAuth.USERNAME_RE.test('alice-bob'));
  t.ok(adminAuth.USERNAME_RE.test('user1'));
  t.end();
});

test('USERNAME_RE: rejects uppercase / specials / wrong length', function (t) {
  t.notOk(adminAuth.USERNAME_RE.test('Jamie'), 'uppercase');
  t.notOk(adminAuth.USERNAME_RE.test('a'), 'too short');
  t.notOk(adminAuth.USERNAME_RE.test('a'.repeat(31)), 'too long');
  t.notOk(adminAuth.USERNAME_RE.test('jamie@example'), 'special char');
  t.notOk(adminAuth.USERNAME_RE.test(''), 'empty');
  t.end();
});
