/**
* Escape comma and join the values of a queryParam object
* "hello, there" -> "hello\, there" -> "hello%2C%20there"
*/
module.exports = function (object) {
  Object.keys(object).forEach(function (key) {
    if (Array.isArray(object[key])) {
      object[key].forEach(function (value, index) {
        object[key][index] = object[key][index].replace(/,/g, '\\,');
      });
      object[key] = object[key].join();
    } else {
      object[key] = object[key].replace(/,/g, '\\,');
    }
  });
};
