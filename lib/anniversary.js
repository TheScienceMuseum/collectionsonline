var slug = require('slugg');
var widgetConfig = require('../config/anniversary-widget.json');

module.exports = async function getAnniversaryData (elastic, config) {
  var enabled = widgetConfig.enabled ||
    process.env.ANNIVERSARY_ENABLED === 'true';

  if (!enabled) return null;

  var today = new Date();
  var overrides = getOverridesForDate(today);

  try {
    var results = await Promise.all([
      widgetConfig.objects.enabled
        ? getObjectAnniversaries(elastic, config, today, overrides)
        : null,
      widgetConfig.people.enabled
        ? getPeopleAnniversaries(elastic, config, today, overrides)
        : null
    ]);

    var objects = results[0];
    var people = results[1];

    if (!hasResults(objects) && !hasResults(people)) return null;

    return {
      objects: objects ? { sectionTitle: widgetConfig.objects.sectionTitle, items: objects } : null,
      people: people ? { sectionTitle: widgetConfig.people.sectionTitle, items: people } : null
    };
  } catch (err) {
    console.error('Anniversary widget error:', err.message || err);
    return null;
  }
};

module.exports.secondsUntilMidnightUTC = secondsUntilMidnightUTC;
module.exports._getObjectAnniversaries = getObjectAnniversaries;
module.exports._getPeopleAnniversaries = getPeopleAnniversaries;
module.exports._getOverridesForDate = getOverridesForDate;
module.exports._transformObjectHit = transformObjectHit;
module.exports._transformPersonHit = transformPersonHit;

function hasResults (items) {
  return Array.isArray(items) && items.length > 0;
}

function secondsUntilMidnightUTC () {
  var now = new Date();
  var midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
}

function getOverridesForDate (date) {
  var mm = String(date.getMonth() + 1).padStart(2, '0');
  var dd = String(date.getDate()).padStart(2, '0');
  var key = mm + '-' + dd;
  var dateOverrides = widgetConfig.overrides && widgetConfig.overrides.dates;
  return (dateOverrides && dateOverrides[key]) || null;
}

// --- Object Anniversaries ---

async function getObjectAnniversaries (elastic, config, today, overrides) {
  var cfg = widgetConfig.objects;
  var currentYear = today.getFullYear();
  var count = cfg.count;

  // Handle overrides first
  var overrideItems = [];
  if (overrides && overrides.objects && overrides.objects.length > 0) {
    overrideItems = await fetchByIds(elastic, config, overrides.objects, currentYear);
    if (overrideItems.length >= count) {
      return overrideItems.slice(0, count);
    }
  }

  var remaining = count - overrideItems.length;
  var overrideIds = overrideItems.map(function (item) { return item.id; });

  var targetYears = cfg.milestones.map(function (m) {
    return { yearsAgo: m, year: String(currentYear - m) };
  });

  var milestoneBoosts = targetYears.map(function (t) {
    var weight = (cfg.milestoneBoosts && cfg.milestoneBoosts[String(t.yearsAgo)]) || 1;
    return {
      filter: { term: { 'creation.date.from': t.year } },
      weight: weight
    };
  });

  var must = [
    { term: { '@datatype.base': 'object' } }
  ];

  if (cfg.requireImage) {
    must.push({ exists: { field: 'multimedia.@processed.large_thumbnail.location' } });
  }

  var mustNot = [];
  if (overrideIds.length > 0) {
    mustNot.push({ ids: { values: overrideIds } });
  }

  var functions = milestoneBoosts.slice();

  if (cfg.preferOnDisplay) {
    functions.push({
      filter: { exists: { field: 'facility' } },
      weight: cfg.onDisplayBoost || 5
    });
  }

  functions.push({
    field_value_factor: {
      field: 'enhancement.analytics.current.cumulative_views',
      modifier: cfg.viewsBoostModifier || 'sqrt',
      factor: cfg.viewsBoostFactor || 0.01,
      missing: 1
    }
  });

  var body = {
    size: remaining,
    query: {
      function_score: {
        query: {
          bool: {
            must: must,
            should: targetYears.map(function (t) {
              return { term: { 'creation.date.from': t.year } };
            }),
            minimum_should_match: 1,
            must_not: mustNot
          }
        },
        functions: functions,
        score_mode: 'sum',
        boost_mode: 'multiply'
      }
    }
  };

  var result = await elastic.search({ index: 'ciim', body: body });
  var hits = result.body.hits.hits || [];

  var items = hits.map(function (hit) {
    return transformObjectHit(hit, config, currentYear);
  });

  return overrideItems.concat(items);
}

