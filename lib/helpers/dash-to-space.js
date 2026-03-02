module.exports = function dashToSpace (str) {
  return str
    .replace(/---/g, ' - ')
    .replace(/(?<!\s)-(?!\s)/g, ' ');
};
