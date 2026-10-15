'use strict';

const crypto = require('crypto');

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

module.exports = safeEquals;
