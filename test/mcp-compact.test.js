'use strict';

const test = require('tape');
const { compactHit, compactRecord, flattenEntries, plainText } = require('../lib/mcp/compact');
const { upward } = require('../lib/mcp/hierarchy');

const file = require('path').relative(process.cwd(), __filename) + ' > ';
const config = { rootUrl: 'https://collection.example', mediaPath: 'https://media.example/' };

const objectSource = {
  '@admin': { uid: 'co1', source: 'Mimsy XG', id: 'object-1', uuid: 'secret-uuid', processed: 1791935435511, added: 1699633188919 },
  '@datatype': { base: 'object' },
  summary: { title: 'Steam engine' },
  title: [{ type: 'catalogue title', value: 'Steam engine', primary: true }],
  description: [
    { type: 'catalogue description', value: 'Catalogue text' },
    { type: 'web description', value: '<p>Built in <b>1811</b> &amp; used until 1879.</p>' }
  ],
  creation: {
    date: [{ value: '1811', from: '1811', to: '1811' }],
    maker: [
      { summary: { title: 'Trevithick, Richard' }, '@admin': { uid: 'cp1' }, '@entity': 'reference' },
      { summary: { title: 'Richard Trevithick' }, '@entity': 'literal' }
    ]
  },
  category: [{ name: 'Motive Power' }],
  ondisplay: [
    { type: 'name', value: 'Science Museum, Energy Hall', primary: true },
    { type: 'gallery', value: 'Energy Hall' },
    { type: 'museum', value: 'Science Museum' }
  ],
  facility: [{ summary: { title: 'CASE-07' }, name: [{ value: 'Science Museum, Energy Hall' }] }],
  multimedia: [{
    '@processed': { large_thumbnail: { location: '1/2/thumb.jpg' } },
    legal: { rights: [{ licence: 'CC-BY-NC-SA 4.0', copyright: '© Someone' }] }
  }],
  enhancement: { analytics: { current: { cumulative_views: 1234 } } }
};

test(file + 'compactHit picks a small allow-listed shape', (t) => {
  const hit = compactHit({ _id: 'co1', _source: objectSource }, config);
  t.equal(hit.id, 'co1');
  t.equal(hit.type, 'objects');
  t.equal(hit.title, 'Steam engine');
  t.equal(hit.url, 'https://collection.example/objects/co1');
  t.equal(hit.summary, 'Built in 1811 & used until 1879.', 'prefers the web description, as plain text');
  t.deepEqual(hit.makers, [{ name: 'Trevithick, Richard', id: 'cp1' }], 'linked makers only; literal auto-copies dropped');
  t.deepEqual(hit.on_display, { museum: 'Science Museum', gallery: 'Energy Hall' });
  t.equal(hit.thumbnail, 'https://media.example/1/2/thumb.jpg');
  t.equal(hit.image_licence, 'CC BY-NC-SA 4.0', 'licence variant shown under its canonical name');
  t.equal(hit.page_views, 1234);
  const s = JSON.stringify(hit);
  t.notOk(s.includes('CASE-07'), 'no facility case codes');
  t.notOk(s.includes('secret-uuid'), 'no @admin internals');
  t.end();
});

test(file + 'compactHit handles people and archive documents', (t) => {
  const person = compactHit({
    _source: {
      '@admin': { uid: 'cp9', source: 'Mimsy XG' },
      '@datatype': { base: 'agent', actual: 'person' },
      summary: { title: 'Ada Lovelace' },
      occupation: { value: ['mathematician', 'writer'] },
      birth: { date: { from: '1815', value: '1815' } },
      description: [{ type: 'brief biography', value: '1815-1852, mathematician' }]
    }
  }, config);
  t.equal(person.type, 'people');
  t.equal(person.title, 'Ada Lovelace');
  t.equal(person.occupation, 'mathematician, writer');
  t.equal(person.person_or_organisation, 'person');
  t.equal(person.summary, '1815-1852, mathematician');

  const doc = compactHit({
    _source: {
      '@admin': { uid: 'aa2' },
      '@datatype': { base: 'archive' },
      summary: { title: 'Letter' },
      level: { value: 'item' },
      fonds: [{ summary: { title: 'Babbage Papers' }, '@admin': { uid: 'aa1' } }]
    }
  }, config);
  t.equal(doc.level, 'item');
  t.deepEqual(doc.archive, { id: 'aa1', title: 'Babbage Papers' });
  t.end();
});

