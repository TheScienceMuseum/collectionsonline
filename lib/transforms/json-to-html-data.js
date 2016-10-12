const getNestedProperty = require('../nested-property');
const getValues = require('./get-values');
const getJSONLD = require('./json-ld');
const typeMapping = require('../type-mapping');
const licenses = require('../../fixtures/licenses');
const usersList = require('../../fixtures/users');
const associationList = require('../../fixtures/associations');
const getPrimaryValue = require('../get-primary-value');

module.exports = (resource) => {
  const title = getValues.getTitle(resource.data);
  const titlePage = getValues.getTitle(resource.data) + ' | Science Museum Group Collection';
  const type = getType(resource.data);
  const links = getLinks(resource.data);
  const fact = getFacts(resource, links);
  const related = getRelated(resource, type);
  const system = getSystem(resource.data);
  const description = getDescription(resource.data);
  const details = getDetails(resource, links);
  const displayLocation = getValues.getDisplayLocation(resource.data);
  const level = getValues.getDocumentLevel(resource.data);
  const date = getValues.getDate(resource.data);
  const parent = getParent(resource);
  const fonds = getFonds(resource);
  const images = getImages(resource.data);
  var identifier = getIdentifier(resource.data);
  identifier = identifier ? identifier.value : null;
  const footer = require('../../fixtures/footer');
  const footerBanner = require('../../fixtures/footer-banner');
  const jsonLD = getJSONLD[typeMapping.toInternal(type)](resource);
  const tree = resource.tree;
  const current = getNestedProperty(resource, 'data.attributes.admin.uid');

  return {title, titlePage, type, fact, related, description, details, displayLocation, system, level, date, links, identifier, parent, fonds, images, footer, footerBanner, jsonLD, tree, current};
};

function getType (data) {
  return data.type;
}

function getLinks (data) {
  return data.links;
}

function getFacts (resource, links) {
  // Need confirmation of what attributes to use as facts
  // TODO: only get attributes relevant to specific resource type
  const occupation = getValues.getOccupation(resource.data, links);
  const nationality = getValues.getNationality(resource.data);
  const born = getValues.getBorn(resource.data, links);
  const makers = getValues.getMakers(resource);
  const made = getMade(resource, links);
  const parent = getParentFact(resource);

  return [occupation, nationality, born, made, parent].concat(makers).filter(el => el);
}

function getRelated (resource, type) {
  if (resource.data.relationships) {
    var related = {};
    Object.keys(resource.data.relationships).forEach(group => {
      related[group] = resource.data.relationships[group].data.map(item => {
        return resource.included.find(inc => inc.id === item.id);
      });
    });

    related.objects = removeOrphans(related.objects);
    related.documents = removeOrphans(related.documents);

    if (related.people) {
      related.people = related.people.map(e => {
        if (usersList.indexOf(getNestedProperty(e, 'attributes.role.value')) === -1 &&
          associationList.indexOf(getNestedProperty(e, 'attributes.role.value')) === -1) {
          e.attributes.role = null;
        }
        return e;
      });
    }

    return related;
  }
}

function removeOrphans (items) {
  if (items) {
    if (items.length > 5 && items.length < 11) {
      return items.slice(0, 5);
    } else {
      return items.slice(0, 11);
    }
  }
}

function getDescription (data) {
  var descriptions = {};
  var preferredDescriptions;

  descriptions.web = getNestedProperty(data, 'attributes.description');

  if (data.type === 'people') {
    preferredDescriptions = ['attributes.note', 'attributes.description', 'attributes.content.description'];
  } else if (data.type === 'objects') {
    preferredDescriptions = ['attributes.description', 'attributes.content.description', 'attributes.note'];
  } else if (data.type === 'documents') {
    preferredDescriptions = ['attributes.content.description', 'attributes.description', 'attributes.note'];
  }

  for (var i = 0; i < preferredDescriptions.length; i++) {
    var desc = getPrimaryValue(getNestedProperty(data, preferredDescriptions[i])) || null;
    if (desc && desc !== descriptions.web) {
      descriptions.primary = desc;
      break;
    }
  }

  if (descriptions.web) {
    descriptions.web = descriptions.web.filter(el => {
      return el.type === 'web description';
    });

    if (descriptions.web.length) {
      descriptions.web = descriptions.web[0].value;
    }
  }

  var formattedDescriptions = Object.keys(descriptions).reduce((prev, curr) => {
    if (typeof descriptions[curr] === 'string') {
      prev[curr] = formatDescription(descriptions[curr]);
    }
    return prev;
  }, {});

  if (formattedDescriptions.primary || formattedDescriptions.web) {
    return formattedDescriptions;
  } else {
    return null;
  }
}

