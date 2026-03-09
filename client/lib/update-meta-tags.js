'use strict';

/**
 * Updates meta tags in the document head during SPA navigation.
 * Social crawlers don't execute JS so they see server-rendered values,
 * but browser share tools and extensions read live DOM.
 */
module.exports = function updateMetaTags (data) {
  const title = data.titlePage || '';
  let description = data.metaDescription ||
    (data.description && data.description.primary && data.description.primary.initialDescription) ||
    '';
  const url = (data.links && data.links.self) || window.location.href;
  const ogType = data.ogType || 'website';
  const robotsMeta = data.robotsMeta || '';
  const image = (data.images && data.images[0] && data.images[0].medium) || '';
  const imageAlt = (data.images && data.images[0] && data.images[0].title) || '';

  // If description is an array (from format-description), join it
  if (Array.isArray(description)) {
    description = description.join(' ');
  }

  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[name="robots"]', 'content', robotsMeta);

  // Open Graph
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('meta[property="og:type"]', 'content', ogType);
  setMeta('meta[property="og:image:alt"]', 'content', imageAlt);

  // Twitter
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('meta[name="twitter:card"]', 'content', image ? 'summary_large_image' : 'summary');
  setMeta('meta[name="twitter:image:alt"]', 'content', imageAlt);

  // Canonical
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    if (data.links && data.links.self) {
      canonical.setAttribute('href', data.links.self);
    } else {
      canonical.setAttribute('href', window.location.href);
    }
  }

  // JSON-LD
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (data.jsonLD) {
    if (ldScripts[0]) {
      ldScripts[0].textContent = data.jsonLD;
    }
  } else if (ldScripts[0]) {
    ldScripts[0].remove();
  }

  // Breadcrumb JSON-LD
  if (data.breadcrumbLD) {
    if (ldScripts[1]) {
      ldScripts[1].textContent = data.breadcrumbLD;
    } else {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = data.breadcrumbLD;
      document.head.appendChild(script);
    }
  } else if (ldScripts[1]) {
    ldScripts[1].remove();
  }
};

function setMeta (selector, attr, value) {
  const el = document.querySelector(selector);
  if (el) {
    el.setAttribute(attr, value || '');
  }
}
