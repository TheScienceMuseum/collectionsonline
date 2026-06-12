const test = require('tape');
const stub = require('sinon').stub;
const getFullArchive = require('../lib/get-full-archive');
const elastic = require('./helpers/mock-database')();

const scrollPage = (hits, total) => ({
  body: {
    _scroll_id: 'scroll-1',
    hits: { total: { value: total }, hits }
  }
});

const hit = (n) => ({ _source: { '@admin': { uid: `doc-${n}` } } });

test('Scroll pagination accumulates all pages', async function (t) {
  t.plan(4);
  const search = stub(elastic, 'search').resolves(scrollPage([hit(1), hit(2)], 3));
  const scroll = stub(elastic, 'scroll').resolves(scrollPage([hit(3)], 3));
  const clearScroll = stub(elastic, 'clearScroll').resolves({});

  const hits = await getFullArchive(elastic, 'aa110161630');

  t.equal(hits.length, 3, 'all pages accumulated');
  t.ok(search.calledOnce, 'initial search made once');
  t.ok(scroll.calledWithMatch({ scroll_id: 'scroll-1' }), 'scroll continues from returned scroll id');
  t.ok(clearScroll.calledOnce, 'scroll context cleared');

  search.restore();
  scroll.restore();
  clearScroll.restore();
});

test('Truncated scroll throws instead of returning partial results', async function (t) {
  t.plan(2);
  const search = stub(elastic, 'search').resolves(scrollPage([hit(1), hit(2)], 5));
  const scroll = stub(elastic, 'scroll').resolves(scrollPage([], 5));
  const clearScroll = stub(elastic, 'clearScroll').resolves({});

  try {
    await getFullArchive(elastic, 'aa110161630');
    t.fail('should have thrown on truncated fetch');
  } catch (err) {
    t.match(err.message, /Incomplete archive fetch/, 'throws an incomplete-fetch error');
  }
  t.ok(clearScroll.calledOnce, 'scroll context cleared even on failure');

  search.restore();
  scroll.restore();
  clearScroll.restore();
});

test('Mid-scroll failure propagates and still clears the scroll context', async function (t) {
  t.plan(2);
  const search = stub(elastic, 'search').resolves(scrollPage([hit(1)], 3));
  const scroll = stub(elastic, 'scroll').rejects(new Error('scroll timed out'));
  const clearScroll = stub(elastic, 'clearScroll').resolves({});

  try {
    await getFullArchive(elastic, 'aa110161630');
    t.fail('should have thrown on scroll failure');
  } catch (err) {
    t.equal(err.message, 'scroll timed out', 'scroll error propagates');
  }
  t.ok(clearScroll.calledOnce, 'scroll context cleared even on failure');

  search.restore();
  scroll.restore();
  clearScroll.restore();
});
