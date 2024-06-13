const getPrimaryValue = require('../../get-primary-value');
const truncate = require('./truncate.js');

module.exports = function (selectedFilters, mphcParent) {
  // exclude anything not mph type
  if (
    !mphcParent?._source?.['@datatype'] ||
    mphcParent?._source?.['@datatype'].grouping !== 'MPH'
  ) {
    return [];
  }
  // configure filter
  const mphcFilters = Object.keys(selectedFilters.mphc || {})
    .map((filterId) => {
      if (filterId === mphcParent?._source?.['@admin']?.uid) {
        const title = mphcParent
          ? getPrimaryValue(mphcParent?._source.title)
          : null;

        return truncate(title, 40);
      }
      return null;
    })
    .filter(Boolean); // filter out null values

  return mphcFilters;
};
