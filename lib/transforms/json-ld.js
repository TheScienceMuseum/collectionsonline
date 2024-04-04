const getValues = require('./get-values');

module.exports = {
  agent (resource) {
    let agentJSONLD = {};
    if (getValues.isOrganisation(resource.data)) {
      agentJSONLD = {
        '@id': resource.data.links.self,
        '@type': 'Organization'
      };
    } else if (getValues.isPerson(resource.data)) {
      const birthPlace = getValues.getBorn(resource.data);
      const jobTitle = getValues.getOccupation(resource.data);
      const nationality = getValues.getNationality(resource.data);
      agentJSONLD = {
        '@type': 'Person',
        birthDate: getValues.getBirthDate(resource.data),
        deathDate: getValues.getDeathDate(resource.data),
        birthPlace: birthPlace && birthPlace.value,
        jobTitle: jobTitle && jobTitle.value,
        nationality: nationality && nationality.value
      };
    }
    return JSON.stringify(
      Object.assign(
        {
          '@context': 'http://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        Object.keys(agentJSONLD).reduce((a, b) => {
          // Get rid of null values
          if (agentJSONLD[b]) {
            if (typeof agentJSONLD[b] === 'object' && agentJSONLD[b].length) {
              // Turn Array of values into String
              a[b] = agentJSONLD[b].map((el) => el.value).join(' ');
            } else {
              a[b] = agentJSONLD[b];
            }
          }
          return a;
        }, {})
      )
    );
  },

  object (resource) {
    const objectJSONLD = {
      '@id': resource.data.links.self,
      '@type': getObjectType(resource.data)
    };
    let locationJSONLD = {};
    if (getValues.getDisplayLocation(resource.data)) {
      locationJSONLD = {
        contentLocation: [
          {
            '@type': 'Place',
            name: getValues.getDisplayLocation(resource.data).museum
          }
        ]
      };
    }
    return JSON.stringify(
      Object.assign(
        {
          '@context': 'http://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        objectJSONLD,
        locationJSONLD
      )
    );
  },

  archive (resource) {
    const objectJSONLD = {
      '@id': resource.data.links.self,
      '@type': 'CreativeWork',
      creator: getValues.getMakers(resource).map((e) => e.value)
    };
    return JSON.stringify(
      Object.assign(
        {
          '@context': 'http://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        objectJSONLD
      )
    );
  },
  mgroup (resource) {
    const groupJSONLD = {
      '@id': resource.data.links.self,
      '@type': 'group'
    };
    return JSON.stringify(
      Object.assign(
        {
          '@context': 'http://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        groupJSONLD
      )
    );
  }
};

// Acceptable types https://schema.org/CreativeWork
function getObjectType (data) {
  const validTypes = {
    photograph: 'Photograph',
    aquatint: 'VisualArtwork',
    poster: 'Poster',
    print: 'VisualArtwork',
    'colour print': 'VisualArtwork',
    drawing: 'Drawing',
    lithograph: 'VisualArtwork',
    book: 'Book',
    game: 'Game',
    'board game': 'Game',
    'video game': 'VideoGame',
    map: 'Map',
    manuscript: 'Manuscript',
    'sheet music': 'SheetMusic',
    comic: 'Comic',
    painting: 'Painting',
    'oil painting; portrait': 'Painting',
    sculpture: 'Sculpture',
    //  Vehicle is a subclass of Product, which messes with Google
    // 'steam locomotive': 'Vehicle',
    // 'electric locomotive': 'Vehicle',
    car: 'Car'
  };
  const objectType = data.attributes.name
    ? data.attributes.name[0].value
    : null;
  return validTypes[objectType] || 'Thing';
}
