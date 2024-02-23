const getPrimaryValue = require('../../get-primary-value');
const truncate = require('./truncate.js');

// transforms filter UID into title for use in pillbox - more human readable than UID
module.exports = function (selectedFilters, mphcParent) {
  return Object.keys(selectedFilters.mphc || {}).map((filterId) => {
    if (filterId === mphcParent._source?.['@admin']?.uid) {
      const title = mphcParent
        ? getPrimaryValue(mphcParent._source.title)
        : null;

      return truncate(title, 40);
    }
    return null;
  });
};