// --- People Anniversaries ---

async function getPeopleAnniversaries (elastic, config, today, overrides) {
  var cfg = widgetConfig.people;
  var currentYear = today.getFullYear();
  var count = cfg.count;

  // Handle overrides first
  var overrideItems = [];
  if (overrides && overrides.people && overrides.people.length > 0) {
    overrideItems = await fetchByIds(elastic, config, overrides.people, currentYear);
    if (overrideItems.length >= count) {
      return overrideItems.slice(0, count);
    }
  }

  var remaining = count - overrideItems.length;
  var overrideIds = overrideItems.map(function (item) { return item.id; });

  var daySuffixes = getDaySuffixes(today, cfg.dayRange || 0);

  var must = [
    { term: { '@datatype.base': 'agent' } }
  ];

  if (cfg.mimsyOnly) {
    must.push({ term: { '@admin.source': 'Mimsy XG' } });
  }

  // birth.date.value is a text field — standard analyzer tokenizes "1810-01-29"
  // into ["1810","01","29"]. Use match_phrase on "MM DD" to match adjacent tokens.
  var birthMatchClauses = daySuffixes.map(function (suffix) {
    // suffix is e.g. "-03-13", extract MM and DD
    var parts = suffix.split('-').filter(Boolean);
    return { match_phrase: { 'birth.date.value': parts[0] + ' ' + parts[1] } };
  });

  if (birthMatchClauses.length === 1) {
    must.push(birthMatchClauses[0]);
  } else {
    must.push({
      bool: { should: birthMatchClauses, minimum_should_match: 1 }
    });
  }

  var mustNot = [];
  if (overrideIds.length > 0) {
    mustNot.push({ ids: { values: overrideIds } });
  }

  var functions = [
    {
      filter: { exists: { field: 'multimedia.@processed.large_thumbnail.location' } },
      weight: cfg.imageBoost || 8
    },
    {
      filter: { exists: { field: 'description' } },
      weight: cfg.biographyBoost || 3
    },
    {
      field_value_factor: {
        field: 'enhancement.analytics.current.cumulative_views',
        modifier: cfg.viewsBoostModifier || 'sqrt',
        factor: cfg.viewsBoostFactor || 0.1,
        missing: 1
      }
    },
    {
      filter: { exists: { field: 'death.date' } },
      weight: cfg.deathDateBoost || 1.5
    }
  ];

  var body = {
    size: remaining,
    query: {
      function_score: {
        query: {
          bool: {
            must: must,
            must_not: mustNot
          }
        },
        functions: functions,
        score_mode: 'sum',
        boost_mode: 'multiply'
      }
    }
  };

  var result = await elastic.search({ index: 'ciim', body: body });
  var hits = result.body.hits.hits || [];

  var items = hits.map(function (hit) {
    return transformPersonHit(hit, config, currentYear);
  });

  var allItems = overrideItems.concat(items);

  // Fallback: if too few results and fallback enabled, try birth month
  if (allItems.length < (cfg.fallbackMinResults || 1) && cfg.fallbackToBirthMonth) {
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var fallbackResult = await getPeopleFallback(elastic, config, mm, currentYear, cfg, overrideIds);
    allItems = allItems.concat(fallbackResult);
  }

  return allItems.slice(0, count);
}

