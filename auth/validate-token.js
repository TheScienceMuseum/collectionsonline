module.exports = function (decoded, request, callback) {
  console.log('decoded', decoded);
  if (decoded.valid === true) {
    return callback(null, true, decoded);
  } else {
    return callback(null, false);
  }
};
