module.exports = {
  uppercaseFirstChar: function (str) {
    if (!str) return false;
    return decodeURIComponent(str).split(' ').map(e => e[0].toUpperCase() + e.substring(1)).join(' ');
  }
};
