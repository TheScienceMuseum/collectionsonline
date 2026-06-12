const test = require('tape');
const archiveTree = require('../lib/archive-tree');
const objs = [
  { id: 123, children: [{ id: 999, identifier: 'A', parent: [{ '@admin': { uid: 123 } }] }] },
  { id: 456, identifier: 'B', parent: [{ '@admin': { uid: 123 } }], children: [{ id: 777, identifier: 'D', parent: [{ '@admin': { uid: 456 } }], children: [{ id: 100, parent: [{ '@admin': { uid: 777 } }] }] }] },
  { id: 789, parent: [{ '@admin': { uid: 123 } }] },
  { id: 111, identifier: 'C', parent: [{ '@admin': { uid: 456 } }], children: [{ id: 645, parent: [{ '@admin': { uid: 111 } }], children: [{ id: 555, parent: [{ '@admin': { uid: 645 } }] }, { id: 888, parent: [{ '@admin': { uid: 645 } }] }] }] }
];

test('Finding Nested Objects', function (t) {
  t.plan(4);
  t.deepEqual(archiveTree.findNestedObject(objs, 789), { id: 789, parent: [{ '@admin': { uid: 123 } }], children: [] }, 'found non-nested');
  t.deepEqual(archiveTree.findNestedObject(objs, 777), { id: 777, identifier: 'D', parent: [{ '@admin': { uid: 456 } }], children: [{ id: 100, parent: [{ '@admin': { uid: 777 } }] }] }, 'found nested 1 level');
  t.deepEqual(archiveTree.findNestedObject(objs, 100), { id: 100, parent: [{ '@admin': { uid: 777 } }], children: [] }, 'found nested 2 levels');
  t.deepEqual(archiveTree.findNestedObject(objs, 888), { id: 888, parent: [{ '@admin': { uid: 645 } }], children: [] }, 'found nested 2 levels');
  t.end();
});

test('Sorting Nested Objects', function (t) {
  t.plan(3);
  const sorted = archiveTree.sortChildren(objs);
  t.deepEqual(sorted.children.length, 3, 'sorting');
  t.notOk(sorted.children[0].children, 'sorting');
  t.deepEqual(sorted.children[1].children.length, 2, 'sorting');
  t.end();
});

test('Flat input builds the full tree and drops orphans', function (t) {
  t.plan(3);
  const flat = [
    { id: 'fonds-1' },
    { id: 'series-1', identifier: 'S1', parent: [{ '@admin': { uid: 'fonds-1' } }] },
    { id: 'item-1', identifier: 'I1', parent: [{ '@admin': { uid: 'series-1' } }] },
    { id: 'orphan-1', identifier: 'O1', parent: [{ '@admin': { uid: 'missing-parent' } }] }
  ];
  const sorted = archiveTree.sortChildren(flat);
  t.equal(sorted.children.length, 1, 'one series attached to the fonds');
  t.equal(sorted.children[0].children[0].id, 'item-1', 'item attached under its series');
  t.notOk(JSON.stringify(sorted).includes('orphan-1'), 'node with a missing parent is dropped');
  t.end();
});
