module.exports = {
  uppercaseFirstChar: function (filter) {
    let res = filter;
    if (typeof filter === 'string') {
      res = upperChar(filter);
      res = (res.toString().startsWith('Bbc')) ? res = 'BBC Heritage Collection' : res;
    } else if (Array.isArray(filter)) {
      res = filter.map(upperChar);
    }
    return res;
  }
};

function upperChar (str) {
  const exclude = ['and'];
  if (!str) return false;
  return decodeURIComponent(str).split(/[\s-]/g).map(e => {
    if (exclude.indexOf(e) === -1 && e !== '') {
      return e[0].toUpperCase() + e.substring(1);
    } else {
      return e;
    }
  }).join(' ');
}
