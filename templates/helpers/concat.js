module.exports = function () {
  let result = '';
  for (const i in arguments) {
    result += typeof arguments[i] === 'string' ? arguments[i] : '';
  }
  return result;
};
