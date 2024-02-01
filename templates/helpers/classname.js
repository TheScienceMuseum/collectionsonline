module.exports = (className) => {
  if (!className) {
    return;
  }
  return className.split(' ').join('-');
};
