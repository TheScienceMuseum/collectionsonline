const test = require('tape');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const jsonEscape = require('../lib/helpers/json-escape');

const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

Handlebars.registerHelper('jsonEscape', jsonEscape);

const templateSource = fs.readFileSync(
  path.join(__dirname, '/../templates/iiif/iiifmanifest.json'),
  'utf8'
);
const iiifTemplate = Handlebars.compile(templateSource);

function buildContext (overrides) {
  const base = {
    self: 'http://example.com/iiif/objects/co8085283',
    data: {
      attributes: {
        summary: { title: 'A title' },
        description: [{ value: 'A description' }],
        identifier: [{ value: 'INV-1' }],
        lifecycle: { creation: [] }
      },
      links: { self: 'http://example.com/objects/co8085283' }
    },
    media: [
      {
        large_thumbnail: { location: 'http://example.com/thumb.jpg' },
        zoom: { location: 'http://example.com/iiif/img1' },
        large: { measurements: { dimensions: [{ value: 480 }, { value: 640 }] } },
        source: { title: [{ value: 'Image label' }] }
      }
    ]
  };
  return Object.assign(base, overrides || {});
}

test(file + 'jsonEscape helper escapes control characters', (t) => {
  t.equal(jsonEscape('line1\nline2').toString(), 'line1\\nline2', 'newline escaped');
  t.equal(jsonEscape('tab\there').toString(), 'tab\\there', 'tab escaped');
  t.equal(jsonEscape('quote"inside').toString(), 'quote\\"inside', 'double-quote escaped');
  t.equal(jsonEscape('back\\slash').toString(), 'back\\\\slash', 'backslash escaped');
  t.equal(jsonEscape('bellhere').toString(), 'bell\\u0007here', 'unicode control escaped');
  t.equal(jsonEscape(null).toString(), '', 'null becomes empty string');
  t.equal(jsonEscape(undefined).toString(), '', 'undefined becomes empty string');
  t.end();
});

test(file + 'rendered manifest is valid JSON when title contains a newline', (t) => {
  const ctx = buildContext();
  ctx.data.attributes.summary.title = 'Stephenson Rocket\nReplica';
  const rendered = iiifTemplate(ctx);
  const parsed = JSON.parse(rendered);
  t.equal(parsed.label, 'Stephenson Rocket\nReplica', 'newline preserved in parsed value');
  t.end();
});

test(file + 'rendered manifest is valid JSON when description contains tabs and newlines', (t) => {
  const ctx = buildContext();
  ctx.data.attributes.description[0].value =
    'Multi-line\ndescription\twith\ttabs\nand returns\r\nhere.';
  const rendered = iiifTemplate(ctx);
  const parsed = JSON.parse(rendered);
  t.equal(
    parsed.description,
    'Multi-line\ndescription\twith\ttabs\nand returns\r\nhere.',
    'control characters survive round-trip'
  );
  t.end();
});

test(file + 'rendered manifest is valid JSON when a string contains a literal double quote', (t) => {
  const ctx = buildContext();
  ctx.data.attributes.summary.title = 'The "Rocket" locomotive';
  const rendered = iiifTemplate(ctx);
  const parsed = JSON.parse(rendered);
  t.equal(parsed.label, 'The "Rocket" locomotive', 'embedded quotes preserved');
  t.end();
});

test(file + 'rendered manifest is valid JSON for the place-made and date-made fields', (t) => {
  const ctx = buildContext();
  ctx.data.attributes.lifecycle.creation = [
    {
      date: [{ value: '1829\tcirca' }],
      places: [{ summary_title: 'Newcastle\nupon\nTyne' }]
    }
  ];
  const rendered = iiifTemplate(ctx);
  const parsed = JSON.parse(rendered);
  const dateEntry = parsed.metadata.find((m) => m.label === 'Date made');
  const placeEntry = parsed.metadata.find((m) => m.label === 'Place made');
  t.equal(dateEntry.value, '1829\tcirca', 'tab in date value preserved');
  t.equal(placeEntry.value, 'Newcastle\nupon\nTyne', 'newlines in place name preserved');
  t.end();
});

test(file + 'rendered manifest is valid JSON when image label has control chars', (t) => {
  const ctx = buildContext();
  ctx.media[0].source.title[0].value = 'Front view\nof the engine';
  const rendered = iiifTemplate(ctx);
  const parsed = JSON.parse(rendered);
  const canvas = parsed.sequences[0].canvases[0];
  const imageLabel = canvas.images[0].resource.label;
  t.equal(imageLabel, 'Front view\nof the engine', 'newline preserved in image label');
  t.end();
});
