const getNestedProperty = require('../nested-property');
const getPrimaryValue = require('../get-primary-value');

module.exports = {
  getMadeDate (data) {
    return getNestedProperty(data, 'attributes.lifecycle.creation.0.date.0.value') || null;
  },

  getDisplayLocation (data) {
    var display;
    // TODO: Put back in if/when location is added back to the index
    //
    // if (data.attributes.location) {
    //   data.attributes.location.forEach(loc => {
    //     if (loc.purpose === 'on display') {
    //       if (loc.locations) {
    //         loc.locations.forEach(el => {
    //           if (el.primary) {
    //             display = el.value;
    //           }
    //         });
    //       }
    //     }
    //   });
    // }
    return display || null;
  },

  getDocumentLevel (item) {
    if (item.type === 'documents') {
      return getNestedProperty(item, 'attributes.level.value') === 'fonds' ? 'archive' : 'documents';
    }
  },

  getTitle (item) {
    if (item.type === 'people') {
      var name;
      if (item.attributes.name) {
        name = item.attributes.name.find(el => el.type === 'natural order') ||
        item.attributes.name.find(el => el.type === 'preferred name') ||
        item.attributes.name[0];
        return getNestedProperty(item, 'attributes.admin.source') === 'smgc' ? this.normaliseName(name.value) : name.value;
      }
    }
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
  },

  normaliseName (name) {
    if (name.indexOf(',') === -1) {
      return name;
    } else {
      var splitName = name.split(',');
      return splitName[1] + ' ' + splitName[0];
    }
  }
};
