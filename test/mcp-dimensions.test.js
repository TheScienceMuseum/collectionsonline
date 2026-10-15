'use strict';

const test = require('tape');
const { buildAggs, parseAggs, containsRegex, DIMENSIONS } = require('../lib/mcp/query/dimensions');

const file = require('path').relative(process.cwd(), __filename) + ' > ';

test(file + 'match becomes a case-insensitive, escaped Lucene regexp', (t) => {
  t.equal(containsRegex('railway'), '.*[rR][aA][iI][lL][wW][aA][yY].*');
  t.equal(containsRegex('Who Am I?'), '.*[wW][hH][oO]\\ [aA][mM]\\ [iI]\\?.*', 'spaces and operators escaped');
  t.equal(containsRegex('1960s'), '.*1960[sS].*');
  t.equal(containsRegex('a@b#c&d<e>f~g'), '.*[aA]\\@[bB]\\#[cC]\\&[dD]\\<[eE]\\>[fF]\\~[gG].*', 'Lucene operator characters escaped');
  t.end();
});

test(file + 'terms dimensions: exact settings, include/exclude, parsing', (t) => {
  const aggs = buildAggs('object_type', { limit: 5, match: 'camera' });
  t.equal(aggs.dim.terms.field, 'name.value.keyword');
  t.equal(aggs.dim.terms.size, 5);
  t.ok(aggs.dim.terms.shard_size >= 1000);
  t.equal(aggs.dim.terms.include, containsRegex('camera'));
  t.equal(aggs.dim.terms.exclude, '.*;.*');
  t.deepEqual(aggs.dim_missing, { missing: { field: 'name.value.keyword' } });

  const parsed = parseAggs('object_type', {
    dim: { doc_count_error_upper_bound: 0, sum_other_doc_count: 12, buckets: [{ key: 'camera', doc_count: 9 }, { key: 'camera lens', doc_count: 3 }] },
    dim_missing: { doc_count: 4 }
  });
  t.deepEqual(parsed.buckets, [{ value: 'camera', count: 9 }, { value: 'camera lens', count: 3 }]);
  t.equal(parsed.other_values_count, 12);
  t.equal(parsed.records_without_value, 4);
  t.equal(parsed.exact, true);

  const inexact = parseAggs('maker', {
    dim: { doc_count_error_upper_bound: 3, sum_other_doc_count: 0, buckets: [] },
    dim_missing: { doc_count: 0 }
  });
  t.equal(inexact.exact, false, 'a non-zero error bound is reported as inexact');
  t.equal(inexact.error_bound, 3);
  t.end();
});

test(file + 'type buckets use public type names', (t) => {
  const parsed = parseAggs('type', {
    dim: { doc_count_error_upper_bound: 0, sum_other_doc_count: 0, buckets: [{ key: 'object', doc_count: 5 }, { key: 'agent', doc_count: 2 }] },
    dim_missing: { doc_count: 0 }
  });
  t.deepEqual(parsed.buckets, [{ value: 'objects', count: 5 }, { value: 'people', count: 2 }]);
  t.end();
});

const DISPLAY_BUCKETS = {
  dim: {
    sum_other_doc_count: 0,
    buckets: [
      { key: 'Science Museum', doc_count: 10 },
      { key: 'National Railway Museum', doc_count: 7 },
      { key: 'Railway Museum', doc_count: 1 },
      { key: 'Science Museum, Flight Gallery', doc_count: 4 },
      { key: 'Flight Gallery', doc_count: 4 },
      { key: 'National Railway Museum, Main Hall', doc_count: 3 },
      { key: 'Locomotion, Main Hall', doc_count: 2 },
      { key: 'Main Hall', doc_count: 5 }
    ]
  }
};

test(file + 'museum buckets merge legacy names', (t) => {
  const parsed = parseAggs('museum', DISPLAY_BUCKETS, { limit: 10 });
  t.deepEqual(parsed.buckets, [
    { value: 'Science Museum', count: 10 },
    { value: 'National Railway Museum', count: 8 }
  ]);
  t.end();
});

test(file + 'gallery buckets come from composites, so same-named galleries stay apart', (t) => {
  const parsed = parseAggs('gallery', DISPLAY_BUCKETS, { limit: 10 });
  t.deepEqual(parsed.buckets, [
    { value: 'Flight Gallery', museum: 'Science Museum', count: 4 },
    { value: 'Main Hall', museum: 'National Railway Museum', count: 3 },
    { value: 'Main Hall', museum: 'Locomotion', count: 2 }
  ]);
  t.deepEqual(parseAggs('gallery', DISPLAY_BUCKETS, { limit: 10, match: 'flight' }).buckets.map((b) => b.value), ['Flight Gallery']);
  t.end();
});

test(file + 'yes/no dimensions and date roll-ups', (t) => {
  const yesNo = parseAggs('has_image', { dim: { buckets: { yes: { doc_count: 3 }, no: { doc_count: 7 } } } });
  t.deepEqual(yesNo.buckets, [{ value: true, count: 3 }, { value: false, count: 7 }]);

  t.equal(buildAggs('made_decade').dim.date_histogram.calendar_interval, 'year');
  const decades = parseAggs('made_decade', {
    dim: { buckets: [{ key_as_string: '1961', doc_count: 2 }, { key_as_string: '1969', doc_count: 1 }, { key_as_string: '1970', doc_count: 4 }] },
    dim_missing: { doc_count: 9 }
  });
  t.deepEqual(decades.buckets, [{ value: '1960s', count: 3 }, { value: '1970s', count: 4 }]);
  t.equal(decades.records_without_value, 9);

  const months = parseAggs('added_month', {
    dim: { buckets: [{ key_as_string: '2026-09', doc_count: 249 }] },
    dim_missing: { doc_count: 0 }
  });
  t.deepEqual(months.buckets, [{ value: '2026-09', count: 249 }]);
  t.end();
});

test(file + 'unknown dimensions are rejected with the valid list', (t) => {
  t.throws(() => buildAggs('colour'), /Unknown group_by "colour"/);
  t.ok(DIMENSIONS.includes('gallery') && DIMENSIONS.includes('republished_month'));
  t.end();
});
