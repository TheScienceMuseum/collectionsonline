module.exports = function getNestedProperty (obj, pathString) {
  const path = pathString.split('.');
  let current = obj;

  for (let i = 0; i < path.length; i++) {
    if (current[path[i]]) {
      current = current[path[i]];
    } else {
      return false;
    }
  }

  return current;
};
