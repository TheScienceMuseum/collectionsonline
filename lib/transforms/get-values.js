const getNestedProperty = require('../nested-property');
const getPrimaryValue = require('../get-primary-value');
const makersList = require('../../fixtures/makers');

module.exports = {
  getMadeDate (data) {
    return getNestedProperty(data, 'attributes.lifecycle.creation.0.date.0.value') || null;
  },

  getDisplayLocation (data) {
    var display = {};
    var locations = getNestedProperty(data, 'attributes.locations.0.name');
    if (locations) {
      locations.forEach(loc => {
        if (loc.type === 'gallery') {
          display.gallery = loc.value;
        } else if (loc.type === 'museum') {
          display.museum = loc.value;
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
    if (item.type === 'people') {
      var name;
      if (item.attributes.name) {
        name = item.attributes.name.find(el => el.type === 'preferred name') ||
        item.attributes.name[0];
        return name.value;
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

  getBorn (data, links) {
    var key;
    if (this.isOrganisation(data)) {
      key = 'based';
    } else {
      key = 'born in';
    }
    var value = getNestedProperty(data, 'attributes.lifecycle.birth.0.location.name.0.value');
    var linkVal = links ? links.root + '/search/people?filter[birth[place]]=' + encodeURIComponent(value) : null;
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
    var values;
    if (this.isOrganisation(data)) {
      key = 'industry';
    } else {
      key = 'occupation';
    }
    var rawValue = getNestedProperty(data, 'attributes.occupation')[0];
    if (rawValue && rawValue.indexOf(';')) {
      values = rawValue.split(';').map((el, i, arr) => {
        el = el.trim();
        var val = el[0].toUpperCase() + el.substr(1);
        if (i < arr.length - 1) {
          val += ',';
        }
        return {
          value: val,
          link: links ? links.root + '/search?occupation=' + encodeURIComponent(el) : null
        };
      });
    }
    return values ? {key: key, value: values} : null;
  },

  getNationality (data) {
    var value = getNestedProperty(data, 'attributes.nationality.0');
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
          if (makersList.indexOf(key) === -1) {
            key = 'maker';
          }
          makers.push((key && value && value.toLowerCase().indexOf('unknown') === -1) ? {key: key, value: value, link: link} : null);
        }
      });
    }
    if (getNestedProperty(resource, 'data.attributes.lifecycle.creation.0.maker')) {
      resource.data.attributes.lifecycle.creation[0].maker.forEach(el => {
        if (el['@link'].type === 'literal') {
          key = 'maker';
          value = getPrimaryValue(el.name);
          makers.push((key && value) ? {key: key, value: value} : null);
        }
      });
    }
    return makers.filter(Boolean);
  },

  getSystem (data) {
    var value = null;
    if (data.attributes.admin) {
      value = this.getSystemName(data.attributes.admin.source);
    }
    return {key: 'system', value: value};
  },

  getSystemName (source) {
    const systemNames = {
      smgc: 'Mimsy',
      smga: 'AdLib'
    };

    return systemNames[source];
  }
};
