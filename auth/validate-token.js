module.exports = function (decoded, request, callback) {
  if (decoded.valid === true) {
    return callback(null, true, decoded);
  } else {
    return callback(null, false);
  }
};
