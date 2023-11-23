/**
* Split a string on unescaped commas (',' as opposed to '\,')
* The normal 'string.split' function cannot be used here, as javascript regexes do not have a
* 'lookback' function, so there is no easy way to differentiate between a comma preceded by a
* backslash, and a normal comma
* @param {string} str - string to split into an array
**/
module.exports = function splitOnUnescapedCommas (str) {
  let splitResult = [];
  for (let i = 0; i < str.length; i++) {
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
  // trim the values except the first one where we want to keep the spaces see #524
  splitResult = splitResult.map(function (val, i) {
    return i !== 0 ? val.trim() : val;
  });
  return splitResult;
};
