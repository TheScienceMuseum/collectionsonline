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
const DAILY_HERALD_ID = 'co205344';

module.exports = (resource) => {
  // console.log(resource, 'checing the resource');
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
  let identifier = getIdentifier(resource.data);
  identifier = identifier ? identifier.value : null;
  const uid = getUID(resource.data);
  const museums = require('../../fixtures/museums');
  const navigation = require('../../fixtures/navigation');
  const jsonLD = getJSONLD[typeMapping.toInternal(type)](resource);
  const tree = sortTree(resource.tree);
  const current = getNestedProperty(resource, 'data.attributes.@admin.uid');
  const grouping = getResourceGroupingType(resource);
  const displayBox = getGroupDisplayData(resource);
  const childRecords = getChildRecords(resource.data, links);
  const counts = getCounts(resource.data);
  const childRecordsHaveImages = doChildRecordsHaveImages(childRecords);
  const titlePage =
    normalise(getValues.getTitle(resource.data), {
      system: { value: system },
      type
    }) + ' | Science Museum Group Collection';
  const fact = getFacts(resource, links);
  const details = getDetails(resource, links);
  const layerData = fact.concat(details);
  if (displayLocation) {
    layerData.push(formatDisplayLocation(displayLocation));
  }
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
    inProduction,
    childRecords,
    childRecordsHaveImages,
    grouping,
    displayBox,
    counts
  };
};

