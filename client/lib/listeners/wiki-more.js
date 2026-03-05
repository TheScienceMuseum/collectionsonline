'use strict';

/**
 * wiki-more.js
 *
 * Progressive enhancement for long Wikidata property lists.
 *
 * Only applies to bulleted lists (<ul class="wikidata-list" data-wiki-more>).
 * Comma-separated inline lists are intentionally excluded.
 *
 * Lists with more than THRESHOLD items are truncated on first render.
 * A "Show N more" button is appended; clicking it reveals all items and
 * replaces itself with a "Show less" button that collapses back.
 *
 * THRESHOLD must match the value in lib/wikiPropertySort.js so that the
 * fold happens at the same boundary as the server-side sort that promotes
 * linked items to the top of long lists.
 */

const THRESHOLD = 5;

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

/**
 * Build a toggle <li> button and append it to ul.
 *
 * @param {HTMLUListElement} ul
 * @param {HTMLElement[]} items - the full ordered list of content <li> elements
 * @param {'collapsed'|'expanded'} state - which button to render
 */
function appendToggle (ul, items, state) {
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
        items[i].classList.remove('wikidata-more-hidden');
      }
      li.remove();
      appendToggle(ul, items, 'expanded');
    });
  } else {
    btn.textContent = 'Show less';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Show fewer items');
    btn.addEventListener('click', function () {
      for (let i = THRESHOLD; i < items.length; i++) {
        items[i].classList.add('wikidata-more-hidden');
      }
      li.remove();
      appendToggle(ul, items, 'collapsed');
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

  // Hide items beyond the threshold using a CSS class so that
  // !important rules in the stylesheet cannot override the hiding.
  for (let i = THRESHOLD; i < items.length; i++) {
    items[i].classList.add('wikidata-more-hidden');
  }

  appendToggle(ul, items, 'collapsed');
}

/**
 * Scan a container element (typically the #wikiInfo section) and set up
 * Show More / Show Less for every bulleted wikidata list found within it.
 * Comma-separated inline lists (ul without .wikidata-list) are skipped.
 *
 * Called by get-wiki-data.js after the Handlebars template is rendered.
 *
 * @param {Element} container
 */
module.exports = function setupWikiMore (container) {
  if (!container) return;
  // Only target bulleted lists — .wikidata-list excludes inline comma lists.
  const lists = container.querySelectorAll('ul.wikidata-list[data-wiki-more]');
  for (let i = 0; i < lists.length; i++) {
    setupList(lists[i]);
  }
};
