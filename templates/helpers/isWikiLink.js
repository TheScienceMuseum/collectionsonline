module.exports = (value) => {
  if (typeof value === 'string' && value.startsWith('http')) {
    return true;
  }
  return false;
};