async function getPeopleFallback (elastic, config, month, currentYear, cfg, excludeIds) {
  var must = [
    { term: { '@datatype.base': 'agent' } },
    { match: { 'birth.date.value': month } }
  ];

  if (cfg.mimsyOnly) {
    must.push({ term: { '@admin.source': 'Mimsy XG' } });
  }

  var mustNot = [];
  if (excludeIds.length > 0) {
    mustNot.push({ ids: { values: excludeIds } });
  }

  var body = {
    size: cfg.count,
    query: {
      function_score: {
        query: { bool: { must: must, must_not: mustNot } },
        functions: [
          {
            filter: { exists: { field: 'multimedia.@processed.large_thumbnail.location' } },
            weight: cfg.imageBoost || 8
          },
          {
            field_value_factor: {
              field: 'enhancement.analytics.current.cumulative_views',
              modifier: 'sqrt',
              factor: 0.1,
              missing: 1
            }
          }
        ],
        score_mode: 'sum',
        boost_mode: 'multiply'
      }
    }
  };

  var result = await elastic.search({ index: 'ciim', body: body });
  var hits = result.body.hits.hits || [];

  return hits.map(function (hit) {
    return transformPersonHit(hit, config, currentYear);
  });
}

// --- Overrides: fetch specific records by ID ---

