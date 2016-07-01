const getNestedProperty = require('../nested-property');
const getPrimaryValue = require('../get-primary-value');

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
  },

  getTitle (item) {
    return getPrimaryValue(item.attributes.title) || item.attributes.summary_title;
  },

  getDate (item) {
    if (item.type === 'objects' || item.type === 'documents') {
      return this.getMadeDate(item);
    }

    const birth = getNestedProperty(item, 'attributes.lifecycle.birth.0.date.0.latest') || null;
    const death = getNestedProperty(item, 'attributes.lifecycle.death.0.date.0.latest') || null;

    if (birth && death) {
      return birth + ' - ' + death;
    } else if (!death) {
      return birth;
    } else {
      return 'Unknown - ' + death;
    }
  }
};
