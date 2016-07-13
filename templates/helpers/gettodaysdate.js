module.exports = function () {
  var options = { day: 'numeric', month: 'long', year: 'numeric' };
  return new Date().toLocaleDateString('en-GB', options);
};
