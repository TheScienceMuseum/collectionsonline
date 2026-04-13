'use strict';

const crypto = require('crypto');

function isValidToken (token, config) {
  const expected = config.adminToken || config.cacheClearToken;
  if (!expected || !token) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(token)),
      Buffer.from(String(expected))
    );
  } catch (_) {
    return false;
  }
}

function validateAdminToken (request, config) {
  const cookie = request.state && request.state.adminToken;
  if (cookie && isValidToken(cookie, config)) {
    return true;
  }
  return false;
}

function setAdminCookie (h, token, isProduction) {
  return h.state('adminToken', token, {
    ttl: 24 * 60 * 60 * 1000,
    isSecure: isProduction,
    isHttpOnly: true,
    isSameSite: 'Strict',
    path: '/admin'
  });
}

module.exports = {
  isValidToken,
  validateAdminToken,
  setAdminCookie
};
