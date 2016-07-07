var QueryString = require('querystring');
var convertUrl = require('../lib/convert-url.js');

module.exports = (e, ctx, q) => {
  var name = e.target.name;
  var value = e.target.value;
  var qs = QueryString.parse(convertUrl(ctx.querystring, 'json'));
  qs.q = q;

  if (qs[name]) {
    var i = qs[name].indexOf(value);
    if (i > -1) {
      if (qs[name][i - 1] === ',') {
        qs[name] = qs[name].substring(0, i - 1) + qs[name].substring(i + value.length);
      } else {
        qs[name] = qs[name].substring(0, i) + qs[name].substring(i + value.length);
      }
    } else {
      qs[name] += ',' + value;
    }
  } else {
    qs[name] = value;
  }

  if (qs[name] && qs[name][0] === ',') {
    qs[name] = qs[name].substr(1);
  }

  if (!qs[name].length) {
    delete qs[name];
  }

  return qs;
};
