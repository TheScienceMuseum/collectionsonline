'use strict';

const test = require('tape');
const { buildFilter } = require('../lib/mcp/query/filters');

const file = require('path').relative(process.cwd(), __filename) + ' > ';
const json = (v) => JSON.stringify(v);
const SPH = { term: { 'grouping.@link.type': 'SPH' } };

test(file + 'type maps to @datatype.base, including group (not mgroup)', (t) => {
  t.deepEqual(buildFilter({ type: 'objects' }).query.bool.filter[0], { term: { '@datatype.base': 'object' } });
  t.deepEqual(buildFilter({ type: 'people' }).query.bool.filter[0], { term: { '@datatype.base': 'agent' } });
  t.deepEqual(buildFilter({ type: 'documents' }).query.bool.filter[0], { term: { '@datatype.base': 'archive' } });
  t.deepEqual(buildFilter({ type: 'group' }).query.bool.filter[0], { term: { '@datatype.base': 'group' } });
  t.deepEqual(buildFilter({ type: 'all' }).query.bool.filter[0], { terms: { '@datatype.base': ['object', 'agent', 'archive'] } }, 'all excludes groups, like the website');
  t.throws(() => buildFilter({ type: 'things' }), /Unknown type/);
  t.end();
});

test(file + 'component parts are excluded by default, included for parent_id / group_id', (t) => {
  t.ok(json(buildFilter({ type: 'objects' }).query.bool.must_not).includes(json(SPH)), 'excluded by default');
  t.notOk(buildFilter({ type: 'objects', parent_id: 'co50985' }).query.bool.must_not, 'included for parent_id');
  t.notOk(buildFilter({ type: 'objects', group_id: 'c83918' }).query.bool.must_not, 'included for group_id');
  t.notOk(buildFilter({ type: 'objects', include_component_parts: true }).query.bool.must_not, 'included on request');
  t.ok(json(buildFilter({ type: 'objects', parent_id: 'co1', include_component_parts: false }).query.bool.must_not).includes(json(SPH)), 'explicit false wins');
  t.equal(buildFilter({ type: 'objects', parent_id: 'CO1' }).applied.parent_id, 'CO1');
  t.ok(json(buildFilter({ type: 'objects', parent_id: 'CO1' }).query).includes('"parent.@admin.uid":"co1"'), 'ids are lowercased');
  t.end();
});

test(file + 'museum resolves names, short codes and legacy aliases', (t) => {
  const nrm = buildFilter({ type: 'objects', museum: 'nrm' });
  t.equal(nrm.applied.museum, 'National Railway Museum');
  t.ok(json(nrm.query).includes('"value":"National Railway Museum"'));
  t.ok(json(nrm.query).includes('"value":"Railway Museum"'), 'legacy alias matched too');
  t.equal(buildFilter({ type: 'objects', museum: 'Museum of Science and Industry' }).applied.museum, 'Science and Industry Museum');
  t.throws(() => buildFilter({ type: 'objects', museum: 'British Museum' }), /Unknown museum/);
  t.end();
});

test(file + 'gallery and museum combine; on_display uses ondisplay', (t) => {
  const { query } = buildFilter({ type: 'objects', museum: 'Science Museum', gallery: 'Flight Gallery' });
  const s = json(query);
  t.ok(s.includes('{"term":{"ondisplay.value.keyword":{"value":"Flight Gallery","case_insensitive":true}}}'), 'gallery term');
  t.ok(s.includes('"value":"Science Museum"'), 'museum term kept alongside gallery');
  t.ok(json(buildFilter({ type: 'objects', on_display: true }).query.bool.filter).includes('"exists":{"field":"ondisplay.value.keyword"}'));
  t.ok(json(buildFilter({ type: 'objects', on_display: false }).query.bool.must_not).includes('"exists":{"field":"ondisplay.value.keyword"}'));
  t.end();
});

test(file + 'image filters: has_image, licence value, variants, none and any', (t) => {
  t.ok(json(buildFilter({ type: 'objects', has_image: false }).query.bool.must_not).includes('multimedia.@admin.source'));

  const sa = buildFilter({ type: 'objects', image_licence: 'by-nc-sa' });
  t.equal(sa.applied.image_licence, 'CC BY-NC-SA 4.0');
  t.ok(json(sa.query).includes('"value":"CC BY-NC-SA 4.0"'));
  t.ok(json(sa.query).includes('"value":"CC-BY-NC-SA 4.0"'), 'hyphenated variant matched too');

  const none = buildFilter({ type: 'objects', image_licence: 'none' });
  t.ok(json(none.query.bool.filter).includes('multimedia.@admin.source'), 'none = has an image…');
  t.ok(json(none.query.bool.must_not).includes('multimedia.legal.rights.licence'), '…without a licence');

  t.ok(json(buildFilter({ type: 'objects', image_licence: 'any' }).query.bool.filter).includes('"exists":{"field":"multimedia.legal.rights.licence"}'));
  t.ok(json(buildFilter({ type: 'objects', image_licence: 'Rights Managed' }).query).includes('"value":"Rights Managed"'), 'unknown licences matched as given');
  t.end();
});

test(file + 'term filters use the normalised or case-insensitive fields', (t) => {
  const s = json(buildFilter({ type: 'objects', maker: 'Babbage, Charles', category: 'space technology', material: 'Brass' }).query);
  t.ok(s.includes('"creation.maker.summary.title.lower":"babbage, charles"'), 'maker keeps its comma');
  t.ok(s.includes('{"category.name.keyword":{"value":"space technology","case_insensitive":true}}'));
  t.ok(s.includes('{"material.value.keyword":{"value":"Brass","case_insensitive":true}}'));
  t.end();
});

test(file + 'year ranges are "fully within" and handle a missing end date', (t) => {
  const { query } = buildFilter({ type: 'objects', made_from: 1960, made_to: 1969 });
  const s = json(query);
  t.ok(s.includes('{"range":{"creation.date.from":{"gte":"1960","format":"yyyy"}}}'));
  t.ok(s.includes('{"range":{"creation.date.to":{"lte":"1969||/y","format":"yyyy"}}}'));
  t.ok(s.includes('"must_not":[{"exists":{"field":"creation.date.to"}}]'), 'falls back to the start date when there is no end date');
  t.end();
});

test(file + 'admin date ranges accept partial dates and date math, inclusive upper bounds', (t) => {
  t.deepEqual(
    buildFilter({ type: 'all', republished_from: 'now-1M/M', republished_to: 'now-1M/M' }).query.bool.filter[1],
    { range: { '@admin.processed': { gte: 'now-1M/M', lte: 'now-1M/M' } } }
  );
  t.deepEqual(
    buildFilter({ type: 'all', added_from: '2026-09', added_to: '2026-09-30' }).query.bool.filter[1],
    { range: { '@admin.added': { gte: '2026-09', lte: '2026-09-30||/d' } } }
  );
  t.throws(() => buildFilter({ type: 'all', added_from: 'last month' }), /added_from must be/);
  t.end();
});
