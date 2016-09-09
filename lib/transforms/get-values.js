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
        return this.normaliseName(name.value);
      }
    }
    return getPrimaryValue(item.attributes.title) || item.attributes.summary_title;
  },

  getDate (item) {
    if (item.type === 'objects' || item.type === 'documents') {
      return this.getMadeDate(item);
    }

    var birth = this.getBirthDate(item);
    var death = this.getDeathDate(item);

    if (birth && death) {
      return birth + ' - ' + death;
    } else if (!death) {
      return birth;
    } else {
      return 'Unknown - ' + death;
    }
  },

  getBirthDate (item) {
    return getNestedProperty(item, 'attributes.lifecycle.birth.0.date.0.latest') || null;
  },

  getDeathDate (item) {
    return getNestedProperty(item, 'attributes.lifecycle.death.0.date.0.latest') || null;
  },

  normaliseName (name) {
    if (name.indexOf(',') === -1) {
      return name;
    } else {
      var splitName = name.split(',');
      return splitName[1] + ' ' + splitName[0];
    }
  },

  getBorn (data, links) {
    var key;
    if (this.isOrganisation(data)) {
      key = 'based';
    } else {
      key = 'born in';
    }
    var value = getNestedProperty(data, 'attributes.lifecycle.birth.0.location.name.0.value');
    var linkVal = links ? links.root + '/search?birth[place]=' + encodeURIComponent(value) : null;
    return value ? {key: key, value: value, link: linkVal} : null;
  },

  isOrganisation (data) {
    return getNestedProperty(data, 'attributes.type.sub_type.0') === 'organisation';
  },

  isPerson (data) {
    return getNestedProperty(data, 'attributes.type.sub_type.0') === 'person';
  },

  getOccupation (data, links) {
    var key;
    var value;
    if (this.isOrganisation(data)) {
      key = 'industry';
    } else {
      key = 'occupation';
    }
    var rawValue = getNestedProperty(data, 'attributes.occupation');
    if (rawValue && rawValue.indexOf(';')) {
      value = rawValue.split(';').map(el => {
        el = el.trim();
        return el[0].toUpperCase() + el.substr(1);
      }).join(', ');
    }
    var linkVal = links ? links.root + '/search?occupation=' + encodeURIComponent(rawValue) : null;
    return value ? {key: key, value: value, link: linkVal} : null;
  },

  getNationality (data) {
    var value = getNestedProperty(data, 'attributes.nationality');
    return value ? {key: 'Nationality', value: value} : null;
  },

  getMakers (resource) {
    var makers = [];
    var value;
    var key;
    var link;
    if (resource.included) {
      resource.included.forEach(el => {
        if (getNestedProperty(el, 'attributes.role.type') === 'maker') {
          key = getNestedProperty(el, 'attributes.role.value') || getNestedProperty(el, 'attributes.role.type');
          value = getNestedProperty(el, 'attributes.summary_title') || null;
          link = getNestedProperty(el, 'links.self');
          makers.push((key && value) ? {key: key, value: value, link: link} : null);
        }
      });
    }
    return makers.filter(Boolean);
  }
};