async function fetchByIds (elastic, config, ids, currentYear) {
  try {
    var result = await elastic.mget({
      index: 'ciim',
      body: { ids: ids }
    });

    var docs = result.body.docs || [];
    return docs
      .filter(function (doc) { return doc.found; })
      .map(function (doc) {
        var base = doc._source && doc._source['@datatype'] && doc._source['@datatype'].base;
        if (base === 'object') {
          return transformObjectHit(doc, config, currentYear);
        } else if (base === 'agent') {
          return transformPersonHit(doc, config, currentYear);
        }
        return null;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Anniversary override fetch error:', err.message || err);
    return [];
  }
}

// --- Transform helpers ---

function transformObjectHit (hit, config, currentYear) {
  var source = hit._source || {};
  var id = hit._id || (source['@admin'] && source['@admin'].uid) || '';
  var title = getTitle(source);
  var titleSlug = slug(title || '').toLowerCase();
  var type = 'objects';

  var creationDate = getCreationDate(source);
  var yearsAgo = creationDate ? currentYear - parseInt(creationDate, 10) : null;
  var makerInfo = getMakerInfo(source);

  var milestoneLabel = yearsAgo
    ? yearsAgo + ' years ago'
    : widgetConfig.objects.sectionTitle;

  var subtitle = '';
  if (makerInfo.role && makerInfo.name) {
    subtitle = capitaliseFirst(makerInfo.role) + ' by ' + makerInfo.name;
    if (creationDate) subtitle += ', ' + creationDate;
  } else if (creationDate) {
    subtitle = creationDate;
  }

  return {
    id: id,
    type: type,
    title: title || 'Untitled object',
    link: (config.rootUrl || '') + '/' + type + '/' + id + (titleSlug ? '/' + titleSlug : ''),
    figure: getImage(source, config),
    milestoneLabel: milestoneLabel,
    subtitle: subtitle,
    yearsAgo: yearsAgo,
    year: creationDate,
    label: milestoneLabel + ' — ' + (title || 'Untitled object')
  };
}

function transformPersonHit (hit, config, currentYear) {
  var source = hit._source || {};
  var id = hit._id || (source['@admin'] && source['@admin'].uid) || '';
  var title = getTitle(source);
  var titleSlug = slug(title || '').toLowerCase();
  var type = 'people';

  var birthYear = getBirthYear(source);
  var yearsAgo = birthYear ? currentYear - parseInt(birthYear, 10) : null;
  var entityType = source['@datatype'] && source['@datatype'].actual;
  var isOrganisation = entityType === 'organisation';

  var cfg = widgetConfig.people;
  var labelTemplate = isOrganisation ? cfg.organisationLabel : cfg.personLabel;
  var milestoneLabel = birthYear
    ? labelTemplate.replace('{year}', birthYear)
    : cfg.sectionTitle;

  var occupation = getOccupation(source);
  var figcaption = getBriefBiography(source);

  return {
    id: id,
    type: type,
    title: title || 'Unknown person',
    link: (config.rootUrl || '') + '/' + type + '/' + id + (titleSlug ? '/' + titleSlug : ''),
    figure: getImage(source, config),
    figcaption: figcaption,
    milestoneLabel: milestoneLabel,
    subtitle: occupation,
    yearsAgo: yearsAgo,
    birthYear: birthYear,
    entityType: entityType || 'person',
    label: milestoneLabel + ' — ' + (title || 'Unknown person')
  };
}

// --- Field extraction helpers ---

function getTitle (source) {
  var summary = source.summary;
  if (summary && summary.title) return summary.title;

  var name = source.name;
  if (!name) return null;
  if (Array.isArray(name)) {
    var primary = name.find(function (n) { return n.primary; });
    return primary ? primary.value : (name[0] && name[0].value);
  }
  if (name.value) return name.value;
  return null;
}

function getCreationDate (source) {
  var creation = source.creation;
  if (!creation) return null;

  var dates = creation.date;
  if (!dates) return null;

  if (Array.isArray(dates)) {
    var first = dates[0];
    return first && first.from;
  }
  return dates.from;
}

function getMakerInfo (source) {
  var creation = source.creation;
  if (!creation || !creation.maker) return { role: null, name: null };

  var makers = Array.isArray(creation.maker) ? creation.maker : [creation.maker];
  var first = makers[0];
  if (!first) return { role: null, name: null };

  var link = first['@link'] || {};
  var roles = link.role;
  var role = null;
  if (Array.isArray(roles) && roles.length > 0) {
    role = roles[0].value;
  } else if (roles && roles.value) {
    role = roles.value;
  }

  var name = null;
  var summary = link.summary || first.summary;
  if (summary && summary.title) {
    name = summary.title;
  }

  return { role: role || 'made', name: name };
}

function getBirthYear (source) {
  var birth = source.birth;
  if (!birth || !birth.date) return null;

  if (birth.date.from) return birth.date.from;
  if (birth.date.value) {
    var match = birth.date.value.match(/^(\d{4})/);
    return match ? match[1] : null;
  }
  return null;
}

function getBriefBiography (source) {
  var desc = source.description;
  if (!desc || !Array.isArray(desc)) return null;
  var bio = desc.find(function (d) { return d.type === 'brief biography'; });
  return bio ? bio.value : null;
}

function getOccupation (source) {
  var occ = source.occupation;
  if (!occ) return null;
  if (Array.isArray(occ)) {
    return occ[0] && occ[0].value;
  }
  return occ.value || null;
}

function getImage (source, config) {
  var multimedia = source.multimedia;
  if (!multimedia) return null;

  // multimedia is an array in the ES schema
  var first = Array.isArray(multimedia) ? multimedia[0] : multimedia;
  if (!first) return null;

  var processed = first['@processed'];
  if (!processed) return null;

  // The codebase uses large_thumbnail for card images
  var thumb = processed.large_thumbnail || processed.large;
  if (!thumb || !thumb.location) return null;

  var mediaPath = (config && config.mediaPath) || '';
  return mediaPath + thumb.location;
}

function getDaySuffixes (date, dayRange) {
  var suffixes = [];
  for (var offset = -dayRange; offset <= dayRange; offset++) {
    var d = new Date(date);
    d.setDate(d.getDate() + offset);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    suffixes.push('-' + mm + '-' + dd);
  }
  return suffixes;
}

function capitaliseFirst (str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
