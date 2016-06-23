const test = require('tape');
const getRelated = require('../../templates/helpers/related.js');
const config = require('../../config');

const relation = {
  type: 'people',
  attributes: {
    role: 'association',
    summary_title: 'Babbage, Charles'
  },
  links: {
    self: config.rootUrl + '/people/smgc-people-36993'
  }
};

const otherRelation = {
  type: 'people',
  attributes: {
    summary_title: 'Royal Astronomical Society'
  },
  links: {
    self: config.rootUrl + '/people/smgc-people-5207'
  }
};

test('Description should be returned as an handlebars object', function (t) {
  t.plan(3);

  const formattedRelation = getRelated(relation);

  t.equal(typeof formattedRelation, 'object', 'formatted description should be a handlebars object');
  t.ok(formattedRelation.string, 'formatted description should have a string property');
  t.ok(formattedRelation.string.indexOf('</a>') > -1, 'formatted string should have an a tag');
  t.end();
});

test('Description should be returned correctly', function (t) {
  t.plan(1);

  const formattedRelation = getRelated(relation);

  t.equal(formattedRelation.string, `<li><a href="${config.rootUrl}/people/smgc-people-36993">Babbage, Charles</a> (association)</li>`, 'formatted string should be correct');
  t.end();
});

test('If no role, nothing should be rendered in that space', function (t) {
  t.plan(1);

  const formattedRelation = getRelated(otherRelation);

  t.equal(formattedRelation.string, `<li><a href="${config.rootUrl}/people/smgc-people-5207">Royal Astronomical Society</a> </li>`, 'formatted string should be correct');
  t.end();
});
