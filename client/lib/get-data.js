var fetch = require('fetch-ponyfill')();
// var searchResultsToTemplateData = require('../../lib/transforms/search-results-to-template-data');

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
      return cb(null, json);
    })
    .catch(function (err) {
      // redirect to the login page if not authorized
      if (err.message === '401 Failed to fetch results') {
        window.location = '/login';
      } else {
        return cb(err);
      }
    });
};
