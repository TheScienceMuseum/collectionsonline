// Pure DOM rendering for the barcode app surfaces — sheet, toast, history
// drawer, landing screen. No framework. Functions return the root element they
// attach so callers can dispose of them.

const SPRITE = '/assets/icons/symbol/svg/sprite.symbol.svg';
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

function el (tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    children.filter(Boolean).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return node;
}

// Render an icon from the project SVG sprite. Mirrors templates/partials/global/icon.html
// — uses xlink:href for older Safari support.
function icon (name, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon ' + (className || ''));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttributeNS(XLINK_NS, 'xlink:href', SPRITE + '#' + name);
  use.setAttribute('href', SPRITE + '#' + name);
  svg.appendChild(use);
  return svg;
}

function relativeTime (ts) {
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return 'just now';
  if (diff < 60 * 60 * 1000) return Math.round(diff / 60000) + 'm ago';
  if (diff < 24 * 60 * 60 * 1000) return Math.round(diff / 3600000) + 'h ago';
  return Math.round(diff / 86400000) + 'd ago';
}

// ---------------------------------------------------------------------------
// Bottom sheet — result preview over the live camera.
// onScanAnother(): user dismissed via "Scan another" or backdrop tap.
// onView(path): user tapped "View full record" (open in new tab handled here).
// Returns { close } so callers can dismiss it programmatically (e.g. on Esc).

function showSheet (mountEl, data, handlers) {
  const backdrop = el('div', { class: 'barcode-backdrop' });
  const sheet = el('div', { class: 'barcode-sheet', role: 'dialog', 'aria-label': 'Scan result' });

  function close () {
    sheet.classList.add('barcode-sheet--leaving');
    backdrop.classList.add('barcode-backdrop--leaving');
    setTimeout(function () {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
    }, 200);
    if (handlers && handlers.onClose) handlers.onClose();
  }

  backdrop.addEventListener('click', close);

  const handle = el('div', { class: 'barcode-sheet__handle', 'aria-hidden': 'true' });

  const img = data.image
    ? el('img', { class: 'barcode-sheet__img', src: data.image, alt: data.title || '' })
    : el('div', { class: 'barcode-sheet__img barcode-sheet__img--placeholder', 'aria-hidden': 'true' });

  const titleRow = el('div', { class: 'barcode-sheet__title-row' }, [
    el('h2', { class: 'barcode-sheet__title', text: data.title || 'Untitled record' }),
    data.isPart ? el('span', { class: 'barcode-sheet__tag', text: 'Part' }) : null
  ]);
  const meta = el('p', { class: 'barcode-sheet__meta', text: 'Barcode: ' + (data.barcodeId || data.uid) });

  // When the scanned record is a child part of a larger object, parts have
  // no public catalogue page of their own — we link to the parent instead.
  // Surface the relationship explicitly so the user understands the
  // "View record" button will open the parent rather than the part itself.
  const partOf = data.isPart && data.parentTitle
    ? el('p', { class: 'barcode-sheet__partof' }, [
      el('span', { class: 'barcode-sheet__partof-label', text: 'Part of: ' }),
      el('span', { class: 'barcode-sheet__partof-title', text: data.parentTitle })
    ])
    : null;

  const desc = data.description
    ? el('p', { class: 'barcode-sheet__desc', text: data.description })
    : null;

  const scanBtn = el('button', {
    class: 'barcode-btn barcode-btn--secondary',
    type: 'button',
    onclick: function () { close(); if (handlers && handlers.onScanAnother) handlers.onScanAnother(); }
  }, [
    el('span', { class: 'barcode-btn__label', text: 'Scan another' })
  ]);

  const viewBtn = el('a', {
    class: 'barcode-btn barcode-btn--primary',
    href: data.path,
    target: '_blank',
    rel: 'noopener noreferrer'
  }, [
    el('span', { class: 'barcode-btn__label', text: data.isPart ? 'Open parent' : 'View record' }),
    icon('external', 'barcode-btn__icon')
  ]);

  // Swipe-down to dismiss
  let startY = null;
  sheet.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length === 1) startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchend', function (e) {
    if (startY === null) return;
    const endY = (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY) || startY;
    if (endY - startY > 80) close();
    startY = null;
  });

  const content = el('div', { class: 'barcode-sheet__content' }, [
    handle,
    el('div', { class: 'barcode-sheet__row' }, [
      img,
      el('div', { class: 'barcode-sheet__text' }, [titleRow, meta])
    ]),
    partOf,
    desc,
    el('div', { class: 'barcode-sheet__actions' }, [scanBtn, viewBtn])
  ]);
  sheet.appendChild(content);

  mountEl.appendChild(backdrop);
  mountEl.appendChild(sheet);

  // Force a reflow so the entrance transition fires.
  // eslint-disable-next-line no-unused-expressions
  sheet.offsetHeight;
  sheet.classList.add('barcode-sheet--in');
  backdrop.classList.add('barcode-backdrop--in');

  return { close };
}

