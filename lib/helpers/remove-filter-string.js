module.exports = function removeFilterString (str) {
  const filterReg = /filter\[(.+)]/g;
  const match = filterReg.exec(str);

  if (match) {
    return match[1];
  }
  return str;
};
