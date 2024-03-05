module.exports = function findCategory(path) {
  const categoryRegex = /(objects|people|documents|group)/g;
  const match = categoryRegex.exec(path);
  if (match) {
    return match[1];
  }
};