// ---------------------------------------------------------------------------
// Top toast for not-found / errors. Auto-dismisses after `ttl` ms.

function showToast (mountEl, message, opts) {
  const ttl = (opts && opts.ttl) || 3000;
  const variant = (opts && opts.variant) || 'warn';
  const toast = el('div', {
    class: 'barcode-toast barcode-toast--' + variant,
    role: 'status',
    text: message
  });
  mountEl.appendChild(toast);
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;
  toast.classList.add('barcode-toast--in');
  setTimeout(function () {
    toast.classList.remove('barcode-toast--in');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, ttl);
}

// ---------------------------------------------------------------------------
// History drawer — slides over the camera. Tapping a row calls onSelect(scan).

function showHistoryDrawer (mountEl, scans, handlers) {
  const drawer = el('div', { class: 'barcode-drawer', role: 'dialog', 'aria-label': 'Scan history' });

  function close () {
    drawer.classList.remove('barcode-drawer--in');
    setTimeout(function () { if (drawer.parentNode) drawer.parentNode.removeChild(drawer); }, 200);
  }

  const closeBtn = el('button', {
    class: 'barcode-drawer__close',
    type: 'button',
    'aria-label': 'Close history',
    onclick: close
  }, [icon('close')]);
  const header = el('div', { class: 'barcode-drawer__header' }, [
    closeBtn,
    el('h2', { class: 'barcode-drawer__title', text: 'History' })
  ]);

  const list = el('ul', { class: 'barcode-drawer__list' });
  if (!scans.length) {
    list.appendChild(el('li', { class: 'barcode-drawer__empty', text: 'No scans yet.' }));
  } else {
    scans.forEach(function (scan) {
      const thumb = scan.image
        ? el('img', { class: 'barcode-drawer__thumb', src: scan.image, alt: '' })
        : el('div', { class: 'barcode-drawer__thumb barcode-drawer__thumb--placeholder', 'aria-hidden': 'true' });
      const row = el('button', {
        class: 'barcode-drawer__item',
        type: 'button',
        onclick: function () {
          close();
          if (handlers && handlers.onSelect) handlers.onSelect(scan);
        }
      }, [
        thumb,
        el('div', { class: 'barcode-drawer__info' }, [
          el('div', { class: 'barcode-drawer__item-title', text: scan.title || 'Untitled' }),
          el('div', { class: 'barcode-drawer__item-meta', text: (scan.barcodeId || scan.uid) + ' · ' + relativeTime(scan.date) })
        ])
      ]);
      list.appendChild(el('li', null, [row]));
    });
  }

  const clearBtn = el('button', {
    class: 'barcode-drawer__clear',
    type: 'button',
    text: 'Clear history',
    onclick: function () {
      if (handlers && handlers.onClear) handlers.onClear();
      close();
    }
  });

  drawer.appendChild(header);
  drawer.appendChild(list);
  if (scans.length) drawer.appendChild(clearBtn);

  mountEl.appendChild(drawer);
  // eslint-disable-next-line no-unused-expressions
  drawer.offsetHeight;
  drawer.classList.add('barcode-drawer--in');

  return { close };
}

// ---------------------------------------------------------------------------
// Landing view — shown before camera permission is granted (or after the
// user explicitly closes the scanner).

function renderLanding (mountEl, scanCount, handlers) {
  mountEl.innerHTML = '';
  mountEl.classList.add('barcode-app--landing');
  mountEl.classList.remove('barcode-app--scanning');

  const intro = el('div', { class: 'barcode-landing' }, [
    el('div', { class: 'barcode-landing__mark', 'aria-hidden': 'true' }, [
      icon('objects', 'barcode-landing__icon')
    ]),
    el('p', { class: 'barcode-landing__eyebrow', text: 'SMG BARCODE SCANNER' }),
    el('h1', { class: 'barcode-landing__title', text: 'Scan barcode' }),
    el('p', {
      class: 'barcode-landing__hint',
      text: 'Point your camera at a barcode in the stores to pull up the record.'
    }),
    el('button', {
      class: 'barcode-btn barcode-btn--primary barcode-landing__cta',
      type: 'button',
      onclick: function () { if (handlers && handlers.onStart) handlers.onStart(); }
    }, [
      el('span', { class: 'barcode-btn__label', text: 'Start scanner' }),
      icon('arrow-right', 'barcode-btn__icon')
    ]),
    scanCount > 0
      ? el('button', {
        class: 'barcode-landing__history',
        type: 'button',
        text: 'View history (' + scanCount + ')',
        onclick: function () { if (handlers && handlers.onHistory) handlers.onHistory(); }
      })
      : null
  ]);

  mountEl.appendChild(intro);
}

// ---------------------------------------------------------------------------
// Scanning chrome — top bar + reticle overlay. Returns refs so callers can
// flash the reticle on successful decode and update the history badge.

function renderScanning (mountEl, scanCount, handlers) {
  mountEl.innerHTML = '';
  mountEl.classList.remove('barcode-app--landing');
  mountEl.classList.add('barcode-app--scanning');

  const video = el('video', {
    class: 'barcode-video',
    autoplay: 'true',
    muted: 'true',
    playsinline: 'true'
  });

  const reticle = el('div', { class: 'barcode-reticle', 'aria-hidden': 'true' });
  const overlay = el('div', { class: 'barcode-overlay', 'aria-hidden': 'true' }, [reticle]);

  const closeBtn = el('button', {
    class: 'barcode-bar__btn',
    type: 'button',
    'aria-label': 'Close scanner',
    onclick: function () { if (handlers && handlers.onClose) handlers.onClose(); }
  }, [icon('close')]);

  const torchBtn = el('button', {
    class: 'barcode-bar__btn barcode-bar__torch',
    type: 'button',
    'aria-label': 'Toggle torch',
    'aria-pressed': 'false',
    hidden: 'hidden',
    onclick: function () { if (handlers && handlers.onTorch) handlers.onTorch(torchBtn); }
  }, [icon('torch')]);

  const historyBtn = el('button', {
    class: 'barcode-bar__btn barcode-bar__history',
    type: 'button',
    'aria-label': 'View history',
    onclick: function () { if (handlers && handlers.onHistory) handlers.onHistory(); }
  }, [
    icon('list'),
    el('span', { class: 'barcode-bar__badge', text: String(scanCount) })
  ]);
  if (!scanCount) historyBtn.querySelector('.barcode-bar__badge').hidden = true;

  const bar = el('div', { class: 'barcode-bar' }, [
    closeBtn,
    el('div', { class: 'barcode-bar__spacer' }),
    torchBtn,
    historyBtn
  ]);

  const hint = el('div', { class: 'barcode-hint' }, [
    el('p', { class: 'barcode-hint__primary', text: 'Point camera at a barcode' }),
    el('p', { class: 'barcode-hint__tip', text: 'Tip: barcodes scan in any orientation' })
  ]);

  mountEl.appendChild(video);
  mountEl.appendChild(overlay);
  mountEl.appendChild(bar);
  mountEl.appendChild(hint);

  function flash () {
    reticle.classList.remove('barcode-reticle--flash');
    // force reflow so the animation can re-trigger
    // eslint-disable-next-line no-unused-expressions
    reticle.offsetHeight;
    reticle.classList.add('barcode-reticle--flash');
  }

  function setHistoryCount (n) {
    const badge = historyBtn.querySelector('.barcode-bar__badge');
    badge.textContent = String(n);
    badge.hidden = !n;
  }

  function showTorch () { torchBtn.hidden = false; }

  return { video, flash, setHistoryCount, showTorch };
}

// ---------------------------------------------------------------------------
// Inline error message for permission-denied / camera errors. Replaces the
// scanning UI with a clear retry affordance.

function renderError (mountEl, message, handlers) {
  mountEl.innerHTML = '';
  mountEl.classList.remove('barcode-app--scanning');
  mountEl.classList.add('barcode-app--landing');
  mountEl.appendChild(
    el('div', { class: 'barcode-landing' }, [
      el('h1', { class: 'barcode-landing__title', text: 'Camera unavailable' }),
      el('p', { class: 'barcode-landing__hint', text: message }),
      el('button', {
        class: 'barcode-btn barcode-btn--primary',
        type: 'button',
        text: 'Try again',
        onclick: function () { if (handlers && handlers.onRetry) handlers.onRetry(); }
      })
    ])
  );
}

module.exports = {
  showSheet,
  showToast,
  showHistoryDrawer,
  renderLanding,
  renderScanning,
  renderError
};
