// Unescapes the commas (ie. turns '\,' into ',')
// in order to match the exact terms in the database
module.exports = function unescapeCommas (el) {
  var filt = {
    terms: {}
  };
  if (el.terms && Array.isArray(el.terms[Object.keys(el.terms)[0]])) {
    filt.terms[Object.keys(el.terms)[0]] = el.terms[Object.keys(el.terms)[0]].map(el => {
      return el.replace(/\\,/g, ',');
    });
  } else {
    filt.terms = el.terms;
  }
  return filt;
};
