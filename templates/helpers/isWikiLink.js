module.exports = (value) => {
  if (value.startsWith('http')) {
    return true;
  }
  return false;
};
