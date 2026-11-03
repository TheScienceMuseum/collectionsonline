const test = require('tape');
const tracking = require('../client/lib/ai-biography-tracking');
const { linkifyObjectMarkers } = require('../lib/ai/render-biography');

const ORIGIN = 'https://collection.sciencemuseumgroup.org.uk';

// Minimal stand-ins for DOM elements: `closest` answers from a fixed
// list of the selectors the element sits inside.
function fakeContainer (personId) {
  return {
    getAttribute: name => name === 'data-person-id' ? personId : null
  };
}

function fakeLink (href, inside, container) {
  const link = {
    getAttribute: name => name === 'href' ? href : null,
    closest: function (selector) {
      if (selector === '#aiBiography') return container || null;
      return inside.indexOf(selector) !== -1 ? link : null;
    }
  };
  return link;
}

// --- describeLink ----------------------------------------------------

test('describeLink: on-site record links are typed by their first path segment', function (t) {
  t.deepEqual(tracking.describeLink('/objects/co66081', ORIGIN), { type: 'object', href: '/objects/co66081' });
  t.deepEqual(tracking.describeLink('/people/cp37726/albert-einstein', ORIGIN), { type: 'person', href: '/people/cp37726/albert-einstein' });
  t.deepEqual(tracking.describeLink('/documents/aa110000003', ORIGIN), { type: 'document', href: '/documents/aa110000003' });
  t.deepEqual(tracking.describeLink('/group/co8094437', ORIGIN), { type: 'group', href: '/group/co8094437' });
  t.end();
});

test('describeLink: other on-site pages are internal', function (t) {
  t.deepEqual(tracking.describeLink('/ai-biographies', ORIGIN), { type: 'internal', href: '/ai-biographies' });
  t.deepEqual(tracking.describeLink('/search/objects', ORIGIN), { type: 'internal', href: '/search/objects' });
  t.end();
});

test('describeLink: absolute links to this site count as on-site', function (t) {
  t.deepEqual(tracking.describeLink(ORIGIN + '/objects/co66081', ORIGIN), { type: 'object', href: '/objects/co66081' });
  t.end();
});

test('describeLink: drops query strings and hashes', function (t) {
  t.deepEqual(tracking.describeLink('/objects/co66081?ajax=true#gallery', ORIGIN), { type: 'object', href: '/objects/co66081' });
  t.deepEqual(tracking.describeLink('https://en.wikipedia.org/wiki/Albert_Einstein?x=1#Life', ORIGIN),
    { type: 'external', href: 'https://en.wikipedia.org/wiki/Albert_Einstein' });
  t.end();
});

test('describeLink: off-site links are external, with origin and path', function (t) {
  t.deepEqual(tracking.describeLink('https://www.wikidata.org/wiki/Q937', ORIGIN), { type: 'external', href: 'https://www.wikidata.org/wiki/Q937' });
  t.end();
});

test('describeLink: mailto links are typed but carry no address', function (t) {
  t.deepEqual(tracking.describeLink('mailto:someone@example.org', ORIGIN), { type: 'email', href: 'mailto:' });
  t.deepEqual(tracking.describeLink('MAILTO:someone@example.org?subject=hi', ORIGIN), { type: 'email', href: 'mailto:' });
  t.end();
});

test('describeLink: empty and non-http hrefs are ignored', function (t) {
  t.equal(tracking.describeLink('', ORIGIN), null);
  t.equal(tracking.describeLink(null, ORIGIN), null);
  t.equal(tracking.describeLink('javascript:void(0)', ORIGIN), null);
  t.equal(tracking.describeLink('tel:+440000000000', ORIGIN), null);
  t.end();
});

test('describeLink: the anchors render-biography emits are object links', function (t) {
  const html = linkifyObjectMarkers('is captured in {co66081|Einstein in Norfolk}, a photograph');
  const href = html.match(/href="([^"]+)"/)[1];
  t.deepEqual(tracking.describeLink(href, ORIGIN), { type: 'object', href: '/objects/co66081' });
  t.end();
});

// --- linkSection -----------------------------------------------------

test('linkSection: "In the collection" links are collection, not biography', function (t) {
  // The context block carries both classes, so it must win.
  const link = fakeLink('/objects/co1', ['.ai-biography__context', '.ai-biography__section']);
  t.equal(tracking.linkSection(link), 'collection');
  t.end();
});

test('linkSection: links in the main prose are biography', function (t) {
  t.equal(tracking.linkSection(fakeLink('/objects/co1', ['.ai-biography__section'])), 'biography');
  t.end();
});

test('linkSection: disclaimer links and anything else', function (t) {
  t.equal(tracking.linkSection(fakeLink('/ai-biographies', ['.ai-disclaimer'])), 'disclaimer');
  t.equal(tracking.linkSection(fakeLink('/ai-biographies', [])), 'other');
  t.end();
});

// --- linkClickEvent --------------------------------------------------

test('linkClickEvent: builds the full dataLayer payload', function (t) {
  const link = fakeLink('/objects/co66081', ['.ai-biography__context', '.ai-biography__section'], fakeContainer('cp37726'));
  t.deepEqual(tracking.linkClickEvent(link, ORIGIN), {
    event: 'aiBioLinkClick',
    aiBioPersonId: 'cp37726',
    aiBioSection: 'collection',
    aiBioLinkType: 'object',
    aiBioLinkHref: '/objects/co66081'
  });
  t.end();
});

test('linkClickEvent: returns null for hrefs it cannot classify', function (t) {
  const link = fakeLink('javascript:void(0)', ['.ai-biography__section'], fakeContainer('cp37726'));
  t.equal(tracking.linkClickEvent(link, ORIGIN), null);
  t.end();
});

// --- trackShown ------------------------------------------------------

test('trackShown: pushes one aiBioShown event with the denominators', function (t) {
  const previous = global.window;
  global.window = { dataLayer: [] };
  const container = {
    getAttribute: name => name === 'data-person-id' ? 'cp37726' : null,
    querySelector: sel => sel === '.ai-biography__context' ? {} : null,
    querySelectorAll: sel => sel === '.ai-biography__section a[href]' ? [{}, {}, {}] : []
  };

  tracking.trackShown(container);

  t.deepEqual(global.window.dataLayer, [{
    event: 'aiBioShown',
    aiBioPersonId: 'cp37726',
    aiBioHasCollection: true,
    aiBioLinkCount: 3
  }]);
  global.window = previous;
  t.end();
});

test('trackShown: does nothing when GTM has no dataLayer', function (t) {
  const previous = global.window;
  global.window = {};
  const container = {
    getAttribute: () => 'cp37726',
    querySelector: () => null,
    querySelectorAll: () => []
  };
  t.doesNotThrow(() => tracking.trackShown(container));
  global.window = previous;
  t.end();
});
