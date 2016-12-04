module.exports = function (type, facts) {
  var result = {};
  // Level1 - type
  result['Level1'] = null;
  result['Level2'] = null;
  result['Level3'] = null;
  result['Level4'] = null;
  facts.forEach(function (fact) {
    if (type === 'people') {
      result['Level1'] = 'people';

      if (fact.key === 'occupation') {
        result['Level2'] = fact.value.map(function (o) {
          return o.value.replace(',', ''); // delete comma added for display on view
        });
      }

      if (fact.key === 'Nationality') {
        result['Level3'] = fact.value;
      }

      if (fact.key === 'born in') {
        result['Level4'] = fact.value;
      }
    }
  });

  return JSON.stringify(result);
};
