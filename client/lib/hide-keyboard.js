// To hide keyboard on Safari (iOS)
module.exports = function hideKeyboard () {
  if (document.activeElement) {
    document.activeElement.blur();
  }
  Array.prototype.slice.call(document.querySelectorAll('input')).forEach(function (e) {
    e.blur();
  });
};
