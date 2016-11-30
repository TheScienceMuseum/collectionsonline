var normaliseName = require('./normalise.js');

module.exports = function (name, obj) {
  var value = normaliseName(name, obj);

  if (!value) {
    return '';
  }

  return value.length < 42 ? value : value.slice(0, 42) + '...';
};
