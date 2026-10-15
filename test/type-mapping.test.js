const test = require('tape');
const TypeMapping = require('../lib/type-mapping');

test('Should convert to external types', (t) => {
  t.plan(6);
  t.equal(TypeMapping.toExternal('agent'), 'people');
  t.equal(TypeMapping.toExternal('agents'), 'people');
  t.equal(TypeMapping.toExternal('object'), 'objects');
  t.equal(TypeMapping.toExternal('objects'), 'objects');
  t.equal(TypeMapping.toExternal('archive'), 'documents');
  t.equal(TypeMapping.toExternal('archives'), 'documents');
  t.end();
});

test('Should convert to internal types', (t) => {
  t.plan(3);
  t.equal(TypeMapping.toInternal('people'), 'agent');
  t.equal(TypeMapping.toInternal('objects'), 'object');
  t.equal(TypeMapping.toInternal('documents'), 'archive');
  t.end();
});

test('Should leave unknown intact', (t) => {
  t.plan(2);
  t.equal(TypeMapping.toExternal('FOOBAR'), 'FOOBAR');
  t.equal(TypeMapping.toInternal('FOOBAR'), 'FOOBAR');
  t.end();
});

test('Should convert external types to @datatype.base values', (t) => {
  t.plan(5);
  t.equal(TypeMapping.toDatatypeBase('people'), 'agent');
  t.equal(TypeMapping.toDatatypeBase('objects'), 'object');
  t.equal(TypeMapping.toDatatypeBase('documents'), 'archive');
  t.equal(TypeMapping.toDatatypeBase('group'), 'group', 'group is indexed as group, not mgroup');
  t.equal(TypeMapping.toDatatypeBase('all'), undefined, 'no base for the all tab');
  t.end();
});
