module.exports = (arr, index, size) => {
  if (!['large', 'medium', 'card', 'thumb'].includes(size)) { size = 'large'; }
  return arr[index][size];
};
