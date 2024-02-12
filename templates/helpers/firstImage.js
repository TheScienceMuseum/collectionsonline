module.exports = (arr, index, size) => {
  if (!['large', 'medium', 'card', 'thumb'].includes(size)) { size = 'medium'; }
  return arr[index][size];
};
