module.exports = function (type, facts) {
  var result = {};
  // Level1 - type
  result['Level1'] = null;
  result['Level2'] = null;
  result['Level3'] = null;
  result['Level4'] = null;
  facts.forEach(function (data) {
    // PEOPLE
    if (type === 'people') {
      result['Level1'] = 'people';

      if (data.key === 'occupation') {
        result['Level2'] = data.value.map(function (o) {
          return o.value.replace(',', ''); // delete comma added for display on view
        });
      }

      if (data.key === 'Nationality') {
        result['Level3'] = data.value;
      }

      if (data.key === 'born in') {
        result['Level4'] = data.value;
      }
    }

    // OBJECTS
    if (type === 'objects') {
      result['Level1'] = 'objects';

      if (data.key === 'Category') {
        result['Level2'] = data.value;
      }

      if (data.key === 'type') {
        result['Level3'] = data.value.map(function (type) {
          return type.value;
        });
      }

      if (data.key === 'taxonomy') {
        result['Level4'] = data.value.map(function (t) {
          return t.value;
        });
      }
    }

    // DOCUMENTS
    if (type === 'documents') {
      result['Level1'] = 'documents';

      if (data.key === 'part of archive') {
        result['Level2'] = data.value;
      }

      if (data.key === 'maker') {
        result['Level3'] = data.value;
      }

      if (data.key === 'Made') {
        result['Level4'] = data.date.value;
      }
    }
  });

  return JSON.stringify(result);
};