function formatDescription (description) {
  const splitDescription = description.split('\n');
  var initialDescription;
  var moreDescription;

  if (splitDescription.length > 15) {
    initialDescription = splitDescription.slice(0, 14);
    moreDescription = splitDescription.slice(15);
    return {initialDescription, moreDescription};
  } else {
    initialDescription = splitDescription;
    return {initialDescription};
  }
}

function getDetails (resource, links) {
  // Need confirmation of what attributes to use as details
  // TODO: only get attributes relevant to specific resource type
  const website = getWebsite(resource.data);
  const category = getCategory(resource.data, links);
  const accession = getAccession(resource.data);
  const materials = getMaterials(resource.data);
  const measurements = getMeasurements(resource.data);
  const identifier = getIdentifier(resource.data);
  const access = getAccess(resource.data);
  const legal = getLegal(resource.data);
  const arrangement = getArrangement(resource.data);
  const notes = getNotes(resource.data);
  const objectType = getObjectType(resource.data, links);
  const taxonomy = getTaxonomy(resource, links);

  return [website, category, accession, materials, measurements, identifier, access, arrangement, objectType, taxonomy].concat(legal, notes).filter(el => el);
}

function getWebsite (data) {
  const value = getNestedProperty(data, 'attributes.website');
  return value ? {key: 'Website', value: value, link: value} : null;
}

function getMade (resource, links) {
  const place = getMadePlace(resource);
  const date = getValues.getMadeDate(resource.data);
  const placeLink = links.root + '/search?filter[places]=' + encodeURIComponent(place);
  const dateLink = createDateLink(date, links);

  if (date || place) {
    return {key: 'Made', place: {value: place, link: placeLink}, date: {value: date, link: dateLink}};
  } else {
    return null;
  }
}

function createDateLink (date, links) {
  if (!date || !links) {
    return null;
  }
  var dateFrom = date;
  var dateTo = date;
  if (/[^\d]/.test(date)) {
    var splitDate = date.split('-');
    if (splitDate.length === 2 && splitDate[0].length === 4) {
      dateFrom = splitDate[0];
      if (splitDate[1].length === 4) {
        dateTo = splitDate[1];
      } else {
        dateTo = splitDate[0];
      }
    } else {
      return null;
    }
  }
  return links.root + '/search?date[from]=' + encodeURIComponent(dateFrom) + '&date[to]=' + encodeURIComponent(dateTo);
}

function getMadePlace (resource) {
  var value;
  if (resource.included) {
    resource.included.forEach(el => {
      if (el.type === 'place' && getNestedProperty(el, 'attributes.role.value') === 'made') {
        value = getNestedProperty(el, 'attributes.summary_title') || null;
      }
    });
    return value || null;
  }
}

function getCategory (data, links) {
  var values = [];
  if (data.attributes.categories) {
    data.attributes.categories.forEach(category => {
      values.push(category.name);
    });
    return {key: 'Category', value: values.toString(), link: links.root + '/search?filter[categories]=' + encodeURIComponent(values.toString())};
  } else {
    return null;
  }
}

function getAccession (data) {
  var value;
  if (data.attributes.identifier) {
    data.attributes.identifier.forEach(el => {
      if (el.type === 'accession number') {
        value = el.value;
      }
    });
    return value ? {key: 'Accession Number', value: value} : null;
  } else {
    return null;
  }
}

function getMaterials (data) {
  var values;
  if (data.attributes.materials) {
    values = data.attributes.materials.map(material => {
      return {
        value: material,
        link: `/search/objects?filter[material]=${material}`
      };
    });
    return {key: 'Materials', value: values};
  } else {
    return null;
  }
}

function getMeasurements (data) {
  var values = [];
  if (data.attributes.component) {
    data.attributes.component.forEach(el => {
      values.push(el.measurements.display + '<br>');
    });
    return values.length ? {key: 'Measurements', value: values.join('')} : null;
  }
}

function getIdentifier (data) {
  var value;
  if (data.attributes.identifier) {
    data.attributes.identifier.forEach(el => {
      if (el.type !== 'accession number' && el.primary) {
        value = el.value;
      }
    });
    return value ? {key: 'Identifier', value: value} : null;
  } else {
    return null;
  }
}

function getAccess (data) {
  const value = getNestedProperty(data, 'attributes.access.note.0.value');
  return value ? {key: 'Access', value: value} : null;
}