test(file + 'compactRecord flattens page data and drops links and internal paths', (t) => {
  const page = {
    uid: 'aa5',
    type: 'documents',
    title: 'Finding aid',
    links: { self: 'https://collection.example/documents/aa5/finding-aid' },
    system: { key: 'system', value: 'AdLib' },
    identifier: 'BAB',
    date: '1821-1905',
    description: { primary: { initialDescription: ['<p>Papers</p>'], moreDescription: ['More'] } },
    fact: [
      { key: 'Made', place: [{ value: 'London', link: '/search/places/london' }], date: { value: '1821', link: '/x' } },
      { key: 'maker', makers: [{ value: 'Babbage, Charles', link: 'https://collection.example/people/ap8' }] }
    ],
    details: [
      { key: 'Extent', value: '11 drawers' },
      { key: 'Materials', value: [{ value: ['brass'], link: ['/m/brass'] }, { value: ['glass'], link: ['/m/glass'] }] },
      { key: 'Finding aid', value: '\\\\fileserver\\Documents\\aid.pdf' }
    ],
    displayLocation: null,
    images: [{ large: 'L', thumb: 'T', zoom: 'Z', credit: 'SMG', rights: { licence: 'CC BY-NC-SA 4.0', details: '© SMG' } }],
    wikidata: null
  };
  const record = compactRecord(page, { level: { value: 'fonds' }, '@admin': { added: 0, processed: 1791935435511 } });
  t.equal(record.level, 'fonds');
  t.equal(record.description, 'Papers\n\nMore');
  t.deepEqual(record.makers, [{ name: 'Babbage, Charles', role: 'maker', id: 'ap8' }]);
  t.deepEqual(record.facts, [{ label: 'Made', value: 'London, 1821' }], 'maker fact moved to makers');
  t.deepEqual(record.details, [{ label: 'Extent', value: '11 drawers' }, { label: 'Materials', value: 'brass, glass' }], 'file-share path dropped');
  t.deepEqual(record.images, [{ large: 'L', thumbnail: 'T', iiif: 'Z', licence: 'CC BY-NC-SA 4.0', copyright: '© SMG', credit: 'SMG' }]);
  t.equal(record.last_republished, '2026-10-13');
  t.notOk(JSON.stringify(record).includes('/search/places'), 'no site links');
  t.end();
});

test(file + 'helpers', (t) => {
  t.equal(plainText('a<br>b &lt;c&gt;'), 'a\nb <c>');
  t.deepEqual(flattenEntries([{ key: 'x', value: '' }, { value: 'no label' }]), [], 'empty entries dropped');
  t.end();
});

test(file + 'upward: parent, top-level object and groups of a component part', (t) => {
  const up = upward('co8352702', {
    grouping: [
      { '@admin': { uid: 'co25571' }, '@link': { type: 'SPH' }, summary: { title: 'Town coach' } },
      { '@admin': { uid: 'c83918' }, '@link': { type: 'MG' }, summary: { title: 'Hawking Building Freestanding Grid' } }
    ],
    parent: [{ '@admin': { uid: 'co25571' }, summary: { title: 'Town coach' } }],
    '@hierarchy': [[
      { '@admin': { uid: 'co25571' }, summary: { title: 'Town coach' } },
      { '@admin': { uid: 'co8352702' }, summary: { title: 'Town coach part' } }
    ]]
  });
  t.deepEqual(up.parent, { id: 'co25571', title: 'Town coach', relationship: 'this record is a component part of it' });
  t.deepEqual(up.top_level, { id: 'co25571', title: 'Town coach' });
  t.deepEqual(up.groups, [{ id: 'c83918', title: 'Hawking Building Freestanding Grid' }]);
  t.end();
});

test(file + 'upward: archive path keeps levels and the fonds', (t) => {
  const up = upward('aa3', {
    parent: [{ '@admin': { uid: 'aa2' }, summary: { title: 'Series A' } }],
    fonds: [{ '@admin': { uid: 'aa1' }, summary: { title: 'Babbage Papers' } }],
    '@hierarchy': [[
      { '@admin': { uid: 'aa1' }, summary: { title: 'Babbage Papers' }, level: 'fonds' },
      { '@admin': { uid: 'aa2' }, summary: { title: 'Series A' }, level: 'series' },
      { '@admin': { uid: 'aa3' }, summary: { title: 'Item' }, level: 'item' }
    ]]
  });
  t.deepEqual(up.path_from_top, [
    { id: 'aa1', title: 'Babbage Papers', level: 'fonds' },
    { id: 'aa2', title: 'Series A', level: 'series' }
  ]);
  t.deepEqual(up.archive, { id: 'aa1', title: 'Babbage Papers' });
  t.end();
});

test(file + 'values that end in their own separator are not doubled', (t) => {
  const entries = flattenEntries([
    { key: 'occupation', value: [{ value: 'Computer pioneer,', link: '/x' }, { value: 'Mathematician' }] },
    { key: 'Nationality', value: 'English; British' }
  ]);
  t.deepEqual(entries, [
    { label: 'occupation', value: 'Computer pioneer, Mathematician' },
    { label: 'Nationality', value: 'English; British' }
  ]);
  t.end();
});

test(file + 'long descriptions such as full biographies are returned whole', (t) => {
  const text = 'Babbage '.repeat(625).trim();
  const record = compactRecord({
    uid: 'cp1',
    type: 'people',
    title: 'Charles Babbage',
    links: { self: 'https://collection.example/people/cp1' },
    description: { primary: { initialDescription: [text] } }
  }, {});
  t.ok(text.length > 4000, 'longer than the old 4,000 character limit');
  t.equal(record.description, text);
  t.notOk(record.description_truncated);
  t.end();
});
