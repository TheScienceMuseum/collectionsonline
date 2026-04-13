'use strict';

const adminAuth = require('../lib/ai/admin-auth');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const extractPersonData = require('../lib/ai/extract-person-data');
const generateBiography = require('../lib/ai/generate-biography');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const TypeMapping = require('../lib/type-mapping');
const normaliseWikidata = require('../lib/helpers/normalise-wikidata');

function redirectToLogin (h) {
  return h.redirect('/admin/ai/login');
}

function requireAuth (request, h, config) {
  if (!adminAuth.validateAdminToken(request, config)) {
    return redirectToLogin(h);
  }
  return null;
}

module.exports = function (elastic, config) {
  return [
    // Login page
    {
      method: 'GET',
      path: '/admin/ai/login',
      config: {
        auth: false,
        handler: function (request, h) {
          return h.view('admin-login', {
            error: request.query.error || null
          }, { layout: 'admin' });
        }
      }
    },

    // Login POST
    {
      method: 'POST',
      path: '/admin/ai/login',
      config: {
        auth: false,
        handler: function (request, h) {
          const token = request.payload && request.payload.token;
          if (!adminAuth.isValidToken(token, config)) {
            return h.redirect('/admin/ai/login?error=invalid');
          }
          const isProduction = config.NODE_ENV === 'production';
          const response = h.redirect('/admin/ai');
          adminAuth.setAdminCookie(response, token, isProduction);
          return response;
        }
      }
    },

    // List biographies
    {
      method: 'GET',
      path: '/admin/ai',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const status = request.query.status || 'all';
          const search = (request.query.search || '').trim();
          const limit = parseInt(request.query.limit, 10) || 25;
          const lastKey = request.query.lastKey
            ? JSON.parse(decodeURIComponent(request.query.lastKey))
            : null;

          if (!dynamo.isReady()) {
            return h.view('admin-ai-list', {
              records: [],
              dynamoUnavailable: true,
              currentStatus: status,
              search,
              nextKey: null
            }, { layout: 'admin' });
          }

          // Direct lookup by record ID
          if (search && /^[a-z]{2}\d+$/i.test(search)) {
            try {
              const record = await biographyStore.fetchBiographyAny(search);
              return h.view('admin-ai-list', {
                records: record ? [record] : [],
                dynamoUnavailable: false,
                currentStatus: status,
                search,
                nextKey: null
              }, { layout: 'admin' });
            } catch (err) {
              console.error('Admin AI search error:', err.message);
              return h.view('admin-ai-list', {
                records: [],
                dynamoUnavailable: false,
                currentStatus: status,
                search,
                nextKey: null,
                error: err.message
              }, { layout: 'admin' });
            }
          }

          try {
            const result = await biographyStore.listBiographies(status, limit, lastKey);
            return h.view('admin-ai-list', {
              records: result.items,
              dynamoUnavailable: false,
              currentStatus: status,
              search,
              nextKey: result.lastKey ? encodeURIComponent(JSON.stringify(result.lastKey)) : null
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI list error:', err.message);
            return h.view('admin-ai-list', {
              records: [],
              dynamoUnavailable: true,
              currentStatus: status,
              search,
              nextKey: null,
              error: err.message
            }, { layout: 'admin' });
          }
        }
      }
    },

    // Detail view
    {
      method: 'GET',
      path: '/admin/ai/{id}',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;

          try {
            const record = await biographyStore.fetchBiographyAny(id);
            if (!record) {
              return h.view('admin-ai-detail', {
                record: null,
                notFound: true
              }, { layout: 'admin' });
            }
            return h.view('admin-ai-detail', {
              record,
              notFound: false
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI detail error:', err.message);
            return h.response('Error loading record').code(500);
          }
        }
      }
    },

    // Update status
    {
      method: 'POST',
      path: '/admin/ai/{id}/status',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const newStatus = request.payload && request.payload.status;
          const validStatuses = ['live', 'flagged', 'hidden', 'insufficient_data'];

          if (!newStatus || validStatuses.indexOf(newStatus) === -1) {
            return h.redirect('/admin/ai/' + id + '?error=invalid_status');
          }

          try {
            await biographyStore.updateStatus(id, newStatus);
            return h.redirect('/admin/ai/' + id);
          } catch (err) {
            console.error('Admin AI status update error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=update_failed');
          }
        }
      }
    },

    // Regenerate
    {
      method: 'POST',
      path: '/admin/ai/{id}/regenerate',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;

          try {
            const esResult = await elastic.get({
              index: config.elasticIndex || 'ciim',
              id: TypeMapping.toInternal(id)
            });
            const source = esResult.body._source;
            const personData = extractPersonData(source);

            let sortedRelated = { relatedObjects: [], relatedDocuments: [] };
            try {
              const relatedItems = await getRelatedItems(elastic, id);
              sortedRelated = sortRelated(relatedItems, id);
            } catch (err) {
              console.debug('Admin regenerate: Could not fetch related items:', err.message);
            }

            const allItems = flattenRelated(sortedRelated);

            let wikidataContext = null;
            const qCode = normaliseWikidata.getQCode(personData.wikidata);
            if (qCode) {
              try {
                wikidataContext = await fetchWikidataLive(qCode);
              } catch (err) {
                console.debug('Admin regenerate: Wikidata fetch failed:', err.message);
              }
            }

            const result = await generateBiography(personData, allItems, wikidataContext, config.anthropicApiKey);

            if (!result) {
              await biographyStore.saveBiography(id, {
                status: 'insufficient_data',
                skipReason: 'Regeneration returned null',
                personName: personData.name,
                pageUrl: '/people/' + id,
                existingDescriptionChars: personData.descriptionChars
              });
              return h.redirect('/admin/ai/' + id);
            }

            const status = result.confidence === 'low' ? 'insufficient_data' : 'live';
            await biographyStore.saveBiography(id, {
              status,
              personName: personData.name,
              pageUrl: '/people/' + id,
              existingDescriptionChars: personData.descriptionChars,
              biographyHtml: result.biographyHtml,
              contextHtml: result.contextHtml,
              sourcesSummary: result.sourcesSummary,
              model: result.model,
              promptVersion: result.promptVersion,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              prompt: result.prompt,
              systemPrompt: result.systemPrompt,
              references: result.references,
              sources: result.sources,
              skipReason: result.confidence === 'low' ? 'Low confidence on regeneration' : undefined
            });

            return h.redirect('/admin/ai/' + id);
          } catch (err) {
            console.error('Admin AI regenerate error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=regenerate_failed');
          }
        }
      }
    },

    // Delete
    {
      method: 'POST',
      path: '/admin/ai/{id}/delete',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;

          try {
            await biographyStore.deleteBiography(id);
            return h.redirect('/admin/ai');
          } catch (err) {
            console.error('Admin AI delete error:', err.message);
            return h.redirect('/admin/ai?error=delete_failed');
          }
        }
      }
    }
  ];
};

