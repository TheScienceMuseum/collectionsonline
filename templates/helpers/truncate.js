module.exports = function (name) {
  if (!name) {
    return '';
  }

  return name.length < 42 ? name : name.slice(0, 42) + '...';
};
