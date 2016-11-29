var normaliseName = require('./normalise.js');

module.exports = function (name, obj) {
  var value = normaliseName(name, obj);

  if (!value) {
    return '';
  }

  return value.slice(0, 42) + '...';
};
