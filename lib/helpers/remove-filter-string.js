module.exports = function removeFilterString (str) {
  var filterReg = /filter\[(.+)\]/g;
  var match = filterReg.exec(str);

  if (match) {
    return match[1];
  }
  return str;
};
