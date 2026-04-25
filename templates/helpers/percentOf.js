// Returns (value / total * 100) as a rounded integer, suitable for inline
// `width: X%` or `height: X%` styles. Guards against zero / non-numeric
// totals so a bar row involving an empty bucket renders as 0% (a hairline
// stub) rather than NaN or Infinity.
module.exports = function (value, total) {
  const v = Number(value) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.round((v / t) * 100);
};
