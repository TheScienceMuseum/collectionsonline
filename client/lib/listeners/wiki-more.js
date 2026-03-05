'use strict';

/**
 * wiki-more.js
 *
 * Progressive enhancement for long Wikidata property lists.
 *
 * Any <ul data-wiki-more> inside the wiki panel with more than THRESHOLD
 * <li> items will be truncated on first render. A "Show all (n)" button is
 * appended; clicking it reveals the hidden items and removes the button.
 *
 * THRESHOLD must match the value in lib/wikiPropertySort.js so that the
 * "Show more" fold happens at the same boundary as the server-side sort
 * that promotes linked items to the top of long lists.
 */

var THRESHOLD = 5;

/**
 * Set up "Show more" truncation for a single <ul data-wiki-more> element.
 *
 * @param {HTMLUListElement} ul
 */
function setupList (ul) {
  var items = Array.from(ul.querySelectorAll('li'));
  if (items.length <= THRESHOLD) return;

  var hiddenCount = items.length - THRESHOLD;

  // Hide items beyond the threshold.
  for (var i = THRESHOLD; i < items.length; i++) {
    items[i].style.display = 'none';
  }

  // Build an accessible "Show all" button as a list item.
  var btnLi = document.createElement('li');
  btnLi.className = 'wikidata-list-item wikidata-more-btn';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Show all ' + items.length + ' items');
  btn.style.cssText = [
    'background: none',
    'border: none',
    'color: inherit',
    'cursor: pointer',
    'font: inherit',
    'padding: 0',
    'text-decoration: underline',
    'opacity: 0.75'
  ].join(';');
  btn.textContent = 'Show ' + hiddenCount + ' more\u2026';

  btn.addEventListener('click', function () {
    for (var j = THRESHOLD; j < items.length; j++) {
      items[j].style.display = '';
    }
    btnLi.remove();
  });

  btnLi.appendChild(btn);
  ul.appendChild(btnLi);
}

/**
 * Scan a container element (typically the #wikiInfo section) and set up
 * "Show more" truncation for every <ul data-wiki-more> found within it.
 *
 * Called by get-wiki-data.js after the Handlebars template has been rendered
 * into the DOM.
 *
 * @param {Element} container
 */
module.exports = function setupWikiMore (container) {
  if (!container) return;
  var lists = container.querySelectorAll('ul[data-wiki-more]');
  for (var i = 0; i < lists.length; i++) {
    setupList(lists[i]);
  }
};
