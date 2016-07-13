// Unescapes the commas (ie. turns '\,' into ',')
// in order to match the exact terms in the database
// el can be { terms: { 'occupation': ['occupationValue'] } }
// el can also be { range: { 'lifecycle.birth.date.earliest': { 'gte': 1800 } } }
module.exports = function unescapeCommas (el) {
  var filt = {
    terms: {}
  };
  // terms filter
  if (el.terms) {
    if (Array.isArray(el.terms[Object.keys(el.terms)[0]])) {
      filt.terms[Object.keys(el.terms)[0]] = el.terms[Object.keys(el.terms)[0]].map(el => {
        return el.replace(/\\,/g, ',');
      });
    } else {
      filt.terms = el.terms;
    }
  }
  // range filter
  if (el.range) {
    filt = el;
  }

  return filt;
};
