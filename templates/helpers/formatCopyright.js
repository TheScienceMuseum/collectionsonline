module.exports = function (string) {
  // removes the opening © from the string, because we're showing that to the left anyway
  if (string?.startsWith('©')) {
    return string.slice(1);
  }
  return string;
};
