const getNestedProperty = require('../nested-property');
const getPrimaryValue = require('../get-primary-value');
const makersList = require('../../fixtures/makers');

module.exports = {
  getMadeDate (data) {
    const dateValue = getNestedProperty(data, 'attributes.lifecycle.creation.0.date.0.value');
    const earliestDate = getNestedProperty(data, 'attributes.lifecycle.creation.0.date.0.earliest');
    const latestDate = getNestedProperty(data, 'attributes.lifecycle.creation.0.date.0.latest');

    if (dateValue) {
      return dateValue;
    } else if (earliestDate && latestDate) {
      return earliestDate + '-' + latestDate;
    }

    return earliestDate || latestDate || null;
  },

  getModifiedDate (data) {
    return new Date(getNestedProperty(data, 'attributes.admin.modified'));
  },
  getCreatedDate (data) {
    return new Date(getNestedProperty(data, 'attributes.admin.created'));
  },

  getDisplayLocation (data) {
    const display = {};
    const locations = getNestedProperty(data, 'attributes.locations.0.name');
    const filters = [];
    if (locations) {
      locations.forEach(loc => {
        if (loc.type === 'gallery' || loc.type === 'museum') {
          let displayValue = loc.value;
          if (displayValue === 'National Media Museum') displayValue = 'National Science and Media Museum';
          if (displayValue === 'Museum of Science and Industry') displayValue = 'Science and Industry Museum';
          display[loc.type] = displayValue;
          filters.push(loc.type + '/' + encodeURIComponent(loc.value));
        }
      });
      display.link = '/search/' + this.formatLink(filters.join('/'));
    }
    return display.museum ? display : null;
  },

  getDocumentLevel (item) {
    if (item.type === 'documents') {
      return getNestedProperty(item, 'attributes.level.value') === 'fonds' ? 'archive' : 'documents';
    }
  },

  getTitle (item) {
    if (item.type === 'people') {
      let name;
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

    const birth = this.getBirthDate(item);
    const death = this.getDeathDate(item);

    if (birth && death) {
      return birth + ' - ' + death;
    } else if (!death) {
      return birth;
    } else {
      return 'Unknown - ' + death;
    }
  },

  getBirthDate (item) {
    const latestYearExtracted = getNestedProperty(item, 'attributes.lifecycle.birth.0.date.0.latest') || null;
    const birthDateFreetext = getNestedProperty(item, 'attributes.lifecycle.birth.0.date.0.value') || null;
    if (birthDateFreetext) {
      if (birthDateFreetext.indexOf('BC') > -1 || birthDateFreetext.indexOf('BCE') > -1 || birthDateFreetext.indexOf('CE') > -1) {
        return birthDateFreetext;
      }
    }
    return latestYearExtracted;
  },

  getDeathDate (item) {
    const latestYearExtracted = getNestedProperty(item, 'attributes.lifecycle.death.0.date.0.latest') || null;
    const deathDateFreetext = getNestedProperty(item, 'attributes.lifecycle.death.0.date.0.value') || null;
    if (deathDateFreetext) {
      if (deathDateFreetext.indexOf('BC') > -1 || deathDateFreetext.indexOf('BCE') > -1 || deathDateFreetext.indexOf('CE') > -1) {
        return deathDateFreetext;
      }
    }
    return latestYearExtracted;
  },

  getBorn (data, links) {
    let key;
    if (this.isOrganisation(data)) {
      key = 'based';
    } else {
      key = 'born in';
    }
    const value = getNestedProperty(data, 'attributes.lifecycle.birth.0.location.name.0.value');
    let linkVal = links ? links.root + '/search/people/birth[place]/' + encodeURIComponent(value) : null;
    linkVal = this.getSystem(data).value === 'Mimsy' ? null : linkVal;
    return value ? { key, value, link: linkVal } : null;
  },

  isOrganisation (data) {
    return getNestedProperty(data, 'attributes.type.sub_type.0') === 'organisation' ||
    getNestedProperty(data, 'attributes.type.type') === 'institution';
  },

  isPerson (data) {
    return getNestedProperty(data, 'attributes.type.sub_type.0') === 'person' ||
    getNestedProperty(data, 'attributes.type.type') === 'person';
  },

  getOccupation (data, links) {
    let key;
    let values;
    if (this.isOrganisation(data)) {
      key = 'industry';
    } else {
      key = 'occupation';
    }
    const rawValue = getNestedProperty(data, 'attributes.occupation');
    if (rawValue) {
      values = rawValue.sort().map(function (occupation) {
        const val = occupation.trim();
        return {
          value: val[0].toUpperCase() + val.substring(1),
          link: links ? links.root + '/search/people/occupation/' + this.formatLink(encodeURIComponent(val)) : null
        };
      }.bind(this));
      // add comma between values for display
      values.forEach(function (occupation, i) {
        if (i !== values.length - 1) {
          occupation.value += ',';
        }
      });
    }
    return values ? { key, value: values } : null;
  },

  getNationality (data) {
    const value = getNestedProperty(data, 'attributes.nationality.0');
    return value ? { key: 'Nationality', value } : null;
  },

  getMakers (resource) {
    const makers = [];
    let value;
    let key;
    let link;
    if (resource.included) {
      resource.included.forEach(el => {
        if (getNestedProperty(el, 'attributes.role.type') === 'maker') {
          key = getNestedProperty(el, 'attributes.role.value') || getNestedProperty(el, 'attributes.role.type');
          value = getNestedProperty(el, 'attributes.summary_title') || null;
          const unknown = value.match(/unknown|unidentified|unattributed/i);
          if (unknown) {
            link = null;
            value = unknown[0];
          } else {
            link = getNestedProperty(el, 'links.self');
          }
          if (makersList.indexOf(key) === -1) {
            key = 'maker';
          }
          makers.push(key && value ? { key, value, link } : null);
        }
      });
    }
    if (getNestedProperty(resource, 'data.attributes.lifecycle.creation.0.maker')) {
      resource.data.attributes.lifecycle.creation[0].maker.forEach(el => {
        if (el['@link'].type === 'literal') {
          key = 'maker';
          value = getPrimaryValue(el.name);
          const unknown = value.match(/unknown|unidentified|unattributed/i);
          if (unknown) {
            value = unknown[0];
          }
          makers.push((key && value) ? { key, value } : null);
        }
      });
    }
    return makers.reduce((a, b) => {
      let maker = {};
      const f = a.findIndex(e => e.key === b.key);
      if (f !== -1) {
        a[f].makers.push({ value: b.value, link: b.link });
      } else {
        maker = { key: b.key, makers: [] };
        maker.makers.push({ value: b.value, link: b.link });
        a.push(maker);
      }
      return a;
    }, []);
  },

  getSystem (data) {
    let value = null;
    if (data.attributes.admin) {
      value = this.getSystemName(data.attributes.admin.source);
    }
    return { key: 'system', value };
  },

  getSystemName (source) {
    const systemNames = {
      smgc: 'Mimsy',
      smga: 'AdLib'
    };

    return systemNames[source];
  },

  formatLink (link) {
    return link.split(/%20|\s/).join('-').toLowerCase();
  }
};
