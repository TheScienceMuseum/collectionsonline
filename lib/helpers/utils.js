module.exports = {
  uppercaseFirstChar: function (str) {
    var exclude = ['and'];

    if (!str) return false;
    return decodeURIComponent(str).split(' ').map(e => {
      if (exclude.indexOf(e) === -1) {
        return e[0].toUpperCase() + e.substring(1);
      } else {
        return e;
      }
    }).join(' ');
  }
};
