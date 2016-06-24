const propertyExists = require('../property-exists');

module.exports = (resource) => {
  const title = getTitle(resource.data);
  const type = getType(resource.data);
  const fact = getFacts(resource.data);
  const related = getRelated(resource);
  const description = getDescription(resource.data);
  const details = getDetails(resource.data);

  return {title, type, fact, related, description, details};
};

function getTitle (data) {
  return data.attributes.summary_title;
}

function getType (data) {
  return data.type;
}

function getFacts (data) {
  // Need confirmation of what attributes to use as facts
  const occupation = getOccupation(data);
  const nationality = getNationality(data);
  const born = getBorn(data);
  const birth = getBirth(data);
  const death = getDeath(data);

  return [occupation, nationality, born, birth, death].filter(el => el);
}

function getOccupation (data) {
  const value = propertyExists(data, 'attributes.occupation');
  return value ? {key: 'Occupation', value: value} : null;
}

function getNationality (data) {
  const value = propertyExists(data, 'attributes.nationality');
  return value ? {key: 'Nationality', value: value} : null;
}

function getBorn (data) {
  const value = propertyExists(data, 'attributes.lifecycle.birth.0.location.name.0.value');
  return value ? {key: 'Born', value: value} : null;
}

function getBirth (data) {
  const value = propertyExists(data, 'attributes.lifecycle.birth.0.date.0.value');
  return value ? {key: 'Birth', value: value} : null;
}

function getDeath (data) {
  const value = propertyExists(data, 'attributes.lifecycle.death.0.date.0.value');
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
  const value = propertyExists(data, 'attributes.note.0.value');
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
  return [website].filter(el => el);
}

function getWebsite (data) {
  const value = propertyExists(data, 'attributes.website');
  return value ? {key: 'Website', value: value, link: value} : null;
}
