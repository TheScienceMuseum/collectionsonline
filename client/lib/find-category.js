module.exports = function findCategory (path) {
  var categoryRegex = /(objects|people|documents)/g;
  var match = categoryRegex.exec(path);
  if (match) {
    return match[1];
  }
}
