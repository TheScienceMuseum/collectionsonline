const ponyfillFetch = require('fetch-ponyfill')().fetch;

// Use the AWS WAF Application Integration SDK's fetch wrapper when available.
// It catches 202 Challenge responses from WAF, solves the silent PoW, refreshes
// the aws-waf-token cookie, and retries the request transparently. Falls back
// to the ponyfill in test environments where the SDK global isn't present.
function wafAwareFetch (url, opts) {
  if (typeof window !== 'undefined' && window.AwsWafIntegration && typeof window.AwsWafIntegration.fetch === 'function') {
    return window.AwsWafIntegration.fetch(url, opts);
  }
  return ponyfillFetch(url, opts);
}

module.exports = function (url, opts, cb) {
  wafAwareFetch(url, opts)
    .then(function (res) {
      if (res.ok) {
        return res.json();
      } else {
        return Promise.reject(
          new Error(res.status + ' Failed to fetch results')
        );
      }
    })
    .then(function (json) {
      if (json.errors) {
        return Promise.reject(json.errors[0]);
      }
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
