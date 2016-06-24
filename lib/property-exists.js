module.exports = function checkNestedProperty (obj, pathString) {
  var path = pathString.split('.');

  var property = path.reduce((prev, curr) => {
    if (prev[curr]) {
      return prev[curr];
    } else {
      return false;
    }
  }, obj);

  return property;
};
