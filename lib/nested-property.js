module.exports = function getNestedProperty (obj, pathString) {
  const path = pathString.split('.');
  var current = obj;

  for (var i = 0; i < path.length; i++) {
    if (current[path[i]]) {
      current = current[path[i]];
    } else {
      return false;
    }
  }

  return current;
};
