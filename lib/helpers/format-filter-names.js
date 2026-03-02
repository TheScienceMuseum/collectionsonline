const path = require('path');
const fs = require('fs');
const dashToSpace = require('./dash-to-space');
const mappings = JSON.parse(
  fs.readFileSync(path.join(__dirname, '/../../fixtures/dashed-filter-mappings.json'))
);

module.exports = function formatFilterNames (filterType, values) {
  if (!Array.isArray(values)) return values;
  const typeMap = mappings[filterType] || {};
  return values.map(function (v) {
    return typeMap[dashToSpace(v.toLowerCase())] || v;
  });
};