function flattenRelated (sortedRelated) {
  const items = [];
  (sortedRelated.relatedObjects || []).forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      link: item.links ? item.links.self : '/objects/' + item.id,
      type: 'object',
      role: item.role || ''
    });
  });
  (sortedRelated.relatedDocuments || []).forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      link: item.links ? item.links.self : '/documents/' + item.id,
      type: 'document',
      role: item.role || ''
    });
  });
  return items;
}

async function fetchWikidataLive (qCode) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
    '&ids=' + qCode + '&languages=en&props=labels|descriptions|claims|sitelinks&format=json';

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data.entities && data.entities[qCode];
    if (!entity) return null;

    const result = {};
    const desc = entity.descriptions && entity.descriptions.en;
    if (desc) result.description = { value: desc.value };

    const claimProps = {
      P106: 'occupation',
      P27: 'country of citizenship',
      P69: 'educated at',
      P108: 'employer',
      P101: 'field of work',
      P800: 'notable work',
      P166: 'awards received',
      P463: 'member of',
      P1412: 'languages spoken'
    };

    Object.keys(claimProps).forEach(function (prop) {
      const claims = entity.claims && entity.claims[prop];
      if (!claims || !claims.length) return;

      const values = claims.slice(0, 5).map(function (claim) {
        const snak = claim.mainsnak;
        if (!snak || !snak.datavalue) return null;
        if (snak.datavalue.type === 'wikibase-entityid') {
          return snak.datavalue.value.id;
        }
        if (snak.datavalue.type === 'string') {
          return snak.datavalue.value;
        }
        return null;
      }).filter(Boolean);

      if (values.length) {
        result[claimProps[prop]] = { value: values.join(', ') };
      }
    });

    const qCodes = [];
    Object.keys(result).forEach(function (key) {
      if (!result[key] || !result[key].value) return;
      const matches = result[key].value.match(/Q\d+/g);
      if (matches) qCodes.push.apply(qCodes, matches);
    });

    if (qCodes.length > 0) {
      try {
        const labelUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
          '&ids=' + qCodes.slice(0, 50).join('|') + '&languages=en&props=labels&format=json';
        const labelRes = await fetch(labelUrl, { signal: controller.signal });
        if (labelRes.ok) {
          const labelData = await labelRes.json();
          const labels = {};
          Object.keys(labelData.entities || {}).forEach(function (id) {
            const label = labelData.entities[id].labels && labelData.entities[id].labels.en;
            if (label) labels[id] = label.value;
          });
          Object.keys(result).forEach(function (key) {
            if (!result[key] || !result[key].value) return;
            result[key].value = result[key].value.replace(/Q\d+/g, function (q) {
              return labels[q] || q;
            });
          });
        }
      } catch (err) {
        // Label resolution failed — Q-codes remain
      }
    }

    const enwiki = entity.sitelinks && entity.sitelinks.enwiki;
    if (enwiki) {
      result.wikipediaUrl = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(enwiki.title.replace(/ /g, '_'));
    }

    return Object.keys(result).length > 0 ? result : null;
  } finally {
    clearTimeout(timeout);
  }
}
