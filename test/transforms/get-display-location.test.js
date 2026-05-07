const test = require('tape');
const getValues = require('../../lib/transforms/get-values');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

// ---------------------------------------------------------------------------
// getDisplayLocation() / getDisplayLocations() unit tests
//
// Reproduces the production `ciim` ES index shape that previously broke the
// "On display" panel for ~22k object records: facility[0]['@hierarchy'] is a
// nested array of bare {summary, @admin} objects with no @datatype tags, so
// the legacy facility-walking implementation could never set display.museum.
//
// The current implementation reads `attributes.ondisplay`, which has a stable
// flat [{type,value}] shape across both indexes.
// ---------------------------------------------------------------------------

// Mirrors a real ciim record (co499537 — Vickers Vimy biplane in Flight Gallery).
function ciimShapedRecord () {
  return {
    attributes: {
      ondisplay: [
        { type: 'name', value: 'Science Museum, Flight Gallery', primary: true },
        { type: 'gallery', value: 'Flight Gallery' },
        { type: 'museum', value: 'Science Museum' }
      ],
      facility: [{
        summary: { title: 'FS01' },
        name: [
          { type: 'name', value: 'Science Museum, Flight Gallery', primary: true },
          { type: 'gallery', value: 'Flight Gallery' },
          { type: 'museum', value: 'Science Museum' }
        ],
        // ciim shape: nested array of objects with only summary.title +
        // @admin — no @datatype, no top-level name array.
        '@hierarchy': [[
          { summary: { title: 'Science Museum' }, '@admin': { id: 'facility-103' } },
          { summary: { title: 'Third Floor' }, '@admin': { id: 'facility-168778' } },
          { summary: { title: 'Flight Gallery' }, '@admin': { id: 'facility-170168' } },
          { summary: { title: 'FS01' }, '@admin': { id: 'facility-170197' } }
        ]],
        '@entity': 'reference',
        primary: true
      }]
    }
  };
}

test(file + 'getDisplayLocation: ciim-shaped record returns museum + gallery + link', (t) => {
  t.plan(4);
  const result = getValues.getDisplayLocation(ciimShapedRecord());
  t.equal(result.museum, 'Science Museum', 'museum populated from ondisplay');
  t.equal(result.gallery, 'Flight Gallery', 'gallery populated from ondisplay');
  t.equal(
    result.link,
    '/search/gallery/flight-gallery/museum/science-museum',
    'link includes both gallery and museum filters'
  );
  t.notOk(
    result.museum.includes('FS01') || result.gallery.includes('Third Floor'),
    'no leakage from facility hierarchy levels'
  );
});

test(file + 'getDisplayLocation: museum-name remap applied (National Media Museum)', (t) => {
  t.plan(1);
  const data = {
    attributes: {
      ondisplay: [
        { type: 'gallery', value: 'Wonderlab' },
        { type: 'museum', value: 'National Media Museum' }
      ]
    }
  };
  t.equal(
    getValues.getDisplayLocation(data).museum,
    'National Science and Media Museum',
    'legacy museum name renamed for display'
  );
});

test(file + 'getDisplayLocation: missing ondisplay returns null', (t) => {
  t.plan(2);
  t.equal(getValues.getDisplayLocation({ attributes: {} }), null, 'no ondisplay → null');
  t.equal(
    getValues.getDisplayLocation({ attributes: { ondisplay: [] } }),
    null,
    'empty ondisplay → null'
  );
});

test(file + 'getDisplayLocation: ondisplay without museum entry returns null', (t) => {
  t.plan(1);
  // gallery alone shouldn't render a panel — display.museum is the gate
  const data = { attributes: { ondisplay: [{ type: 'gallery', value: 'Foo' }] } };
  t.equal(getValues.getDisplayLocation(data), null, 'no museum entry → null');
});

test(file + 'getDisplayLocations: aggregates parent + children, dedupes', (t) => {
  t.plan(2);
  // SPH/MPH parent with no ondisplay of its own (e.g. co30141), children carry it
  const railwayChild = {
    data: {
      attributes: {
        ondisplay: [
          { type: 'gallery', value: 'Station Hall' },
          { type: 'museum', value: 'National Railway Museum' }
        ]
      }
    }
  };
  const data = {
    attributes: {},
    children: [
      { data: ciimShapedRecord() },
      { data: ciimShapedRecord() },
      railwayChild
    ]
  };
  const result = getValues.getDisplayLocations(data);
  t.equal(result.length, 2, 'two distinct museum/gallery pairs after dedupe');
  t.deepEqual(
    result.map(l => `${l.museum} / ${l.gallery}`).sort(),
    ['National Railway Museum / Station Hall', 'Science Museum / Flight Gallery'],
    'correct museum/gallery pairs'
  );
});
