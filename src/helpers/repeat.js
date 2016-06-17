module.exports = function(count, context) {
  var str = '';

  for (var i = 0; i < count; i++) {
    str += context.fn(this);
  }

  return str;
}
