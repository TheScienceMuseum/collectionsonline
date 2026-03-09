const getValues = require('./get-values');
const getDescription = require('../helpers/json-to-html-data/get-description');
const getNestedProperty = require('../nested-property');
const normaliseWikidata = require('../helpers/normalise-wikidata');

function stripNulls (obj) {
  const result = {};
  Object.keys(obj).forEach(function (key) {
    if (obj[key] != null && obj[key] !== '') {
      result[key] = obj[key];
    }
  });
  return result;
}

function getDescriptionText (data) {
  const descObj = getDescription(data);
  if (!descObj) return null;
  const source = descObj.primary || descObj.web || descObj.briefbiog;
  if (!source || !source.initialDescription) return null;
  const text = Array.isArray(source.initialDescription)
    ? source.initialDescription.join(' ')
    : source.initialDescription;
  return text.replace(/<[^>]+>/g, '').trim() || null;
}

function getAccessionNumber (data) {
  const identifiers = data.attributes && data.attributes.identifier;
  if (!identifiers) return null;
  let accession = null;
  identifiers.forEach(function (el) {
    if (el.type === 'accession number') {
      accession = el.value;
    }
  });
  return accession;
}

function getCreators (resource) {
  const makers = getValues.getMakers(resource);
  if (!makers || !makers.length) return null;
  const creators = [];
  makers.forEach(function (m) {
    if (m.value && !m.value.match(/^unknown|^unidentified|^unattributed/i)) {
      const creator = { '@type': 'Person', name: m.value };
      if (m.link) {
        creator.url = m.link;
      }
      creators.push(creator);
    }
  });
  return creators.length ? creators : null;
}

function getMaterialText (data) {
  const materialData = data.attributes && data.attributes.material;
  if (!materialData || !materialData.length) return null;
  return materialData.map(function (m) { return m.value; }).join(', ');
}

function getFirstImageUrl (data) {
  return getNestedProperty(data, 'attributes.multimedia.0.@processed.large.location') || null;
}

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

    const wikidataUrl = normaliseWikidata.getUrl(resource.data.wikidata);
    if (wikidataUrl) {
      agentJSONLD.sameAs = wikidataUrl;
    }

    return JSON.stringify(
      Object.assign(
        {
          '@context': 'https://schema.org',
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
    const displayLocations = getValues.getDisplayLocations(resource.data);

    const objectJSONLD = stripNulls({
      '@id': resource.data.links.self,
      '@type': getObjectType(resource.data),
      description: getDescriptionText(resource.data),
      identifier: getAccessionNumber(resource.data),
      dateCreated: getValues.getMadeDate(resource.data),
      creator: getCreators(resource),
      material: getMaterialText(resource.data),
      image: getFirstImageUrl(resource.data),
      contentLocation: displayLocations
        ? displayLocations.map(function (loc) {
          return { '@type': 'Place', name: loc.museum };
        })
        : null
    });

    return JSON.stringify(
      Object.assign(
        {
          '@context': 'https://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        objectJSONLD
      )
    );
  },

  archive (resource) {
    const creators = getCreators(resource);

    const archiveJSONLD = stripNulls({
      '@id': resource.data.links.self,
      '@type': 'CreativeWork',
      description: getDescriptionText(resource.data),
      identifier: getAccessionNumber(resource.data),
      dateCreated: getValues.getMadeDate(resource.data),
      creator: creators
    });

    return JSON.stringify(
      Object.assign(
        {
          '@context': 'https://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        archiveJSONLD
      )
    );
  },

  mgroup (resource) {
    const groupJSONLD = {
      '@id': resource.data.links.self,
      '@type': 'CollectionPage'
    };
    return JSON.stringify(
      Object.assign(
        {
          '@context': 'https://schema.org',
          name: getValues.getTitle(resource.data),
          url: resource.data.links.self
        },
        groupJSONLD
      )
    );
  },

  breadcrumb (resource) {
    const type = resource.data.type;
    const title = getValues.getTitle(resource.data);
    const selfUrl = resource.data.links.self;
    const rootUrl = resource.data.links.root;

    const typeNames = {
      objects: 'Objects',
      people: 'People',
      documents: 'Documents',
      group: 'Topics'
    };

    const items = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: rootUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: typeNames[type] || type,
        item: rootUrl + '/search/' + type
      }
    ];

    const category = getNestedProperty(resource.data, 'attributes.category.0.name');
    if (category) {
      items.push({
        '@type': 'ListItem',
        position: 3,
        name: category,
        item: rootUrl + '/search/categories/' + getValues.formatLink(category)
      });
    }

    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: title,
      item: selfUrl
    });

    // Re-number positions sequentially
    items.forEach(function (el, i) {
      el.position = i + 1;
    });

    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items
    });
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
