module.exports = function (type, facts) {
  const result = {};
  // Level1 - type
  facts.forEach(function (data) {
    // PEOPLE
    if (type === 'people') {
      result.recordType = 'people';

      if (data.key === 'occupation') {
        result.recordOccupation = data.value.map(function (o) {
          return o.value.replace(',', ''); // delete comma added for display on view
        });
      }

      if (data.key === 'Nationality') {
        result.recordNationality = data.value;
      }

      if (data.key === 'born in') {
        result.recordBorn = data.value;
      }
    }

    // OBJECTS
    if (type === 'objects') {
      result.recordType = 'objects';

      if (data.key === 'Category') {
        result.recordCategory = data.value;
      }

      if (data.key === 'Collection') {
        result.recordCollection = data.value;
      }

      if (data.key === 'Display Location') {
        result.recordDisplayLocation = data.value;
      }

      if (data.key === 'type') {
        result.recordObjectType = data.value.map(function (type) {
          return type.value;
        });
      }

      if (data.key === 'taxonomy') {
        result.recordTaxonomy = data.value.map(function (t) {
          return t.value;
        });
      }
    }

    // DOCUMENTS
    if (type === 'documents') {
      result.recordType = 'documents';

      if (data.key === 'part of archive') {
        result.recordArchive = data.value;
      }

      if (data.key === 'maker') {
        result.recordMaker = data.value;
      }

      if (data.key === 'Made') {
        result.recordMade = data.date.value;
      }
    }
  });

  return JSON.stringify(result);
};
