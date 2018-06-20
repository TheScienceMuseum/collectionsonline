module.exports = function () {
  var result = '';
  for (var i in arguments) {
    result += typeof arguments[i] === 'string' ? arguments[i] : '';
  }
  return result;
};
