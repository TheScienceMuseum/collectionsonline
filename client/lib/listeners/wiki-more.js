'use strict';

/**
 * wiki-more.js
 *
 * Progressive enhancement for long Wikidata property lists.
 *
 * BULLETED LISTS  (<ul class="wikidata-list" data-wiki-more>)
 *   Lists with more than THRESHOLD (5) items are truncated.
 *   A "Show N more" button is appended as a list item; clicking it reveals
 *   all items and replaces itself with a "Show less" button.
 *
 *   THRESHOLD must match the value in lib/wikiPropertySort.js so that the
 *   fold happens at the same boundary as the server-side sort that promotes
 *   linked items to the top of long lists.
 *
 * INLINE LISTS  (<ul data-wiki-more> without .wikidata-list)
 *   Comma-separated inline lists with more than INLINE_THRESHOLD (12) items
 *   are truncated. A "Show N more" button is appended inline after the last
 *   visible item (inheriting the trailing comma from item 12). When expanded,
 *   a "· Show less" button is appended after the final item.
 */

const THRESHOLD = 5;
const INLINE_THRESHOLD = 10;

const BTN_STYLE = [
  'background: none',
  'border: none',
  'color: inherit',
  'cursor: pointer',
  'font: inherit',
  'padding: 0',
  'text-decoration: underline',
  'opacity: 0.75'
].join(';');

// ─── Bulleted list helpers ────────────────────────────────────────────────────

/**
 * Build a toggle <li> button and append it to ul.
 * Returns a function that, when called, recreates the opposite state.
 *
 * @param {HTMLUListElement} ul
 * @param {HTMLElement[]} items - the full ordered list of content <li> elements
 * @param {'collapsed'|'expanded'} state - which button to render
 */
function appendToggle (ul, items, state, originalDisplay) {
  const hiddenCount = items.length - THRESHOLD;
  const li = document.createElement('li');
  li.className = 'wikidata-list-item wikidata-more-btn';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = BTN_STYLE;

  if (state === 'collapsed') {
    btn.textContent = 'Show ' + hiddenCount + ' more\u2026';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show all ' + items.length + ' items');
    btn.addEventListener('click', function () {
      for (let i = THRESHOLD; i < items.length; i++) {
        items[i].style.display = originalDisplay[i] || '';
      }
      li.remove();
      appendToggle(ul, items, 'expanded', originalDisplay);
    });
  } else {
    btn.textContent = 'Show less';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Show fewer items');
    btn.addEventListener('click', function () {
      for (let i = THRESHOLD; i < items.length; i++) {
        items[i].style.display = 'none';
      }
      li.remove();
      appendToggle(ul, items, 'collapsed', originalDisplay);
    });
  }

  li.appendChild(btn);
  ul.appendChild(li);
}

/**
 * Set up Show More / Show Less for a single bulleted list.
 *
 * @param {HTMLUListElement} ul
 */
function setupList (ul) {
  const items = Array.from(ul.querySelectorAll('li'));
  if (items.length <= THRESHOLD) return;

  // Capture each item's original display value before hiding, so we can
  // restore it exactly (template sets display: inline-block on list items).
  const originalDisplay = items.map(li => li.style.display || '');

  // Hide items beyond the threshold.
  for (let i = THRESHOLD; i < items.length; i++) {
    items[i].style.display = 'none';
  }

  appendToggle(ul, items, 'collapsed', originalDisplay);
}

// ─── Inline list helpers ──────────────────────────────────────────────────────

/**
 * Build an inline toggle <li> button and append it to ul.
 * In the collapsed state the button inherits the trailing ", " from item 12,
 * producing "…item12, Show N more…".
 * In the expanded state a " · " separator is prepended to the button li text.
 *
 * @param {HTMLUListElement} ul
 * @param {HTMLElement[]} items - the full ordered list of content <li> elements
 * @param {'collapsed'|'expanded'} state - which button to render
 */
function appendInlineToggle (ul, items, state) {
  const hiddenCount = items.length - INLINE_THRESHOLD;
  const li = document.createElement('li');
  li.style.display = 'inline';
  li.className = 'wikidata-inline-more-btn';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = BTN_STYLE;

  if (state === 'collapsed') {
    btn.textContent = 'Show ' + hiddenCount + ' more\u2026';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show all ' + items.length + ' items');
    btn.addEventListener('click', function () {
      for (let i = INLINE_THRESHOLD; i < items.length; i++) {
        items[i].classList.remove('wikidata-inline-hidden');
      }
      li.remove();
      appendInlineToggle(ul, items, 'expanded');
    });
  } else {
    // Prepend a separator so the button reads "lastitem · Show less"
    li.appendChild(document.createTextNode('\u00a0\u00b7 '));
    btn.textContent = 'Show less';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Show fewer items');
    btn.addEventListener('click', function () {
      for (let i = INLINE_THRESHOLD; i < items.length; i++) {
        items[i].classList.add('wikidata-inline-hidden');
      }
      li.remove();
      appendInlineToggle(ul, items, 'collapsed');
    });
  }

  li.appendChild(btn);
  ul.appendChild(li);
}

/**
 * Set up Show More / Show Less for a single inline comma-separated list.
 *
 * @param {HTMLUListElement} ul
 */
function setupInlineList (ul) {
  const items = Array.from(ul.querySelectorAll('li'));
  if (items.length <= INLINE_THRESHOLD) return;

  for (let i = INLINE_THRESHOLD; i < items.length; i++) {
    items[i].classList.add('wikidata-inline-hidden');
  }

  appendInlineToggle(ul, items, 'collapsed');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Scan a container element (typically the #wikiInfo section) and set up
 * Show More / Show Less for every wikidata list found within it.
 *
 * Called by get-wiki-data.js after the Handlebars template is rendered.
 *
 * @param {Element} container
 */
module.exports = function setupWikiMore (container) {
  if (!container) return;

  // Bulleted lists (.wikidata-list)
  const lists = container.querySelectorAll('ul.wikidata-list[data-wiki-more]');
  for (let i = 0; i < lists.length; i++) {
    setupList(lists[i]);
  }

  // Inline comma-separated lists (no .wikidata-list class)
  const inlineLists = container.querySelectorAll('ul[data-wiki-more]:not(.wikidata-list)');
  for (let i = 0; i < inlineLists.length; i++) {
    setupInlineList(inlineLists[i]);
  }
};
