const crypto = require('crypto');

// Adds Vary: Accept, ETag (weak), and Last-Modified to a Hapi response.
// `variant` should differ between HTML and JSON renders of the same record so
// the two never share an ETag. `payload` is hashed for the ETag; pass either
// the serialised body string or the underlying data object. `lastModified` is
// optional and accepts anything `new Date()` understands (ms since epoch, ISO
// string, Date instance).
//
// Hapi's `.etag()` returns 304 automatically when `If-None-Match` matches.
module.exports = function (response, { variant, payload, lastModified }) {
  const hash = crypto.createHash('sha1');
  hash.update(variant + ':');
  hash.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const etag = hash.digest('hex');

  response.vary('Accept').etag(etag, { weak: true });

  if (lastModified) {
    const date = lastModified instanceof Date ? lastModified : new Date(lastModified);
    if (!isNaN(date.getTime())) {
      response.header('last-modified', date.toUTCString());
    }
  }

  return response;
};
