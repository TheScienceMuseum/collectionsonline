'use strict';

// Tests for the auth-error circuit breaker in scripts/bulk-generate.js.
// Just the pattern-matching helper — the full circuit needs a live
// runWithConcurrency + mocked DDB, which is out of scope here.

const test = require('tape');
const bulk = require('../scripts/bulk-generate');

test('looksLikeAuthError: matches real AWS auth-shaped messages', function (t) {
  t.ok(bulk.looksLikeAuthError('Could not load credentials from any providers'),
    'the exact string that triggered the 2026-08-04 workshop-prep incident');
  t.ok(bulk.looksLikeAuthError('The security token included in the request is invalid.'),
    'expired session token');
  t.ok(bulk.looksLikeAuthError('User: arn:aws:iam::... is not authorized (AccessDenied)'),
    'IAM AccessDenied');
  t.ok(bulk.looksLikeAuthError('UnrecognizedClientException: bad key'),
    'unrecognized client');
  t.ok(bulk.looksLikeAuthError('ExpiredTokenException: session lapsed'),
    'expired-token variant');
  t.ok(bulk.looksLikeAuthError('InvalidClientTokenId'),
    'invalid client id');
  t.ok(bulk.looksLikeAuthError('SignatureDoesNotMatch: check your secret'),
    'signature mismatch');
  t.end();
});

test('looksLikeAuthError: does not match transient/subject-specific errors', function (t) {
  t.notOk(bulk.looksLikeAuthError('Request rate exceeded'),
    'throttling is transient, not auth');
  t.notOk(bulk.looksLikeAuthError('Item not found'),
    'a plain miss shouldn\'t trip the breaker');
  t.notOk(bulk.looksLikeAuthError('ECONNRESET'),
    'network blip');
  t.notOk(bulk.looksLikeAuthError('Generation returned null (parse_failed)'),
    'writer parse failure is subject-specific');
  t.notOk(bulk.looksLikeAuthError(''),
    'empty string');
  t.notOk(bulk.looksLikeAuthError(null),
    'null');
  t.notOk(bulk.looksLikeAuthError(undefined),
    'undefined');
  t.end();
});

test('AUTH_ABORT_THRESHOLD: sane value', function (t) {
  t.equal(typeof bulk.AUTH_ABORT_THRESHOLD, 'number', 'is a number');
  t.ok(bulk.AUTH_ABORT_THRESHOLD >= 2 && bulk.AUTH_ABORT_THRESHOLD <= 5,
    'threshold is small (2–5) so we abort quickly on systemic failures');
  t.end();
});
