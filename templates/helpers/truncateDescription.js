const normaliseName = require('./normalise.js');

module.exports = (name, obj) => {
  const value = normaliseName(name, obj);

  if (!value) {
    return '';
  }

  return value.length < 400 ? value : value.slice(0, 400) + '...';
};
