const getNestedProperty = require('../nested-property');

module.exports = {
  getMadeDate (data) {
    return getNestedProperty(data, 'attributes.lifecycle.creation.0.date.0.value') || null;
  },

  getDisplayLocation (data) {
    var display;
    if (data.attributes.location) {
      data.attributes.location.forEach(loc => {
        if (loc.purpose === 'on display') {
          if (loc.locations) {
            loc.locations.forEach(el => {
              if (el.primary) {
                display = el.value;
              }
            });
          }
        }
      });
    }
    return display || null;
  },

  getDocumentLevel (item) {
    if (item.type === 'documents') {
      return getNestedProperty(item, 'attributes.level.value') === 'fonds' ? 'archive' : 'documents';
    }
  }
};
