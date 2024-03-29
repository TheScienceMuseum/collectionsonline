
module.exports = function (config, ttl) {
  let h = { privacy: 'private' };
  if (config && config.NODE_ENV === 'production') {
    if (ttl > 0) {
      h = { privacy: 'public', expiresIn: ttl * 1000 };
    }
  }
  return h;
};
