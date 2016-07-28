const test = require('tape');
const sortRelatedItems = require('../lib/sort-related-items.js');
var sortedItems;
var sortedChildren;
var relatedItems = [
  {
    _id: 'smgc-object-1234',
    _type: 'object',
    _source: {
      summary_title: 'Hello World'
    }
  },
  {
    _id: 'smgc-archive-1234',
    _type: 'archive',
    _source: {
      summary_title: 'Archive No. 1'
    }
  },
  {
    _id: 'smgc-object-6789',
    _type: 'object',
    _source: {
      summary_title: 'Object 2'
    }
  }
];

var relatedChildren = [
  {
    _id: 'smgc-archive-1234',
    _type: 'archive',
    _source: {
      summary_title: 'Hello World',
      identifier: [{value: 2}]
    }
  },
  {
    _id: 'smgc-archive-3466',
    _type: 'archive',
    _source: {
      summary_title: 'Archive No. 1',
      identifier: [{value: 1}]
    }
  },
  {
    _id: 'smgc-archive-6789',
    _type: 'archive',
    _source: {
      summary_title: 'Archive 2',
      identifier: [{value: 1}]
    }
  }
];

test('Items are sorted succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    sortedItems = sortRelatedItems(relatedItems);
  }, 'Building response does not throw an error');
  t.end();
});

test('Should contain sorted related items', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    sortedItems = sortRelatedItems(relatedItems);
  }, 'sorting items does not throw an error');
  t.ok(sortedItems.relatedObjects, 'contains related objects');
  t.ok(sortedItems.relatedDocuments, 'contains related documents');
  t.end();
});

test('Items should be correctly sorted', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    sortedItems = sortRelatedItems(relatedItems);
  }, 'sorting items does not throw an error');
  t.equal(sortedItems.relatedObjects.length, 2, 'contains correct number of related objects');
  t.equal(sortedItems.relatedDocuments.length, 1, 'contains correct number of related documents');
  t.end();
});

test('Items should be correctly mapped', (t) => {
  t.plan(5);
  t.doesNotThrow(() => {
    sortedItems = sortRelatedItems(relatedItems);
  }, 'sorting items does not throw an error');
  t.ok(sortedItems.relatedObjects.find(el => el.id === 'smgc-objects-1234'), 'contains correct object id');
  t.ok(sortedItems.relatedDocuments.find(el => el.id === 'smgc-documents-1234'), 'contains correct document id');
  t.ok(sortedItems.relatedObjects.find(el => el.type === 'objects'), 'contains correct object type');
  t.ok(sortedItems.relatedDocuments.find(el => el.type === 'documents'), 'contains correct document type');
  t.end();
});

test('Children should be correctly sorted', (t) => {
  t.plan(5);
  t.doesNotThrow(() => {
    sortedChildren = sortRelatedItems(relatedChildren, 'children');
  }, 'sorting items does not throw an error');
  t.ok(sortedChildren.relatedChildren);
  t.equal(sortedChildren.relatedChildren[0].id, 'smgc-documents-3466', 'First item is correct');
  t.equal(sortedChildren.relatedChildren[1].id, 'smgc-documents-6789', 'Second item is correct');
  t.equal(sortedChildren.relatedChildren[2].id, 'smgc-documents-1234', 'Third item is correct');
  t.end();
});
