const test = require('tape');
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

// makerFilterValue drives the "See more related objects/documents" links on
// person pages. It must use the indexed name (summary.title), not the display
// title — AdLib people display as "Charles Babbage" but are indexed as makers
// under "Babbage, Charles".

function makeResource (id, source, summaryTitle, name) {
  return {
    data: {
      type: 'people',
      id,
      attributes: {
        summary: { title: summaryTitle },
        name,
        '@admin': { uid: id, source }
      },
      links: { root: '', self: '' },
      relationships: {}
    }
  };
}

test(file + 'AdLib person uses the indexed "Last, First" name', (t) => {
  t.plan(2);
  const html = buildHTMLData(makeResource('ap8', 'Adlib Archives', 'Babbage, Charles', [
    { first: ['Charles'], last: 'Babbage', value: 'Babbage, Charles' }
  ]));
  t.equal(html.title, 'Charles Babbage', 'title is in display order');
  t.equal(html.makerFilterValue, 'babbage%252c-charles', 'makerFilterValue is the encoded indexed name');
});

test(file + 'Mimsy person uses summary.title', (t) => {
  t.plan(1);
  const html = buildHTMLData(makeResource('cp36993', 'Mimsy XG', 'Charles Babbage', [
    { value: 'Babbage, Charles', type: 'preferred name', primary: true }
  ]));
  t.equal(html.makerFilterValue, 'charles-babbage', 'makerFilterValue is the encoded summary.title');
});
