function getFirst (arr) {
  if (!arr[0]) {
    return null;
  }
  return arr[0].type !== 'note'
       ? arr[0].value
       : ((arr[1] || {}).value || null);
}

module.exports = getFirst;
