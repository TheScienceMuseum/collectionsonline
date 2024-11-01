module.exports = (value) => {
  console.log('the value');
  if (typeof value === 'string' && value.includes('viaf')) {
    return true;
  }
  return true;
};
