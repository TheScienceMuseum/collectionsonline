module.exports = function getPrimaryValue (array) {
  if (Object.prototype.toString.call(array) === '[object String]') {
    return array;
  }

  if (!Array.isArray(array) || !array.length) {
    return null;
  }

  const primary = array.find((d) => d.primary);
  return primary ? primary.value : array[0].value;
};
