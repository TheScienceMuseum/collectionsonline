const getValues = require('./get-values');
const getNestedProperty = require('../nested-property');

module.exports = {
  agent (resource) {
    var agentJSONLD = {};
    if (getValues.isOrganisation(resource.data)) {
      agentJSONLD = {
        '@type': 'Organization'
      };
    } else if (getValues.isPerson(resource.data)) {
      var birthPlace = getValues.getBorn(resource.data);
      var jobTitle = getValues.getOccupation(resource.data);
      var nationality = getValues.getNationality(resource.data);
      agentJSONLD = {
        '@type': 'Person',
        'birthDate': getValues.getBirthDate(resource.data),
        'deathDate': getValues.getDeathDate(resource.data),
        'birthPlace': birthPlace && birthPlace.value,
        'jobTitle': jobTitle && jobTitle.value,
        'nationality': nationality && nationality.value
      };
    }
    return JSON.stringify(Object.assign({
      '@context': 'http://schema.org',
      name: getValues.getTitle(resource.data),
      url: resource.data.links.self
    }, Object.keys(agentJSONLD).reduce((a, b) => {
      // Get rid of null values
      if (agentJSONLD[b]) {
        if (typeof agentJSONLD[b] === 'object' && agentJSONLD[b].length) {
          // Turn Array of values into String
          a[b] = agentJSONLD[b].map(el => el.value).join(' ');
        } else {
          a[b] = agentJSONLD[b];
        }
      }
      return a;
    }, {})));
  },

  object (resource) {
    var objectJSONLD = {
      '@type': getObjectType(resource.data)
    };
    return JSON.stringify(Object.assign({
      '@context': 'http://schema.org',
      name: getValues.getTitle(resource.data),
      url: resource.data.links.self
    }, objectJSONLD));
  },

  archive (resource) {
    var objectJSONLD = {
      '@type': 'CreativeWork',
      creator: getValues.getMakers(resource).map(e => e.value)
    };
    return JSON.stringify(Object.assign({
      '@context': 'http://schema.org',
      name: getValues.getTitle(resource.data),
      url: resource.data.links.self
    }, objectJSONLD));
  }
};

function getObjectType (data) {
  var validTypes = {
    'photograph': 'Photograph',
    'book': 'Book',
    'game': 'Game',
    'board game': 'Game',
    'video game': 'VideoGame',
    'map': 'Map',
    'painting': 'Painting',
    'oil painting; portrait': 'Painting',
    'sculpture': 'Sculpture',
    'steam locomotive': 'Vehicle',
    'electric locomotive': 'Vehicle',
    'car': 'Car'
  };
  var objectType = getNestedProperty(data, 'name.value');
  return validTypes[objectType] || 'Thing';
}
