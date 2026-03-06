const test = require('tape');
const sinon = require('sinon');
const getSimilarObjects = require('../lib/get-similar-objects');

// Minimal ES resource shape — matches what elastic.get() returns as result.body
function makeResource (uid, opts) {
  opts = opts || {};
  return {
    _source: {
      '@admin': { uid: uid },
      category: opts.category ? [{ name: opts.category }] : undefined,
      facility: opts.gallery
        ? [{ name: [{ type: 'gallery', value: opts.gallery }] }]
        : undefined
    }
  };
}

// Minimal mock elastic client
function makeElastic (hits) {
  return {
    search: sinon.stub().resolves({ body: { hits: { hits: hits || [] } } })
  };
}

test('getSimilarObjects — returns empty array for excluded UIDs without calling ES', async function (t) {
  // These specific object pages must never show similar items (hardcoded exclusion list)
  const excludedIds = ['co8864597', 'co8864595', 'co8864596'];
  t.plan(excludedIds.length * 2);

  for (const uid of excludedIds) {
    const elastic = makeElastic();
    const result = await getSimilarObjects(makeResource(uid), elastic);
    t.deepEqual(result, [], uid + ' returns empty array');
    t.equal(elastic.search.callCount, 0, uid + ' skips the ES query entirely');
  }

  t.end();
});

test('getSimilarObjects — query excludes the current object from results', async function (t) {
  t.plan(1);
  const uid = 'co12345';
  const elastic = makeElastic();

  await getSimilarObjects(makeResource(uid), elastic);

  const query = elastic.search.firstCall.args[0].body.query.function_score.query;
  const mustNot = query.bool.must_not;
  const excludesSelf = mustNot.some(function (clause) {
    return clause.term && clause.term['@admin.uid'] === uid;
  });
  t.ok(excludesSelf, 'must_not contains a term clause excluding the current object UID');
  t.end();
});

test('getSimilarObjects — query excludes SPH child records from results', async function (t) {
  t.plan(1);
  const elastic = makeElastic();

  await getSimilarObjects(makeResource('co12345'), elastic);

  const query = elastic.search.firstCall.args[0].body.query.function_score.query;
  const mustNot = query.bool.must_not;
  const excludesSPH = mustNot.some(function (clause) {
    return clause.term && clause.term['grouping.@link.type'] === 'SPH';
  });
  t.ok(excludesSPH, 'must_not contains a term clause excluding SPH grouping type');
  t.end();
});

test('getSimilarObjects — adds category term to should clause when resource has a category', async function (t) {
  t.plan(1);
  const elastic = makeElastic();

  await getSimilarObjects(makeResource('co12345', { category: 'Locomotives' }), elastic);

  const shouldClauses = elastic.search.firstCall.args[0].body.query.function_score.query.bool.should;
  const hasCategoryTerm = shouldClauses.some(function (clause) {
    return clause.term && clause.term['category.name.keyword'] === 'Locomotives';
  });
  t.ok(hasCategoryTerm, 'should clause includes a term for the resource category');
  t.end();
});

test('getSimilarObjects — adds gallery term to should clause when resource has a gallery', async function (t) {
  t.plan(1);
  const elastic = makeElastic();

  await getSimilarObjects(makeResource('co12345', { gallery: 'Space Gallery' }), elastic);

  const shouldClauses = elastic.search.firstCall.args[0].body.query.function_score.query.bool.should;
  const hasGalleryTerm = shouldClauses.some(function (clause) {
    return clause.term && clause.term['facility.name.value.keyword'] === 'Space Gallery';
  });
  t.ok(hasGalleryTerm, 'should clause includes a term for the resource gallery');
  t.end();
});

test('getSimilarObjects — should clause is empty when resource has no category and no gallery', async function (t) {
  t.plan(1);
  const elastic = makeElastic();

  await getSimilarObjects(makeResource('co12345'), elastic);

  const shouldClauses = elastic.search.firstCall.args[0].body.query.function_score.query.bool.should;
  t.deepEqual(shouldClauses, [], 'should array is empty when no category or gallery present');
  t.end();
});

test('getSimilarObjects — query requests at most 6 results', async function (t) {
  t.plan(1);
  const elastic = makeElastic();

  await getSimilarObjects(makeResource('co12345'), elastic);

  const size = elastic.search.firstCall.args[0].body.size;
  t.equal(size, 6, 'query size is 6');
  t.end();
});

test('getSimilarObjects — returns the hits array from the ES response', async function (t) {
  t.plan(1);
  const fakeHits = [{ _id: 'co111' }, { _id: 'co222' }];
  const elastic = makeElastic(fakeHits);

  const result = await getSimilarObjects(makeResource('co12345'), elastic);

  t.deepEqual(result, fakeHits, 'returns the hits array from the search response');
  t.end();
});

test('getSimilarObjects — returns empty array when ES returns no hits', async function (t) {
  t.plan(1);
  const elastic = makeElastic([]);

  const result = await getSimilarObjects(makeResource('co12345'), elastic);

  t.deepEqual(result, [], 'returns empty array when there are no similar objects');
  t.end();
});
