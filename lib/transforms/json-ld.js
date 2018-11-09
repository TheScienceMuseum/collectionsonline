const getValues = require('./get-values');

module.exports = {
  agent (resource) {
    var agentJSONLD = {};
    if (getValues.isOrganisation(resource.data)) {
      agentJSONLD = {
        '@id': resource.data.links.self,
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
      '@id': resource.data.links.self,
      '@type': getObjectType(resource.data)
    };
    var locationJSONLD = {};
    if (getValues.getDisplayLocation(resource.data)) {
      locationJSONLD = {
        'contentLocation': [
          {
            '@type': 'Place',
            'name': getValues.getDisplayLocation(resource.data).museum
          }
        ]
      };
    }
    return JSON.stringify(Object.assign({
      '@context': 'http://schema.org',
      name: getValues.getTitle(resource.data),
      url: resource.data.links.self
    }, objectJSONLD, locationJSONLD));
  },

  archive (resource) {
    var objectJSONLD = {
      '@id': resource.data.links.self,
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
    'aquatint': 'VisualArtwork',
    'poster': 'VisualArtwork',
    'print': 'VisualArtwork',
    'colour print': 'VisualArtwork',
    'lithograph': 'VisualArtwork',
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
  var objectType = data.attributes.name[0].value;
  return validTypes[objectType] || 'Thing';
}
