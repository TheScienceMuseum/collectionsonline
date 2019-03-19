module.exports = function (decoded, request) {
  return { isValid: decoded.valid === true && decoded };
};
