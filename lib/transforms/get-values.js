const getNestedProperty = require('../nested-property');
const getPrimaryValue = require('../get-primary-value');
const makersList = require('../../fixtures/makers');
const encodeFilterValue = require('../helpers/encode-filter-value');

module.exports = {
  getMadeDate (data) {
    const dateValue = getNestedProperty(
      data,
      'attributes.creation.date.0.value'
    );
    const earliestDate = getNestedProperty(
      data,
      'attributes.creation.date.0.from'
    );
    const latestDate = getNestedProperty(data, 'attributes.creation.date.0.to');

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

  // old facility/location model - pre 2024
  //
  // getDisplayLocation (data) {
  //   const display = {};
  //   const locations = getNestedProperty(data, 'attributes.facility.0.name');
  //   const filters = [];
  //   if (locations) {
  //     locations.forEach(loc => {
  //       if (loc.type === 'gallery' || loc.type === 'museum') {
  //         let displayValue = loc.value;
  //         if (displayValue === 'National Media Museum') displayValue = 'National Science and Media Museum';
  //         if (displayValue === 'Museum of Science and Industry') displayValue = 'Science and Industry Museum';
  //         display[loc.type] = displayValue;
  //         filters.push(loc.type + '/' + encodeURIComponent(loc.value));
  //       }
  //     });
  //     display.link = '/search/' + this.formatLink(filters.join('/'));
  //   }
  //   return display.museum ? display : null;
  // },

  getDisplayLocation (data) {
    const display = {};
    const filters = [];

    // old model
    const locations = getNestedProperty(data, 'attributes.location.0.name');
    if (locations) {
      locations.forEach((loc) => {
        if (loc.type === 'gallery' || loc.type === 'museum') {
          // console.log(loc);
          let displayValue = loc.value;
          if (displayValue === 'National Media Museum') {
            displayValue = 'National Science and Media Museum';
          }
          if (displayValue === 'Museum of Science and Industry') {
            displayValue = 'Science and Industry Museum';
          }
          display[loc.type] = displayValue;
          filters.push(loc.type + '/' + encodeURIComponent(loc.value));
        }
      });
      display.link = '/search/' + this.formatLink(filters.join('/'));
    }

    // new model
    if (
      data.attributes.facility &&
      data.attributes.facility[0] &&
      data.attributes.facility[0]['@hierarchy']
    ) {
      data.attributes.facility[0]['@hierarchy'].forEach((f) => {
        if (
          f['@datatype'] === 'permanent gallery' ||
          f['@datatype'] === 'open store' ||
          f['@datatype'] === 'temporary exhibition'
        ) {
          display.gallery = f.name[0].value;
          filters.push('gallery/' + encodeURIComponent(f.name[0].value));
        }
        if (f['@datatype'] === 'site') {
          display.museum = f.name[0].value;
          filters.push('museum/' + encodeURIComponent(f.name[0].value));
        }
      });
      display.link = '/search/' + this.formatLink(filters.join('/'));
    }

    return display.museum ? display : null;
  },

  // Collects on-display locations from the parent record and all direct child records.
  // Returns a deduplicated array of {museum, gallery, link} objects, or null if none found.
  getDisplayLocations (data) {
    const locations = [];
    const seen = new Set();

    const addIfNew = (loc) => {
      if (!loc) return;
      const key = loc.museum + '|' + (loc.gallery || '');
      if (!seen.has(key)) {
        seen.add(key);
        locations.push(loc);
      }
    };

    // Parent record location
    addIfNew(this.getDisplayLocation(data));

    // Direct children (WHOLE/PART / SPH records)
    const children = data.children || [];
    children.forEach((child) => {
      if (child && child.data) {
        addIfNew(this.getDisplayLocation(child.data));
      }
    });

    return locations.length > 0 ? locations : null;
  },

  getDocumentLevel (item) {
    if (item.type === 'documents') {
      return getNestedProperty(item, 'attributes.level.value') === 'fonds'
        ? 'archive'
        : 'documents';
    }
  },

  getTitle (item) {
    if (item.type === 'people') {
      const system = this.getSystem(item).value;

      if (system === 'Mimsy') {
        // summary.title is always in natural display order for Mimsy records.
        // name.value uses catalogue-inverted "Last, First" order — avoid it.
        return item.attributes.summary?.title ||
          item.attributes.name?.[0]?.value ||
          null;
      }

      if (system === 'AdLib') {
        // In AdLib, presence of name.first reliably indicates a human person.
        // Organisations are catalogued with only name.last (the full org name).
        // Only ~3 edge-case records have name.first without name.last (single-name
        // historical figures e.g. "Victoria", "Elizabeth II").
        const nameEntry = item.attributes.name?.[0];
        if (nameEntry?.first) {
          const first = Array.isArray(nameEntry.first)
            ? nameEntry.first[0]
            : nameEntry.first;
          const last = nameEntry.last;
          return last ? `${first} ${last}` : first;
        }
        // No name.first → organisation → use summary.title as-is.
        return item.attributes.summary?.title || nameEntry?.value || null;
      }

      // Unknown/missing system: fall back to existing preferred-name logic.
      if (item.attributes.name) {
        const name =
          item.attributes.name.find((el) => el.type === 'preferred name') ||
          item.attributes.name[0];
        return name.value;
      }
    }
    return (
      getPrimaryValue(item.attributes.title) || item.attributes.summary?.title
    );
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
    const latestYearExtracted =
      getNestedProperty(item, 'attributes.birth.date.to') ||
      getNestedProperty(item, 'attributes.birth.date.0.to') ||
      null;
    const birthDateFreetext =
      getNestedProperty(item, 'attributes.birth.date.value') ||
      getNestedProperty(item, 'attributes.birth.date.0.value') ||
      null;
    if (birthDateFreetext) {
      if (
        birthDateFreetext.indexOf('BC') > -1 ||
        birthDateFreetext.indexOf('BCE') > -1 ||
        birthDateFreetext.indexOf('CE') > -1
      ) {
        return birthDateFreetext;
      }
    }
    return latestYearExtracted;
  },

  getDeathDate (item) {
    const latestYearExtracted =
      getNestedProperty(item, 'attributes.death.date.to') ||
      getNestedProperty(item, 'attributes.death.date.0.to') ||
      null;
    const deathDateFreetext =
      getNestedProperty(item, 'attributes.death.date.value') ||
      getNestedProperty(item, 'attributes.death.date.0.value') ||
      null;
    if (deathDateFreetext) {
      if (
        deathDateFreetext.indexOf('BC') > -1 ||
        deathDateFreetext.indexOf('BCE') > -1 ||
        deathDateFreetext.indexOf('CE') > -1
      ) {
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
    const value = getNestedProperty(data, 'attributes.birth.place.name.0.value') ||
      getNestedProperty(data, 'attributes.birth.place.summary.title');
    if (!value) return null;

    // Split comma-separated place hierarchy, trim, and deduplicate
    const parts = [...new Set(
      value.split(',').map(p => p.trim()).filter(Boolean)
    )];

    const places = parts.map(p => ({
      value: p,
      link: links ? links.root + '/search/places/' + encodeFilterValue(p) : null
    }));

    return { key, places };
  },

  isOrganisation (data) {
    return (
      getNestedProperty(data, 'attributes.@datatype.actual') === 'organisation' ||
      getNestedProperty(data, 'attributes.type.sub_type.0') === 'organisation' ||
      getNestedProperty(data, 'attributes.type.type') === 'institution'
    );
  },

  isPerson (data) {
    return (
      getNestedProperty(data, 'attributes.@datatype.actual') === 'person' ||
      getNestedProperty(data, 'attributes.type.sub_type.0') === 'person' ||
      getNestedProperty(data, 'attributes.type.type') === 'person'
    );
  },

  getOccupation (data, links) {
    let key;
    let values;
    if (this.isOrganisation(data)) {
      key = 'industry';
    } else {
      key = 'occupation';
    }
    const rawValue = getNestedProperty(data, 'attributes.occupation.value');
    if (rawValue && Array.isArray(rawValue)) {
      values = rawValue.sort().map(
        function (occupation) {
          const val = occupation.trim();
          return {
            value: val[0].toUpperCase() + val.substring(1),
            link: links
              ? links.root + '/search/people/occupation/' + encodeFilterValue(val)
              : null
          };
        }
      );
      // add comma between values for display
      values.forEach(function (occupation, i) {
        if (i !== values.length - 1) {
          occupation.value += ',';
        }
      });
    } else if (rawValue) {
      values = [
        {
          value: rawValue[0].toUpperCase() + rawValue.substring(1),
          link: links
            ? links.root + '/search/people/occupation/' + encodeFilterValue(rawValue)
            : null
        }
      ];
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
      resource.included.forEach((el) => {
        if (getNestedProperty(el, 'attributes.role.type') === 'maker') {
          key =
            getNestedProperty(el, 'attributes.role.value') ||
            getNestedProperty(el, 'attributes.role.type');
          value = getNestedProperty(el, 'attributes.summary.title') || null;
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
    // This code checked for 'literal' catalogue 'anchor' field people and companies.
    // But it copntains too many semi-colons (;) concat valeus to be useable / reliable.
    // We may want to reinstate if if we later find we are missing important makers.
    // if (getNestedProperty(resource, 'data.attributes.creation.maker')) {
    //   resource.data.attributes.creation.maker.forEach((el) => {
    //     console.log(el);
    //     if (el['@entity'] === 'literal') {
    //       key = 'maker';
    //       value = getPrimaryValue(el.name);
    //       const unknown = value.match(/unknown|unidentified|unattributed/i);
    //       if (unknown) {
    //         value = unknown[0];
    //       }
    //       if (makers.findIndex((e) => e.value === value) === -1) {
    //         makers.push(key && value ? { key, value } : null);
    //       }
    //     }
    //   });
    // }
    return makers.reduce((a, b) => {
      let maker = {};
      const f = a.findIndex((e) => e.key === b.key);
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
    if (data.attributes['@admin']) {
      value = this.getSystemName(data.attributes['@admin'].source);
    }
    return { key: 'system', value };
  },

  getSystemName (source) {
    const systemNames = {
      'Mimsy XG': 'Mimsy',
      'Adlib Archives': 'AdLib'
    };

    return systemNames[source];
  },

  formatLink (link) {
    // temporary fix for middleware bug for materials data structure

    const result = Array.isArray(link)
      ? link.map((l) =>
        l
          .split(/%20|\s/)
          .trim()
          .join('-')
          .replace(/^-/g, '')
          .toLowerCase()
      )
      : link
        .split(/%20|\s/)
        .join('-')
        .toLowerCase();
    return result;
  }
};
