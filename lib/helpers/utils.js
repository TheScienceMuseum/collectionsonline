module.exports = {
  uppercaseFirstChar: function (filter) {
    var res = filter;
    if (typeof filter === 'string') {
      res = upperChar(filter);
    } else if (Array.isArray(filter)) {
      res = filter.map(upperChar);
    }
    return res;
  }
};

function upperChar (str) {
  var exclude = ['and'];
  if (!str) return false;
  return decodeURIComponent(str).split(/[\s-]/g).map(e => {
    if (exclude.indexOf(e) === -1 && e !== '') {
      return e[0].toUpperCase() + e.substring(1);
    } else {
      return e;
    }
  }).join(' ');
}
