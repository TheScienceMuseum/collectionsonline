const getNestedProperty = require('../nested-property');
const getValues = require('./get-values');

module.exports = (resource) => {
  const title = getValues.getTitle(resource.data);
  const type = getType(resource.data);
  const fact = getFacts(resource);
  const related = getRelated(resource);
  const system = getSystem(resource.data);
  const description = getDescription(resource.data);
  const details = getDetails(resource);
  const displayLocation = getValues.getDisplayLocation(resource.data);
  const level = getValues.getDocumentLevel(resource.data);
  const date = getValues.getDate(resource.data);
  const links = getLinks(resource.data);

  return {title, type, fact, related, description, details, displayLocation, system, level, date, links};
};

function getType (data) {
  return data.type;
}

function getLinks (data) {
  return data.links;
}

function getFacts (resource) {
  // Need confirmation of what attributes to use as facts
  // TODO: only get attributes relevant to specific resource type
  const occupation = getOccupation(resource.data);
  const nationality = getNationality(resource.data);
  const born = getBorn(resource.data);
  const makers = getMakers(resource);
  const made = getMade(resource);

  return [occupation, nationality, born, made].concat(makers).filter(el => el);
}

function getOccupation (data) {
  var key;
  if (isOrganisation(data)) {
    key = 'industry';
  } else {
    key = 'occupation';
  }
  var value = getNestedProperty(data, 'attributes.occupation');
  if (value && value.indexOf(';')) {
    value = value.split(';').map(el => {
      el = el.trim();
      return el[0].toUpperCase() + el.substr(1);
    }).join(', ');
  }
  return value ? {key: key, value: value} : null;
}

function getNationality (data) {
  const value = getNestedProperty(data, 'attributes.nationality');
  return value ? {key: 'Nationality', value: value} : null;
}

function getBorn (data) {
  var key;
  if (isOrganisation(data)) {
    key = 'based';
  } else {
    key = 'born in';
  }
  const value = getNestedProperty(data, 'attributes.lifecycle.birth.0.location.name.0.value');
  return value ? {key: key, value: value} : null;
}

function getRelated (resource) {
  if (resource.data.relationships) {
    var related = resource.included.reduce((prev, curr) => {
      if (curr.type === 'people') {
        if (curr.attributes.summary_title) {
          curr.attributes.summary_title = getValues.normaliseName(curr.attributes.summary_title);
        }
        // Naive check to see if person is an actual person or an organistion
        // Would be nice to have this info available in the original resource
        if (!curr.attributes.role) {
          if (!prev.organisations) {
            prev.organisations = [];
          }
          prev.organisations.push(curr);
          return prev;
        }
      }
      if (!prev[curr.type]) {
        prev[curr.type] = [];
      }
      prev[curr.type].push(curr);
      return prev;
    }, {});

    related.objects = removeOrphans(related.objects);
    related.documents = removeOrphans(related.documents);

    return related;
  }
}

function removeOrphans (items) {
  console.log(items);
  if (items) {
    if (items.length > 6 && items.length < 12) {
      return items.slice(0, 6);
    } else {
      return items.slice(0, 12);
    }
  }
}

function getDescription (data) {
  var value;
  if (data.type === 'people') {
    value = getNestedProperty(data, 'attributes.note.0.value');
  } else {
    value = getNestedProperty(data, 'attributes.description.0.value') || getNestedProperty(data, 'attributes.note.0.value');
  }
  return value ? formatDescription(value) : null;
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

function getDetails (resource) {
  // Need confirmation of what attributes to use as details
  // TODO: only get attributes relevant to specific resource type
  const website = getWebsite(resource.data);
  const category = getCategory(resource.data);
  const accession = getAccession(resource.data);
  const materials = getMaterials(resource.data);
  const measurements = getMeasurements(resource.data);
  const identifier = getIdentifier(resource.data);
  const access = getAccess(resource.data);
  const legal = getLegal(resource.data);
  const arrangement = getArrangement(resource.data);
  const notes = getNotes(resource.data);
  const objectType = getObjectType(resource.data);
  const taxonomy = getTaxonomy(resource);

  return [website, category, accession, materials, measurements, identifier, access, arrangement, objectType, taxonomy].concat(legal, notes).filter(el => el);
}

function getWebsite (data) {
  const value = getNestedProperty(data, 'attributes.website');
  return value ? {key: 'Website', value: value, link: value} : null;
}

function getMakers (resource) {
  var makers = [];
  var value;
  var key;
  var link;
  if (resource.included) {
    resource.included.forEach(el => {
      if (getNestedProperty(el, 'attributes.role.type') === 'maker') {
        key = getNestedProperty(el, 'attributes.role.value');
        value = getNestedProperty(el, 'attributes.summary_title') || null;
        link = getNestedProperty(el, 'links.self');
        makers.push(value ? {key: key, value: value, link: link} : null);
      }
    });
    return makers.filter(Boolean);
  }
}

function getMade (resource) {
  const place = getMadePlace(resource);
  const date = getValues.getMadeDate(resource.data);

  var value;
  if (date && place) {
    value = place + ' in ' + date;
  } else {
    value = place || date;
  }
  return value ? {key: 'Made', value: value} : null;
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

function getCategory (data) {
  var values = [];
  if (data.attributes.categories) {
    data.attributes.categories.forEach(category => {
      values.push(category.value);
    });
    return {key: 'Category', value: values.toString()};
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
  var values = [];
  if (data.attributes.materials) {
    data.attributes.materials.forEach(material => {
      values.push(material);
    });
    return {key: 'Materials', value: values.toString()};
  } else {
    return null;
  }
}

function getMeasurements (data) {
  var values = [];
  if (data.attributes.component) {
    data.attributes.component.forEach((el, i, arr) => {
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
          if (i < arr.length - 1) {
            value += '<br>';
          }
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

function getObjectType (data) {
  var value;
  if (data.type !== 'people' && data.attributes.name) {
    data.attributes.name.forEach(el => {
      if (el.primary) {
        value = el.value || null;
      }
    });
    return value ? {key: 'type', value: value} : null;
  }
}

function getTaxonomy (resource) {
  var taxonomy = [];
  if (resource.data.type !== 'people' && resource.included) {
    resource.included.forEach(el => {
      if (el.type === 'term') {
        taxonomy.push(el.attributes.summary_title);
      }
    });
    return {key: 'taxonomy', value: taxonomy.join(', ')};
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

function keyMap (key) {
  const mappings = {
    'credit_line': 'credit',
    'legal_status': 'status'
  };

  return mappings[key] || key;
}

function isOrganisation (data) {
  return getNestedProperty(data, 'attributes.type.sub_type.0') === 'organisation';
}