function getLegal (data) {
  var legals = [];
  var value;
  var key;
  if (getNestedProperty(data, 'attributes.legal')) {
    Object.keys(data.attributes.legal).forEach((el) => {
      key = el;
      if (typeof data.attributes.legal[el] === 'object' && data.attributes.legal[el].length) {
        value = '';
        data.attributes.legal[el].forEach((leg, i, arr) => {
          value += leg.details;
        });
      } else {
        value = data.attributes.legal[el];
      }
      legals.push(value ? {key: keyMap(key), value: value} : null);
    });
  }
  return legals.filter(Boolean);
}

function getArrangement (data) {
  const value = getNestedProperty(data, 'attributes.arrangement.system.0');
  return value ? {key: 'System of Arrangement', value: value} : null;
}

function getNotes (data) {
  var notes = [];
  if (data.attributes.note && data.type !== 'people') {
    data.attributes.note.forEach(el => {
      if (el.type) {
        notes.push({key: el.type, value: el.value});
      }
    });
    return notes;
  } else {
    return null;
  }
}

function getObjectType (data, links) {
  var value;
  if (data.type !== 'people' && data.attributes.name) {
    value = data.attributes.name.map((el, i, arr) => {
      var val = el.value;
      if (i < arr.length - 1) {
        val += ',';
      }
      return {
        value: val,
        link: links.root + '/search/objects?filter[type]=' + encodeURIComponent(el.value)
      };
    });
    return value ? {key: 'type', value: value} : null;
  }
}

function getTaxonomy (resource, links) {
  var taxonomy = [];
  if (resource.data.type !== 'people' && resource.included) {
    resource.included.forEach(el => {
      if (el.attributes.hierarchy) {
        el.attributes.hierarchy.forEach(el => {
          taxonomy.push({value: el.name[0].value.toLowerCase(), link: links.root + '/search/objects?filter[type]=' + encodeURIComponent(el.name[0].value.toLowerCase())});
        });
      }
    });
    return taxonomy.length ? {key: 'taxonomy', value: taxonomy.filter(el => el.value.indexOf('<') === -1).reverse()} : null;
  }
}

function getParent (resource) {
  if (getNestedProperty(resource, 'data.relationships.parent')) {
    return resource.included.find(el => {
      return el.id === resource.data.relationships.parent.data[0].id;
    });
  } else {
    return null;
  }
}

function getFonds (resource) {
  var fondsID;
  var fonds;
  if (getNestedProperty(resource, 'data.relationships.fonds')) {
    fondsID = resource.data.relationships.fonds.data[0].id;
    fonds = resource.included.find(el => el.id === fondsID);
    if (fonds) {
      return {
        id: fondsID,
        link: fonds.links.self,
        summary_title: fonds.attributes.summary_title
      };
    }
  }
  return null;
}

function getParentFact (resource) {
  if (getNestedProperty(resource, 'data.relationships.parent')) {
    return {
      key: 'part of archive',
      value: getParent(resource).attributes.summary_title,
      link: '#archive-block'
    };
  } else {
    return null;
  }
}

function getSystem (data) {
  var value = null;
  if (data.attributes.admin) {
    value = getSystemName(data.attributes.admin.source);
  }
  return {key: 'system', value: value};
}

function getSystemName (source) {
  const systemNames = {
    smgc: 'Mimsy',
    smga: 'AdLib'
  };

  return systemNames[source];
}

function getImages (data) {
  var images = [];
  if (data.attributes.multimedia) {
    images = data.attributes.multimedia.map(e => {
      if (e.processed) {
        return {
          large: e.processed.large.location,
          thumb: e.processed.thumbnail.location,
          zoom: e.processed.zoom.location,
          author: e.author,
          credit: e.credit,
          rights: formatLicense(e.source.legal.rights[0]),
          title: e.source.title.find(el => el.type === 'main title').value || e.source.title[0].value
        };
      } else {
        return null;
      }
    });
  }
  return images.filter(Boolean);
}

function formatLicense (license) {
  var formatted;
  var cc;
  var image;
  Object.keys(licenses).forEach(el => {
    if (license.usage_terms.match(el)) {
      formatted = license.usage_terms.replace(el, licenses[el].text);
      image = licenses[el].image;
      cc = true;
    }
  });
  return {details: license.details, usage_terms: formatted, cc: cc, image: image};
}

function keyMap (key) {
  const mappings = {
    'credit_line': 'credit',
    'legal_status': 'status'
  };

  return mappings[key] || key;
}
