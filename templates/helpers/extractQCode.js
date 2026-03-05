module.exports = function (url) {
  if (!url || typeof url !== 'string') return '';
  const m = url.match(/\/(Q\d+)$/);
  return m ? m[1] : '';
};
