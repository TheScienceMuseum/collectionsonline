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
      // var data = searchResultsToTemplateData(queryParams, json);
      // return cb(data);
      return cb(json);
    })
    .catch(function (err) {
      console.error('Failed to search', err);
      // redirect to the login page if not authorized
      if (err === '401 Failed to fetch results') {
        window.location = '/login';
      }
    });
};
