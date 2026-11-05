const test = require('tape');
const sortRelatedItems = require('../lib/sort-related-items.js');
let sortedItems;
const relatedItems = [
  {
    _id: 'smgc-object-1234',
    _source: {
      '@datatype': {
        base: 'object'
      },
      summary: {
        title: 'Hello World'
      }
    }
  },
  {
    _id: 'smgc-archive-1234',
    _source: {
      '@datatype': {
        base: 'archive'
      },
      summary: {
        title: 'Archive No. 1'
      }
    }
  },
  {
    _id: 'smgc-object-6789',
    _source: {
      '@datatype': {
        base: 'object'
      },
      summary: {
        title: 'Object 2'
      }
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

// A related object linked to the person through `agent` (not
// creation.maker), shaped like the index: role values under
// agent[].@link.role, uid under agent[].@admin.uid.
function agentLinked (role, extra) {
  return Object.assign({
    _id: 'co440959',
    _source: {
      '@datatype': { base: 'object' },
      summary: { title: 'Wool jumper' },
      description: [
        { type: 'catalogue description', value: 'Jumper knitted from the first fleece of Dolly.', primary: true },
        { type: 'web description', value: 'A competition was supported by Portman Building Society.' },
        { type: 'note', value: 'Internal note naming Portman Building Society.' }
      ],
      agent: [
        { summary: { title: 'Cystic Fibrosis Trust' }, '@admin': { uid: 'cp17105' }, '@link': { role: [{ value: 'sponsor' }] } },
        { summary: { title: 'Portman Building Society' }, '@admin': { uid: 'cp17104' }, '@link': { role } }
      ]
    }
  }, extra || {});
}

test('agent-link role reaches the writer as linkRole, not role', (t) => {
  const out = sortRelatedItems([agentLinked([{ value: 'sponsor' }])], 'cp17104', { forWriter: true });
  const item = out.relatedObjects[0];
  t.equal(item.role, undefined, 'role stays maker-only (ifcreator reads it)');
  t.equal(item.linkRole, 'sponsor', 'linkRole comes from agent[].@link.role');
  t.equal(item.linkName, 'Portman Building Society', 'linkName is the subject as the link records it');
  t.deepEqual(item.otherDescriptions, ['A competition was supported by Portman Building Society.'],
    'otherDescriptions: non-primary, non-note descriptions');
  t.end();
});

test('writer fields are absent without forWriter (public person JSON unchanged)', (t) => {
  const item = sortRelatedItems([agentLinked([{ value: 'sponsor' }])], 'cp17104').relatedObjects[0];
  t.notOk('linkRole' in item, 'no linkRole');
  t.notOk('linkName' in item, 'no linkName');
  t.notOk('otherDescriptions' in item, 'no otherDescriptions');
  t.end();
});

test('generic agent-link roles count as no role; specific parts are kept', (t) => {
  const role = (r) => sortRelatedItems([agentLinked(r)], 'cp17104', { forWriter: true }).relatedObjects[0].linkRole;
  t.equal(role([{ value: 'association details' }]), undefined, 'association details → none');
  t.equal(role([{ value: 'association' }]), undefined, 'association → none');
  t.equal(role([{ value: 'association; licensee' }]), 'licensee', 'generic part of a compound role dropped');
  t.equal(role([{ value: 'production/association role user' }]), 'user', 'production/association prefix dropped');
  t.equal(role([{ value: 'owner' }, { value: 'Owner' }, { value: 'user' }]), 'owner, user', 'duplicates dropped');
  t.equal(role([{ value: 'depicted; commemorated' }]), 'depicted, commemorated', 'both parts kept');
  t.equal(role([{ value: 'inventor type' }]), 'inventor (type)', 'inventor type normalised');
  t.equal(role(undefined), undefined, 'no role array → none');
  t.end();
});

test('maker role and maker name still come from creation.maker', (t) => {
  const hit = {
    _id: 'co1',
    _source: {
      '@datatype': { base: 'object' },
      summary: { title: 'Lamp' },
      creation: { maker: [{ summary: { title: 'Humphry Davy' }, '@admin': { uid: 'cp1' }, '@link': { role: [{ value: 'inventor', primary: true }] } }] }
    }
  };
  const item = sortRelatedItems([hit], 'cp1', { forWriter: true }).relatedObjects[0];
  t.equal(item.role, 'inventor');
  t.equal(item.linkRole, undefined);
  t.equal(item.linkName, 'Humphry Davy');
  t.end();
});
