module.exports = function () {
  return Array.prototype.slice
    .call(arguments, 0, arguments.length - 1)
    .some(Boolean);
};
