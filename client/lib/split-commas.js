module.exports = function splitOnUnescapedCommas (str) {
  var splitResult = [];
  for (var i = 0; i < str.length; i++) {
    if (str[i] === ',') {
      if (str[i - 1] !== '\\') {
        splitResult.push(str.substr(0, i));
        str = str.substr(i + 1);
        i = -1;
      }
    } else if (i === str.length - 1) {
      splitResult.push(str.substr(0, i + 1));
    }
  }
  return splitResult;
};
