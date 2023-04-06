const getNestedProperty = require('../nested-property');
const getValues = require('./get-values');
const getJSONLD = require('./json-ld');
const typeMapping = require('../type-mapping');
const licenses = require('../../fixtures/licenses');
const usersList = require('../../fixtures/users');
const associationList = require('../../fixtures/associations');
const normalise = require('../../templates/helpers/normalise');
const prettyStatus = require('../helpers/json-to-html-data/pretty-status');
const dataLayer = require('./data-layer');
const getDescription = require('../helpers/json-to-html-data/get-description');
const uppercaseFirstChar = require('../helpers/utils').uppercaseFirstChar;

module.exports = (resource) => {
  const title = getValues.getTitle(resource.data);
  const type = getType(resource.data);
  const links = getLinks(resource.data);
  const related = getRelated(resource, type);
  const system = getValues.getSystem(resource.data);
  const description = getDescription(resource.data);
  const displayLocation = getValues.getDisplayLocation(resource.data);
  const level = getValues.getDocumentLevel(resource.data);
  const date = getValues.getDate(resource.data);
  const parent = getParent(resource);
  const fonds = getFonds(resource);
  const images = getImages(resource.data, description);
  var identifier = getIdentifier(resource.data);
  identifier = identifier ? identifier.value : null;
  const uid = getUID(resource.data);
  const museums = require('../../fixtures/museums');
  const navigation = require('../../fixtures/navigation');
  const jsonLD = getJSONLD[typeMapping.toInternal(type)](resource);
  const tree = resource.tree;
  const current = getNestedProperty(resource, 'data.attributes.admin.uid');
  const titlePage = normalise(getValues.getTitle(resource.data), { system: { value: system }, type: type }) + ' | Science Museum Group Collection';
  const fact = getFacts(resource, links);
  const details = getDetails(resource, links);
  const location = getDisplayLocation(resource.data);
  const layerData = fact.concat(details);
  if (location) { layerData.push(location); }
  const layer = dataLayer(type, layerData);
  const wikipedia = getWikiLink(resource.data);
  const sketchfab = getSketchFab(resource.data);
  const youtube = getYouTube(resource.data);
  const audioplayer = getAudio(resource.data);
  const rotational = getRotational(resource.data);
  const inProduction = Boolean(resource.inProduction);
  return {
    title,
    titlePage,
    type,
    fact,
    related,
    description,
    details,
    displayLocation,
    system,
    level,
    date,
    links,
    identifier,
    uid,
    parent,
    fonds,
    images,
    museums,
    navigation,
    jsonLD,
    tree,
    current,
    layer,
    wikipedia,
    sketchfab,
    audioplayer,
    youtube,
    rotational,
    inProduction
  };
};

