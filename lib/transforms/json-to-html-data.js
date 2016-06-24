const getNestedProperty = require('../nested-property');

module.exports = (resource) => {
  const title = getTitle(resource.data);
  const type = getType(resource.data);
  const fact = getFacts(resource);
  const related = getRelated(resource);
  const description = getDescription(resource.data);
  const details = getDetails(resource.data);
  const displayLocation = getDisplayLocation(resource.data);

  return {title, type, fact, related, description, details, displayLocation};
};

function getTitle (data) {
  return data.attributes.summary_title;
}

function getType (data) {
  return data.type;
}

function getFacts (resource) {
  // Need confirmation of what attributes to use as facts
  const occupation = getOccupation(resource.data);
  const nationality = getNationality(resource.data);
  const born = getBorn(resource.data);
  const birth = getBirth(resource.data);
  const death = getDeath(resource.data);
  const maker = getMaker(resource);
  const made = getMade(resource);

  return [occupation, nationality, born, birth, death, maker, made].filter(el => el);
}

function getOccupation (data) {
  const value = getNestedProperty(data, 'attributes.occupation');
  return value ? {key: 'Occupation', value: value} : null;
}

function getNationality (data) {
  const value = getNestedProperty(data, 'attributes.nationality');
  return value ? {key: 'Nationality', value: value} : null;
}

function getBorn (data) {
  const value = getNestedProperty(data, 'attributes.lifecycle.birth.0.location.name.0.value');
  return value ? {key: 'Born', value: value} : null;
}

function getBirth (data) {
  const value = getNestedProperty(data, 'attributes.lifecycle.birth.0.date.0.value');
  return value ? {key: 'Birth', value: value} : null;
}

function getDeath (data) {
  const value = getNestedProperty(data, 'attributes.lifecycle.death.0.date.0.value');
  return value ? {key: 'Death', value: value} : null;
}

function getRelated (resource) {
  if (resource.data.relationships) {
    const related = resource.included.reduce((prev, curr) => {
      if (curr.type === 'people') {
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
    return related;
  }
}

function getDescription (data) {
  const value = getNestedProperty(data, 'attributes.note.0.value');
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

function getDetails (data) {
  // Need confirmation of what attributes to use as details
  const website = getWebsite(data);
  const category = getCategory(data);
  const accession = getAccession(data);
  const materials = getMaterials(data);
  const measurements = getMeasurements(data);
  const status = getStatus(data);
  return [website, category, accession, materials, measurements, status].filter(el => el);
}

function getWebsite (data) {
  const value = getNestedProperty(data, 'attributes.website');
  return value ? {key: 'Website', value: value, link: value} : null;
}

function getMaker (resource) {
  var value;
  if (resource.included) {
    resource.included.forEach(el => {
      if (el.type === 'people' && getNestedProperty(el, 'attributes.role') === 'manufacturer') {
        value = getNestedProperty(el, 'attributes.summary_title') || null;
      }
    });
    return value ? {key: 'Maker', value: value} : null;
  }
}

function getMade (resource) {
  const place = getMadePlace(resource);
  const date = getMadeDate(resource);

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
      if (el.type === 'place' && getNestedProperty(el, 'attributes.role') === 'made') {
        value = getNestedProperty(el, 'attributes.summary_title') || null;
      }
    });
    return value || null;
  }
}

function getMadeDate (resource) {
  return getNestedProperty(resource, 'data.attributes.lifecycle.creation.0.date.0.value') || null;
}

function getCategory (data) {
  var value = [];
  if (data.attributes.categories) {
    data.attributes.categories.forEach(category => {
      value.push(category.value);
    });
    return {key: 'Category', value: value.toString()};
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
  var value = [];
  if (data.attributes.materials) {
    data.attributes.materials.forEach(material => {
      value.push(material);
    });
    return {key: 'Materials', value: value.toString()};
  } else {
    return null;
  }
}

function getMeasurements (data) {
  const value = getNestedProperty(data, 'attributes.component.0.measurements.display');
  return value ? {key: 'Measurements', value: value} : null;
}

function getStatus (data) {
  const value = getNestedProperty(data, 'attributes.legal.legal_status');
  return value ? {key: 'Status', value: value} : null;
}

function getDisplayLocation (data) {
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
}