function getSketchFab (data) {
  const values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach((el) => {
      if (el.platform === 'sketchfab') {
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getYouTube (data) {
  const values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach((el) => {
      if (el.platform === 'youtube') {
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getRotational (data) {
  const values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach((el) => {
      if (el.platform === '3D') {
        el.platform = 'rotational';
        values.push(el);
      }
    });
    return values.length ? values : null;
  }
}

function getAudio (data) {
  const values = [];
  if (data.attributes.enhancement && data.attributes.enhancement.web) {
    data.attributes.enhancement.web.forEach((el) => {
      const urlRegex = /^https/;

      if (el.platform === 'oralhistory') {
        el.prefix = 'https://smgco-oralhistories.s3-eu-west-1.amazonaws.com';
        values.push(el);
      } else if (el.platform === 'audio') {
        el.prefix = 'https://smgco-audio.s3-eu-west-1.amazonaws.com';
        if (el.audiofile) {
          return el.audiofile;
        } else {
          el.audiofile = el.prefix + '/' + el.id;
        }
        values.push(el);
      }
      if (el.thumbnail && !urlRegex.test(el.thumbnail)) {
        el.thumbnail = el.prefix + '/' + el.thumbnail;
      } else {
        return el.thumbnail;
      }
    });

    return values.length ? values : null;
  }
}

function formatDisplayLocation (location) {
  if (location) {
    const value = location.museum + ' : ' + location.gallery;
    return { key: 'Display Location', value, link: location.link };
  }
}

// use formatDisplayLocation instead
// function getDisplayLocation (data) {
//   let value = getNestedProperty(data, 'attributes.locations.0.value');
//   // check if new hierarchy facility avaliable
//   // and if so use instead of location
//   if (
//     data.attributes.facility &&
//     data.attributes.facility[0] &&
//     data.attributes.facility[0]['@hierarchy']
//   ) {
//     let site = '';
//     let gallery = '';
//     data.attributes.facility[0]['@hierarchy'].forEach((f) => {
//       if (f['@datatype'] === 'site') {
//         site = f.name[0].value;
//       }
//       if (f['@datatype'] === 'permanent gallery') {
//         gallery = f.name[0].value;
//       }
//     });
//     value = site + ' : ' + gallery;
//   }
//   return value ? { key: 'Display Location', value, link: value } : null;
// }

function getWikiLink (data) {
  const wikiregex = /en\.wikipedia\.org\/(?:wiki\/)(.+)/;

  const note = (data.attributes.description || []).find(
    (el) => el.value.indexOf('wiki') > -1
  );

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

  return [occupation, nationality, born, made, fonds]
    .concat(makers)
    .filter((el) => el);
}

function getRelated (resource, type) {
  if (resource.data.relationships) {
    const related = {};
    Object.keys(resource.data.relationships).forEach((group) => {
      related[group] = resource.data.relationships[group].data.map((item) => {
        return resource.included.find((inc) => inc.id === item.id);
      });
    });

    if (related.people) {
      related.people = related.people.map((e) => {
        if (
          usersList.indexOf(getNestedProperty(e, 'attributes.role.value')) ===
            -1 &&
          associationList.indexOf(
            getNestedProperty(e, 'attributes.role.value')
          ) === -1
        ) {
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
  return [
    website,
    category,
    collection,
    accession,
    materials,
    measurements,
    identifier,
    subject,
    access,
    arrangement,
    transcriptions,
    objectType,
    taxonomy
  ]
    .concat(legal, notes)
    .filter((el) => el);
}

function getSubject (data) {
  const subjects = getNestedProperty(data, 'attributes.content.subjects');
  if (subjects) {
    const values = subjects.map((subject) => {
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
  return value ? { key: 'Website', value, link: value } : null;
}

function getMade (resource, links) {
  const date = getValues.getMadeDate(resource.data);
  const places = getMadePlace(resource);
  const placeLinks =
    places &&
    places.map(function (p) {
      return {
        value: p,
        link:
          links.root + '/search/places/' + encodeURIComponent(p).toLowerCase()
      };
    });
  const dateLink = createDateLink(date, links);

  if (date || places) {
    return {
      key: 'Made',
      place: placeLinks,
      date: { value: date, link: dateLink }
    };
  } else {
    return null;
  }
}

function createDateLink (date, links) {
  if (!date || !links) {
    return null;
  }
  let dateFrom = date;
  let dateTo = date;
  if (/[^\d]/.test(date)) {
    const splitDate = date.split('-');
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
  return (
    links.root +
    '/search/date[from]/' +
    encodeURIComponent(dateFrom) +
    '/date[to]/' +
    encodeURIComponent(dateTo)
  );
}

function getMadePlace (resource) {
  const places = [];
  if (resource.included) {
    resource.included.forEach((el) => {
      // if (el.type === 'place' && getNestedProperty(el, 'attributes.role.value') === 'made') {
      // 25-11-2022 : Assume default place 'role' is made
      if (el.type === 'place') {
        places.push(getNestedProperty(el, 'attributes.summary.title'));
      }
    });
    return places.length ? places : null;
  }
}

function getCategory (data, links) {
  const values = [];
  if (data.attributes.category) {
    data.attributes.category.forEach((category) => {
      values.push(category.name);
    });
    return {
      key: 'Category',
      value: values.toString(),
      link:
        links.root +
        '/search/categories/' +
        getValues.formatLink(values.toString())
    };
  } else {
    return null;
  }
}

// lifecycle.collection.collector.summary.title
function getCollection (data, links) {
  const values = [];
  if (data.attributes.cumulation?.collector) {
    data.attributes.cumulation.collector.forEach((collection) => {
      values.push(collection.summary?.title);
    });
  }
  if (values.length) {
    return {
      key: 'Collection',
      value: values.toString(),
      link:
        links.root +
        '/search/collection/' +
        getValues.formatLink(values.toString())
    };
  } else {
    return null;
  }
}

function getUID (data) {
  const adminData = data.attributes
    ? data.attributes['@admin']
    : data['@admin'];
  const uid = adminData && adminData.uid ? adminData.uid : null;
  return uid;
}

function getAccession (data) {
  let value;
  if (data.attributes.identifier) {
    data.attributes.identifier.forEach((el) => {
      if (el.type === 'accession number') {
        value = el.value;
      }
    });
    return value ? { key: 'Object Number', value } : null;
  } else {
    return null;
  }
}

function getMaterials (data) {
  let values;
  const materialData = data.attributes && data.attributes.material;
  if (materialData) {
    values = materialData.map((material) => {
      const value = material.value.split(';').map((v) => v.trim());
      const links = Array.isArray(value)
        ? value.map(
          (v) => `/search/objects/material/${getValues.formatLink(v)}`
        )
        : [`/search/objects/material/${getValues.formatLink(value)}`];
      return {
        value,
        link: links
      };
    });
    return { key: 'Materials', value: values };
  } else {
    return null;
  }
}

function getMeasurements (data) {
  const values = [];

  // archive documents (extent)
  if (data.attributes.measurements && data.type === 'documents') {
    if (data.attributes.measurements.dimensions) {
      data.attributes.measurements.dimensions.forEach((el) => {
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
      data.attributes.measurements.dimensions.forEach((el) => {
        if (el.dimension && el.units !== 'in') {
          values.push(el.dimension + ': ' + el.value + el.units + '<br>');
        }
      });
    }
  }

  // component measurements
  if (data.attributes.component && data.type === 'objects') {
    data.attributes.component.forEach((el) => {
      if (el.measurements) {
        if (el.measurements.display) {
          values.push(el.measurements.display + '<br>');
        } else if (el.measurements.dimensions) {
          el.measurements.dimensions.forEach((dim) => {
            if (el.name === 'object weight' && dim.units !== 'lbs') {
              values.push(el.name + ': ' + dim.value + dim.units + '<br>');
            } else if (dim.dimension && dim.units !== 'in') {
              values.push(
                dim.dimension + ': ' + dim.value + dim.units + '<br>'
              );
            }
          });
        }
      }
    });
  }
  return values.length ? { key: 'Measurements', value: values.join('') } : null;
}

function getIdentifier (data) {
  let value;
  const identifierData = data.attributes?.identifier;
  if (identifierData) {
    identifierData.forEach((el) => {
      if (el.type !== 'accession number' && el.primary) {
        value = el.value;
      }
    });
    return value ? { key: 'Identifier', value } : null;
  } else {
    return null;
  }
}

function getAccess (data) {
  const value = getNestedProperty(data, 'attributes.access.note.0.value');
  return value ? { key: 'Access', value } : null;
}

function getLegal (data) {
  let legals = [];
  let value;
  let key;
  if (getNestedProperty(data, 'attributes.legal')) {
    Object.keys(data.attributes.legal).forEach((el) => {
      key = el;
      if (
        typeof data.attributes.legal[el] === 'object' &&
        data.attributes.legal[el].length &&
        el === 'rights'
      ) {
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
      legals.push(value ? { key: keyMap(key), value } : null);
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
  return value ? { key: 'System of Arrangement', value } : null;
}

function getTranscriptions (data) {
  const transcriptions = [];
  if (data.attributes.transcriptions) {
    data.attributes.transcriptions.forEach((el) => {
      transcriptions.push(el.value.replace(/\r\n|\n|\r/gm, '<br />'));
    });
    return { key: 'Transcription', value: transcriptions.join('<hr />') };
  } else {
    return null;
  }
}

function getNotes (data) {
  const notes = [];
  if (data.attributes.note && data.type !== 'people') {
    data.attributes.note.forEach((el) => {
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
  let value;
  const objectTypeData = data.attributes?.name;
  if (data.type !== 'people' && objectTypeData) {
    value = objectTypeData
      .filter((el) => {
        // skips "catalogue name"
        return el.type === 'object name';
      })
      .filter((el) => {
        return (
          el.value.toLowerCase() !== 'torture' ||
          el.value.toLowerCase() !== 'religion (primitive)'
        );
      })
      .filter((a, b, c) => {
        return c.indexOf(a) === b; // remove duplicates
      })
      .map((el) => {
        const val = el.value.toLowerCase();
        return {
          value: val,
          link:
            links.root +
            '/search/objects/object_type/' +
            getValues.formatLink(encodeURIComponent(val.toLowerCase()))
        };
      });
    return value.length ? { key: 'type', value } : null;
  }
}

function getTaxonomy (resource, links) {
  const taxonomy = [];
  if (resource.data.type !== 'people' && resource.included) {
    resource.included.forEach((el) => {
      if (el.attributes.hierarchy) {
        el.attributes.hierarchy.forEach((el) => {
          taxonomy.push({
            value: el.name[0].value.toLowerCase(),
            link:
              links.root +
              '/search/objects/object_type/' +
              encodeURIComponent(el.name[0].value.toLowerCase())
          });
        });
      }
    });
    return taxonomy.length
      ? {
          key: 'taxonomy',
          value: taxonomy
            .filter((el) => el.value.indexOf('<') === -1)
            .reverse()
        }
      : null;
  }
}

function getParent (resource) {
  if (getNestedProperty(resource, 'data.relationships.parent')) {
    const parent = resource.included.find((el) => {
      return el.id === resource.data.relationships.parent.data[0].id;
    });
    // a workaround to strip off (brackets) from the end of a summary.title
    // we should probably fix this in the index or make it a function
    const title = parent.attributes.summary.title;
    parent.attributes.summary.title = title.replace(/ \(.+\)/i, '');

    // if this is an obejct recordm then onyl show link if it's parent is a MPH record
    const isParentMPH = !!resource.data.attributes.grouping?.[0]['@link'].type;
    const type = resource.data.type;
    if (type === 'objects' && !isParentMPH) {
      return null;
    }

    // ! hard coded check for Daily Herald record. This parent record has a redirect to its own search collection
    // ! The link from MPH child records throws a server error
    if (parent.id === DAILY_HERALD_ID) {
      return {
        ...parent,
        links: {
          ...parent.links,
          self: 'https://collection.sciencemuseumgroup.org.uk/search/collection/daily-herald-archive'
        }
      };
    }

    return parent;
  } else {
    return null;
  }
}

function getFonds (resource) {
  let fondsID;
  let fonds;
  if (getNestedProperty(resource, 'data.relationships.fonds')) {
    fondsID = resource.data.relationships.fonds.data[0].id;
    fonds = resource.included.find((el) => el.id === fondsID);
    if (fonds) {
      return {
        id: fondsID,
        link: fonds.links.self,
        summary_title: fonds.attributes.summary.title
      };
    }
  }
  return null;
}

function getFondsFact (resource) {
  const fonds = getFonds(resource);
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
  let images = [];
  // console.log('-----');
  if (Array.isArray(data.attributes.multimedia)) {
    images = data.attributes.multimedia.map((e) => {
      if (e['@processed']) {
        const img = {
          large: getNestedProperty(e, '@processed.large.location'),
          medium: getNestedProperty(e, '@processed.medium.location'),
          card: getNestedProperty(e, '@processed.medium_thumbnail.location'),
          thumb: getNestedProperty(e, '@processed.small_thumbnail.location'),
          zoom: getNestedProperty(e, '@processed.zoom.location'),
          author: e.author
        };
        // if (e['@admin'].id === 'media-165695') {
        //   console.log(e);
        // }
        if (e.credit && e.credit.value) {
          img.credit = e.credit.value;
          // don't show a credit line if same as copyright line
          if (
            e.legal &&
            e.legal.rights &&
            e.credit.value === e.legal.rights[0].copyright
          ) {
            img.credit = '';
          }
        }
        if (e.legal) {
          img.rights = formatLicense(e.legal.rights[0]);
        }

        img.title = e.title
          ? e.title.find((el) => el.type === 'caption').value ||
            data.attributes.summary.title
          : data.attributes.summary.title;

        img.caption = e.title
          ? e.title.find((el) => el.type === 'caption').value || ''
          : '';

        return img;
      } else {
        return null;
      }
    });
  }
  return images.filter(Boolean);
}

function formatLicense (rights) {
  let formatted;
  let cc;
  let ccurl;
  let image;
  if (rights && rights.licence) {
    Object.keys(licenses).forEach((el) => {
      if (rights.licence.match(el)) {
        formatted = rights.licence.replace(el, licenses[el].text);
        image = licenses[el].image;
        ccurl = licenses[el].url;
        cc = true;
      }
    });
  }
  if (rights && rights.copyright === 'unknown') {
    rights.copyright = 'Copyright holder unknown';
  }
  const copyright = rights ? rights.copyright : '';
  return {
    details: copyright,
    licence: rights.licence,
    usage_terms: formatted,
    cc,
    ccurl,
    image
  };
}

function keyMap (key) {
  const mappings = {
    credit_line: 'credit',
    legal_status: 'status',
    rights: 'copyright'
  };
  return mappings[key] || key;
}

// used to check if *any* of the child records on a SPH page have images
function doChildRecordsHaveImages (childRecords) {
  const childRecordsHaveImages = childRecords.some((child) => child.hasImage);
  return childRecordsHaveImages;
}

function getChildRecords (
  data,
  links,
  depth = 0,
  parentTitle = null,
  parentId = null,
  parentAccessionNumber = null
) {
  // transforms elastic search call for child records on a single (parent) object
  const childRecords = data.children || [];

  if (childRecords.length === 0) {
    return [];
  }

  return childRecords.map((record) => {
    const description = getDescription(record.data);
    const title = getChildTitle(record.data);
    const links = record.data.attributes.links;
    const detailsArr = getChildRecordDetails(record, links);
    const details = detailsArr.filter((item) => item !== null);
    const images = getImages(record.data, description);
    const inProduction = Boolean(record.data.inProduction);
    const creation = record.data.attributes.creationDate?.[0].value;
    const category = getCategory(record.data, links);
    const uid = getUID(record.data);
    const accessionNumber = getAccession(record.data).value;
    // TODO: add record type to nested children

    let children = [];

    // used to show no image placeholders at all if none of the images have an image
    const hasImage = !!images.length;
    const hasMultipleImages = images.length > 1;
    const priority = isPriorityCard(childRecords, record, description);
    if (
      record.data.attributes &&
      record.data.attributes.children &&
      record.data.attributes.children.length > 0
    ) {
      // recursive function for nested child records, passes in values for access to parent values
      children = getChildRecords(
        record.data.attributes,
        links,
        depth + 1,
        title,
        uid,
        accessionNumber
      );
    }

    const result = {
      uid,
      record,
      // groupingType,
      description,
      title,
      details,
      // details: groupingType === 'SPH' ? details : null,
      images,
      inProduction,
      // link: groupingType === 'MPH' ? link : null,
      links,
      children,
      creation,
      category,
      hasImage,
      hasMultipleImages,
      parentId,
      parentTitle,
      priority,
      parentAccessionNumber
    };
    return result;
  });
}

function getChildTitle (data) {
  let primaryTitle;
  if (data.attributes && data.attributes.title) {
    const { title } = data.attributes;
    const primaryItem = title.find((item) => item.primary === true);
    if (primaryItem) {
      primaryTitle = primaryItem.value;
    } else if (title.length > 0) {
      // Fallback to the first item's value if no primary item is found
      primaryTitle = title[0].value;
    }
  } else if (data.attributes && data.attributes.summary) {
    const { summary } = data.attributes;
    primaryTitle = summary.title;
  }
  return primaryTitle;
}

function getChildRecordDetails (record, links) {
  const identifier = getAccession(record.data);
  const materials = getMaterials(record.data);
  const measurements = getMeasurements(record.data);
  const name = getObjectType(record.data, links);
  return [measurements, materials, identifier, name];
}

// gets data for group curatorial grouping display box
function getGroupDisplayData (resource) {
  const { grouping = [] } = resource.data.attributes;
  const result =
    grouping &&
    grouping
      .map((group) => {
        if (group?.['@link']?.type === 'MG') {
          return {
            title: group?.summary?.title,
            uid: group?.['@admin']?.uid
          };
        }
        return undefined;
      })
      .filter((item) => item !== undefined);

  return result.length > 0 ? result : null;
}
function getResourceGroupingType (resource) {
  const { groupingType } = resource?.data?.record || {};
  return groupingType;
}

function getCounts (resource) {
  const counts = resource?.counts?.['direct-descendants'];
  return counts;
}

// if resolves to true on a part record, allows fpr special styling
function isPriorityCard (childRecords, record, description) {
  if (
    !description ||
    !description.primary ||
    !description.primary.initialDescription
  ) {
    return false;
  }

  const { primary } = description;
  const singleChildRecord = childRecords.length === 1;
  const singleChildWebDescription =
    childRecords.filter(
      (child) =>
        child.data.attributes.description.web && child.data.attributes.web
    ).length === 1;
  const boosted = !!record.data.attributes.boost;
  const primaryDescriptionLength =
    primary?.initialDescription?.[0]?.split(/\s+/).length > 100;

  return (
    singleChildRecord ||
    boosted ||
    primaryDescriptionLength ||
    singleChildWebDescription
  );
}

// sorting the Archive document tree and child archives
function sortTree (tree) {
  if (!tree || !tree.children) {
    return tree;
  }
  const treeChildren = [...tree?.children];
  // Check if there are children to sort
  if (!treeChildren || treeChildren.length === 0) {
    return tree;
  }

  treeChildren.sort(
    (a, b) => extractNumber(a.identifier) - extractNumber(b.identifier)
  );

  // Recursively sort each child's children
  const sortedChildren = treeChildren.map((child) => {
    if (child.children && child.children.length > 0) {
      return sortTree({ ...child });
    } else {
      return child;
    }
  });

  return { ...tree, children: sortedChildren }; // Return the tree with sorted children
}

// to extract the number from archive tree identifier
function extractNumber (archiveIdentifier) {
  const segments = archiveIdentifier.split('/');
  const lastSegment = segments[segments.length - 1];
  return parseInt(lastSegment);
}
