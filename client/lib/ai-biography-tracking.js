// GTM dataLayer events for the AI biography panel on person pages.
//
//   aiBioShown     — once each time a bio renders into #aiBiography.
//                    The denominator for click-through.
//   aiBioLinkClick — a link inside the panel was clicked (or
//                    middle-clicked). Never blocks navigation.
//
// The click listener is delegated from document (like
// anniversary-tracking.js), so it survives SPA re-renders that replace
// #aiBiography itself.

// First path segment of an on-site link → link type.
const LINK_TYPES = {
  objects: 'object',
  people: 'person',
  documents: 'document',
  group: 'group'
};

module.exports = function initAiBiographyTracking () {
  document.addEventListener('click', onLinkClick);
  // Middle-click opens a new tab without firing 'click'.
  document.addEventListener('auxclick', function (e) {
    if (e.button === 1) onLinkClick(e);
  });
};

function onLinkClick (e) {
  const target = e.target;
  const link = target && target.closest && target.closest('#aiBiography a[href]');
  if (!link) return;
  const payload = linkClickEvent(link, window.location.origin);
  if (payload) push(payload);
}

// Called from get-ai-biography.js once the panel HTML is in place.
function trackShown (container) {
  push({
    event: 'aiBioShown',
    aiBioPersonId: container.getAttribute('data-person-id'),
    aiBioHasCollection: !!container.querySelector('.ai-biography__context'),
    aiBioLinkCount: container.querySelectorAll('.ai-biography__section a[href]').length
  });
}

// Build the aiBioLinkClick payload for an anchor inside #aiBiography,
// or null when the href can't be classified.
function linkClickEvent (link, origin) {
  const described = describeLink(link.getAttribute('href'), origin);
  if (!described) return null;
  const container = link.closest('#aiBiography');
  return {
    event: 'aiBioLinkClick',
    aiBioPersonId: container ? container.getAttribute('data-person-id') : null,
    aiBioSection: linkSection(link),
    aiBioLinkType: described.type,
    aiBioLinkHref: described.href
  };
}

// Which part of the panel the link sits in. Check the context block
// first: it also carries the .ai-biography__section class.
function linkSection (link) {
  if (link.closest('.ai-biography__context')) return 'collection';
  if (link.closest('.ai-biography__section')) return 'biography';
  if (link.closest('.ai-disclaimer')) return 'disclaimer';
  return 'other';
}

// Classify an href and reduce it to what analytics needs: the path for
// on-site links (no query or hash), origin + path for off-site ones,
// and no address for mailto links.
function describeLink (href, origin) {
  if (!href) return null;
  if (/^mailto:/i.test(href)) return { type: 'email', href: 'mailto:' };

  let url;
  try {
    url = new URL(href, origin);
  } catch (err) {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (url.origin !== origin) {
    return { type: 'external', href: url.origin + url.pathname };
  }
  const firstSegment = url.pathname.split('/')[1];
  return {
    type: LINK_TYPES[firstSegment] || 'internal',
    href: url.pathname
  };
}

function push (payload) {
  if (typeof window.dataLayer === 'undefined') return;
  try {
    window.dataLayer.push(payload);
  } catch (err) {
    // Never let analytics break the page.
  }
}

module.exports.trackShown = trackShown;
module.exports.linkClickEvent = linkClickEvent;
module.exports.linkSection = linkSection;
module.exports.describeLink = describeLink;