function getSketchFab (data) {
  var values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach(el => {
      if (el.platform === 'sketchfab') {
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getYouTube (data) {
  var values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    // console.log('Found youtube links');
    data.attributes.enhancement.web.forEach(el => {
      if (el.platform === 'youtube') {
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getRotational (data) {
  var values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach(el => {
      // console.log(el);
      if (el.platform === '3D') {
        el.platform = 'rotational';
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getAudio (data) {
  var values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach(el => {
      if (el.platform === 'oralhistory') {
        el.prefix = 'https://smgco-oralhistories.s3-eu-west-1.amazonaws.com';
        values.push(el);
      } else if (el.platform === 'audio') {
        el.prefix = 'https://smgco-audio.s3-eu-west-1.amazonaws.com';
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getDisplayLocation (data) {
  const value = getNestedProperty(data, 'attributes.locations.0.value');
  return value ? { key: 'Display Location', value: value, link: value } : null;
}

function getWikiLink (data) {
  var wikiregex = /en\.wikipedia\.org\/(?:wiki\/)(.+)/;

  var note = (data.attributes.description || []).find(el => el.value.indexOf('wiki') > -1);

  if (note && wikiregex.exec(note.value)) {
    return note.value.match(wikiregex)[1];
  } else {
    return null;
  }
}

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
  const fonds = getFondsFact(resource);

  return [occupation, nationality, born, made, fonds].concat(makers).filter(el => el);
}

function getRelated (resource, type) {
  if (resource.data.relationships) {
    var related = {};
    Object.keys(resource.data.relationships).forEach(group => {
      related[group] = resource.data.relationships[group].data.map(item => {
        return resource.included.find(inc => inc.id === item.id);
      });
    });

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

function getDetails (resource, links) {
  // Need confirmation of what attributes to use as details
  // TODO: only get attributes relevant to specific resource type
  const website = getWebsite(resource.data);
  const category = getCategory(resource.data, links);
  const collection = getCollection(resource.data, links);
  const accession = getAccession(resource.data);
  const materials = getMaterials(resource.data);
  const measurements = getMeasurements(resource.data);
  const identifier = getIdentifier(resource.data);
  const access = getAccess(resource.data);
  const legal = getLegal(resource.data);
  const arrangement = getArrangement(resource.data);
  const transcriptions = getTranscriptions(resource.data);
  const notes = getNotes(resource.data);
  const objectType = getObjectType(resource.data, links);
  const taxonomy = getTaxonomy(resource, links);
  const subject = getSubject(resource.data, links);
  return [website, category, collection, accession, materials, measurements, identifier, subject, access, arrangement, transcriptions, objectType, taxonomy].concat(legal, notes).filter(el => el);
}

function getSubject (data) {
  const subjects = getNestedProperty(data, 'attributes.content.subjects');
  if (subjects) {
    var values = subjects.map(subject => {
      return {
        value: uppercaseFirstChar(subject.summary_title)
      };
    });
    return { key: 'Subject', value: values };
  } else {
    return null;
  }
}

function getWebsite (data) {
  const value = getNestedProperty(data, 'attributes.website');
  return value ? { key: 'Website', value: value, link: value } : null;
}

function getMade (resource, links) {
  const date = getValues.getMadeDate(resource.data);
  const places = getMadePlace(resource);
  const placeLinks = places && places.map(function (p) {
    return {
      value: p,
      link: links.root + '/search/places/' + encodeURIComponent(p).toLowerCase()
    };
  });
  const dateLink = createDateLink(date, links);

  if (date || places) {
    return { key: 'Made', place: placeLinks, date: { value: date, link: dateLink } };
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
  return links.root + '/search/date[from]/' + encodeURIComponent(dateFrom) + '/date[to]/' + encodeURIComponent(dateTo);
}

function getMadePlace (resource) {
  var places = [];
  if (resource.included) {
    resource.included.forEach(el => {
      // if (el.type === 'place' && getNestedProperty(el, 'attributes.role.value') === 'made') {
      // 25-11-2022 : Assume default place 'role' is made
      if (el.type === 'place') {
        places.push(getNestedProperty(el, 'attributes.summary_title'));
      }
    });
    return places.length ? places : null;
  }
}

function getCategory (data, links) {
  var values = [];
  if (data.attributes.categories) {
    data.attributes.categories.forEach(category => {
      values.push(category.name);
    });
    return { key: 'Category', value: values.toString(), link: links.root + '/search/categories/' + getValues.formatLink(values.toString()) };
  } else {
    return null;
  }
}

// lifecycle.collection.collector.summary_title
function getCollection (data, links) {
  var values = [];
  if (data.attributes.lifecycle && data.attributes.lifecycle.collection) {
    data.attributes.lifecycle.collection.forEach(collection => {
      // console.log(collection.collector[0].summary_title);
      if (collection.collector) {
        values.push(collection.collector[0].summary_title);
      }
    });
  }
  if (values.length) {
    return { key: 'Collection', value: values.toString(), link: links.root + '/search/collection/' + getValues.formatLink(values.toString()) };
  } else {
    return null;
  }
}

function getUID (data) {
  if (data.attributes.admin && data.attributes.admin.uid) {
    return data.attributes.admin.uid;
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
    return value ? { key: 'Object Number', value: value } : null;
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
        link: `/search/objects/material/${getValues.formatLink(material)}`
      };
    });
    return { key: 'Materials', value: values };
  } else {
    return null;
  }
}

function getMeasurements (data) {
  var values = [];
 
  // archive documents (extent)
  if (data.attributes.measurements && data.type === 'documents') {
    if (data.attributes.measurements.dimensions) {
      data.attributes.measurements.dimensions.forEach(el => {
        values.push(el.value + '<br>');
      });
    }
    return values.length ? { key: 'Extent', value: values.join('') } : null;
  }

  // object measurements 
  if (data.attributes.measurements && data.type === 'objects') {
    if (data.attributes.measurements.display) {
      values.push(data.attributes.measurements.display + '<br>');
    } else if (data.attributes.measurements.dimensions) {
      data.attributes.measurements.dimensions.forEach(el => {
        if (el.dimension && el.units !== 'in') {
          values.push(el.dimension + ': ' + el.value + el.units + '<br>');
        }
      });
    }
  }

  // component measurements 
  if (data.attributes.component && data.type === 'objects') {
    var count = 0
    data.attributes.component.forEach(el => {
      if (el.measurements) {
        if (el.measurements.display) {
          values.push(el.measurements.display + '<br>');
        } else if (el.measurements.dimensions) {
          el.measurements.dimensions.forEach(dim => {
            if (el.name === 'object weight' && dim.units !== 'lbs') {
              values.push(el.name + ': ' + dim.value + dim.units + '<br>');
            } else if (dim.dimension && dim.units !== 'in') {
              values.push(dim.dimension + ': ' + dim.value + dim.units + '<br>');
            }
          });
        }
      }
    });
  }

  return values.length ? { key: 'Measurements', value: values.join('') } : null;
}

function getIdentifier (data) {
  var value;
  if (data.attributes.identifier) {
    data.attributes.identifier.forEach(el => {
      if (el.type !== 'accession number' && el.primary) {
        value = el.value;
      }
    });
    return value ? { key: 'Identifier', value: value } : null;
  } else {
    return null;
  }
}

function getAccess (data) {
  const value = getNestedProperty(data, 'attributes.access.note.0.value');
  return value ? { key: 'Access', value: value } : null;
}

function getLegal (data) {
  var legals = [];
  var value;
  var key;
  if (getNestedProperty(data, 'attributes.legal')) {
    Object.keys(data.attributes.legal).forEach((el) => {
      key = el;
      if (typeof data.attributes.legal[el] === 'object' && data.attributes.legal[el].length && el === 'rights') {
        data.attributes.legal[el].forEach(function (r) {
          if (r.type && r.type.toLowerCase() === 'copyright') {
            value = r.holder;
          } else if (r.holder) {
            value = r.holder;
          } else if (r.details) {
            value = r.details;
          }
        });
      } else {
        value = data.attributes.legal[el];
      }
      legals.push(value ? { key: keyMap(key), value: value } : null);
    });
  }
  legals = legals.filter(Boolean);

  return legals.map(function (l) {
    return {
      key: l.key,
      value: prettyStatus(l.value) || l.value
    };
  });
}

function getArrangement (data) {
  const value = getNestedProperty(data, 'attributes.arrangement.system.0');
  return value ? { key: 'System of Arrangement', value: value } : null;
}

function getTranscriptions (data) {
  var transcriptions = [];
  if (data.attributes.transcriptions) {
    data.attributes.transcriptions.forEach(el => {
      transcriptions.push(el.value.replace(/\r\n|\n|\r/gm, '<br />'));
    });
    return { key: 'Transcription', value: transcriptions.join('<hr />') };
  } else {
    return null;
  }
}

function getNotes (data) {
  var notes = [];
  if (data.attributes.note && data.type !== 'people') {
    data.attributes.note.forEach(el => {
      if (el.type) {
        notes.push({ key: el.type, value: el.value });
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
    value = data.attributes.name.filter(el => {
      if (el.value.toLowerCase() === 'torture' || el.value.toLowerCase() === 'religion (primitive)') { return false; }
      return true;
    })
    .filter((a, b, c) => {
      return c.indexOf(a) === b; // remove duplicates
    })
    .map(el => {
      var val = el.value.toLowerCase();
      return {
        value: val,
        link: links.root + '/search/objects/object_type/' + getValues.formatLink(encodeURIComponent(val.toLowerCase()))
      };
    });
    return value ? { key: 'type', value: value } : null;
  }
}

function getTaxonomy (resource, links) {
  var taxonomy = [];
  if (resource.data.type !== 'people' && resource.included) {
    resource.included.forEach(el => {
      if (el.attributes.hierarchy) {
        el.attributes.hierarchy.forEach(el => {
          taxonomy.push({ value: el.name[0].value.toLowerCase(), link: links.root + '/search/objects/object_type/' + encodeURIComponent(el.name[0].value.toLowerCase()) });
        });
      }
    });
    return taxonomy.length ? { key: 'taxonomy', value: taxonomy.filter(el => el.value.indexOf('<') === -1).reverse() } : null;
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

function getFondsFact (resource) {
  var fonds = getFonds(resource);
  if (fonds) {
    return {
      key: 'part of archive',
      value: fonds.summary_title,
      link: '#archive-block'
    };
  } else {
    return null;
  }
}

function getImages (data, description) {
  var images = [];

  if (data.attributes.multimedia) {
    images = data.attributes.multimedia.map(e => {
      if (e.processed) {
        var img = {
          large: getNestedProperty(e, 'processed.large.location'),
          medium: getNestedProperty(e, 'processed.medium.location'),
          card: getNestedProperty(e, 'processed.medium_thumbnail.location'),
          thumb: getNestedProperty(e, 'processed.small_thumbnail.location'),
          zoom: getNestedProperty(e, 'processed.zoom.location'),
          author: e.author,
          credit: e.credit
        };

        if (e.source && e.source.legal) {
          img.rights = formatLicense(e.source.legal.rights[0]);
        }

        if (data.type === 'documents') {
          img.title = '';
        } else {
          img.title = (e.source && e.source.title) ? e.source.title.find(el => el.type === 'main title').value || e.source.title[0].value : '';

          if (description) {
            var desc = description.primary || description.web || { initialDescription: [''] };
            if (img.title.substr(0, 50).toLowerCase() === desc.initialDescription[0].substr(0, 50).toLowerCase()) {
              img.title = '';
            }
          }
        }

        return img;
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
  var ccurl;
  var image;
  if (license.usage_terms) {
    Object.keys(licenses).forEach(el => {
      if (license.usage_terms.match(el)) {
        formatted = license.usage_terms.replace(el, licenses[el].text);
        image = licenses[el].image;
        ccurl = licenses[el].url;
        cc = true;
      }
    });
  }
  if (license.details === 'unknown') license.details = 'Copyright holder unknown';
  return { details: license.details, usage_terms: formatted, cc: cc, ccurl: ccurl, image: image };
}

function keyMap (key) {
  const mappings = {
    'credit_line': 'credit',
    'legal_status': 'status',
    'rights': 'copyright'
  };

  return mappings[key] || key;
}
