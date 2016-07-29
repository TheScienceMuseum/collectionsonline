/**
* Fetch request to get a person, an object or a document
*/
var fetch = require('fetch-ponyfill')();
var JSONToHTML = require('../../lib/transforms/json-to-html-data');

module.exports = function (url, opts, cb) {
  fetch(url, opts)
  .then(function (res) {
    if (res.ok) {
      return res.json();
    } else {
      return Promise.reject(new Error(res.status + ' Failed to fetch results'));
    }
  })
  .then(function (json) {
    if (json.errors) return Promise.reject(json.errors[0]);
    var data = JSONToHTML(json);
    return cb(data);
  })
  .catch(function (err) {
    console.error('Failed to find the item', err);
  });
};
