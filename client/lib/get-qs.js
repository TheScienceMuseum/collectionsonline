var QueryString = require('querystring');

var paramify = require('../../lib/helpers/paramify.js');

module.exports = function (pageType) {
  /**
  * select all the input checkbox checked, all the other input but not the checkbox (already selected) and not fields[type] already on url
  */
  var queryParamsValues = document.querySelectorAll('#search-form input:checked, #search-form input:not([type="checkbox"]):not([name="fields[type]"]):not([name="page[type]"])');
  var params = {};
  for (var i = 0; i < queryParamsValues.length; i++) {
    if (queryParamsValues[i].value && !params[queryParamsValues[i].name]) {
      params[queryParamsValues[i].name] = [queryParamsValues[i].value];
    } else if (params[queryParamsValues[i].name]) {
      params[queryParamsValues[i].name].push(queryParamsValues[i].value);
    }
  }
  // select result per page
  var rpp = document.querySelector('.control--rpp select') ? document.querySelector('.control--rpp select').value : 50;
  return paramify(params) + '?page[size]=' + rpp;
};
