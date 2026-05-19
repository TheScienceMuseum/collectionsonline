// Visual search client controller. Owns the /scan UX state machine
// and all camera lifecycle concerns (permissions, iOS quirks, cleanup).
//
// State machine:
//   idle → active → loading-model? → searching → results
//                ↘ idle (cancel)        ↘ idle (error)
//   results → active (scan again)
//
// loading-model only fires the first time per session — once
// Transformers.js + the CLIP weights are cached, subsequent captures
// jump straight to "searching".
//
// Camera robustness (error mapping, playsinline+muted, track cleanup,
// visibilitychange) is adapted from /barcode — different code, same
// lessons. They were learned the hard way; reinventing them is asking
// for support tickets.

const { embedFrame, preload } = require('./embed');

const STATE_IDLE = 'idle';
const STATE_ACTIVE = 'active';
const STATE_LOADING_MODEL = 'loading-model';
const STATE_SEARCHING = 'searching';
const STATE_RESULTS = 'results';

const SEARCH_ENDPOINT = '/api/scan/search';

// Debug-mode toggle for threshold calibration: append ?debug=1 to the
// URL to see the raw top-1 score, confidence tier, and search latency
// on every results page. Off otherwise — public users never see it.
const VS_DEBUG = (function () {
  try {
    return /(^|[?&])debug=1(&|$)/.test(window.location.search);
  } catch (err) {
    return false;
  }
})();

function appendQuery (url, key, value) {
  if (!url) return url;
  const sep = url.indexOf('?') === -1 ? '?' : '&';
  return url + sep + encodeURIComponent(key) + '=' + encodeURIComponent(value);
}

function pushAnalytics (payload) {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  try {
    window.dataLayer.push(payload);
  } catch (err) {
    // Never let analytics break the app.
  }
}

function buzz () {
  if (typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(50); } catch (err) { /* noop */ }
  }
}

function permissionMessage (err) {
  const name = (err && err.name) || 'Error';
  const detail = (err && err.message) || '';
  let message = 'We could not access your camera.';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    message = 'Camera access was denied. On iOS: Settings → Safari → Camera → Allow. Then reload this page.';
  } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    message = 'No camera was found on this device.';
  } else if (name === 'NotReadableError' || name === 'TrackStartError') {
    message = 'The camera is in use by another app. Close other camera apps and try again.';
  } else if (name === 'OverconstrainedError') {
    message = 'No camera matched the requested settings.';
  } else if (name === 'NotSupportedError' || name === 'SecurityError' || !window.isSecureContext) {
    message = 'Camera access requires a secure connection (HTTPS). On iOS, http:// over local Wi-Fi is not allowed — open this page over HTTPS or via localhost.';
  }
  return message + ' (' + name + (detail ? ': ' + detail : '') + ')';
}

function createController (mountEl) {
  let state = STATE_IDLE;
  let stream = null;
  let videoEl = null;
  let lastCapture = null; // { dataUrl, width, height }
  let modelWarm = false; // becomes true after the first successful preload

  function escapeHtml (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderIdle (opts) {
    const errBanner = (opts && opts.error)
      ? '<div class="scan__error" role="alert">' + escapeHtml(opts.error) + '</div>'
      : '';
    mountEl.innerHTML =
      errBanner +
      '<div class="scan__idle">' +
        '<p class="scan__hint">Works best with a clear photo of a single object, well-lit, against a plain background. Setup the first time takes around 30 seconds.</p>' +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__start-btn" data-scan-action="start">' +
            'Use your camera' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderActive () {
    mountEl.innerHTML =
      '<div class="scan__active">' +
        '<div class="scan__camera-frame">' +
          '<video class="scan__video" autoplay muted playsinline></video>' +
        '</div>' +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__capture-btn" data-scan-action="capture">Capture</button>' +
          '<button type="button" class="scan__cancel-btn" data-scan-action="cancel">Cancel</button>' +
        '</div>' +
      '</div>';
    videoEl = mountEl.querySelector('.scan__video');
  }

  function renderProcessing (capture, label, sublabel) {
    mountEl.innerHTML =
      '<div class="scan__processing">' +
        '<figure class="scan__captured-figure">' +
          '<img class="scan__captured-image" alt="Your captured photo" src="' + capture.dataUrl + '">' +
        '</figure>' +
        '<div class="scan__progress" role="status">' +
          '<div class="scan__spinner" aria-hidden="true"></div>' +
          '<p class="scan__progress-label">' + escapeHtml(label) + '</p>' +
          (sublabel ? '<p class="scan__progress-sublabel">' + escapeHtml(sublabel) + '</p>' : '') +
        '</div>' +
      '</div>';
  }

  function renderDebugBadge (data) {
    if (!VS_DEBUG || !data) return '';
    const score = data.topScore != null ? data.topScore.toFixed(4) : '?';
    const tier = data.confidence || '?';
    const ms = data.searchMs != null ? data.searchMs + ' ms' : '?';
    return (
      '<div class="scan__debug-badge" aria-hidden="true">' +
        'score ' + score + ' · tier ' + tier + ' · ' + ms +
      '</div>'
    );
  }

  function renderCapturedPhoto (capture) {
    // Captured-photo block shared by all three result tiers. Includes
    // the floating "↻ camera" overlay button (top-right) so users can
    // restart the scan without scrolling all the way to the bottom of
    // the results. The bottom "Try another photo" button stays for
    // users who prefer to act after reviewing the matches.
    return (
      '<figure class="scan__captured-figure scan__captured-figure--small">' +
        '<img class="scan__captured-image" alt="Your captured photo" src="' + capture.dataUrl + '">' +
        '<button type="button" class="scan__captured-rescan" data-scan-action="rescan" aria-label="Try another photo">' +
          '<svg class="icon icon-refresh" aria-hidden="true">' +
            '<use xlink:href="/assets/icons/symbol/svg/sprite.symbol.svg#refresh"></use>' +
          '</svg>' +
        '</button>' +
      '</figure>'
    );
  }

  function renderResultCard (r) {
    const safeTitle = escapeHtml(r.title || 'Untitled');
    // Prefer maker + date; fall back to category if neither is set.
    const makerDate = [r.maker, r.date].filter(Boolean).join(', ');
    const meta = makerDate || r.category || '';
    const safeMeta = escapeHtml(meta);
    const figure = r.figure
      ? '<img src="' + escapeHtml(r.figure) + '" alt="">'
      : '<div class="scan__result-figure-placeholder" aria-hidden="true"></div>';
    // Tag the destination URL so traffic that originated from a
    // visual-search result is identifiable in GA (filter pages by
    // page_location contains 'from=visual-search'). Internal nav, so
    // we don't use UTM — those get treated as external sources.
    const link = appendQuery(r.link, 'from', 'visual-search');
    return (
      '<a class="scan__result-card" href="' + escapeHtml(link || '#') + '">' +
        '<div class="scan__result-figure">' + figure + '</div>' +
        '<div class="scan__result-info">' +
          '<h3 class="scan__result-title">' + safeTitle + '</h3>' +
          (safeMeta ? '<p class="scan__result-meta">' + safeMeta + '</p>' : '') +
        '</div>' +
      '</a>'
    );
  }

  function renderResultsHigh (capture, data) {
    const top = data.results[0];
    const rest = data.results.slice(1, 7);
    const restMarkup = rest.length
      ? '<h2 class="scan__results-subheading">Other possibilities</h2>' +
        '<div class="scan__results-grid">' +
          rest.map(renderResultCard).join('') +
        '</div>'
      : '';
    mountEl.innerHTML =
      '<div class="scan__results scan__results--high">' +
        renderCapturedPhoto(capture) +
        renderDebugBadge(data) +
        '<h2 class="scan__results-heading">Looks like:</h2>' +
        '<div class="scan__results-hero">' +
          renderResultCard(top) +
        '</div>' +
        restMarkup +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__again-btn" data-scan-action="rescan">Try another photo</button>' +
        '</div>' +
      '</div>';
  }

  function renderResultsMedium (capture, data) {
    const items = data.results.slice(0, 10);
    mountEl.innerHTML =
      '<div class="scan__results scan__results--medium">' +
        renderCapturedPhoto(capture) +
        renderDebugBadge(data) +
        '<h2 class="scan__results-heading">Closest matches in our collection</h2>' +
        '<div class="scan__results-grid">' +
          items.map(renderResultCard).join('') +
        '</div>' +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__again-btn" data-scan-action="rescan">Try another photo</button>' +
        '</div>' +
      '</div>';
  }

  function renderResultsLow (capture, data) {
    const items = data.results.slice(0, 5);
    const longShots = items.length
      ? '<details class="scan__longshots">' +
          '<summary>Show our closest guesses anyway</summary>' +
          '<div class="scan__results-grid">' +
            items.map(renderResultCard).join('') +
          '</div>' +
        '</details>'
      : '';
    mountEl.innerHTML =
      '<div class="scan__results scan__results--low">' +
        renderCapturedPhoto(capture) +
        renderDebugBadge(data) +
        '<h2 class="scan__results-heading">We could not find a confident match</h2>' +
        '<p class="scan__results-body">Try a different angle, a closer view, or better lighting. Plain backgrounds and well-lit objects work best.</p>' +
        longShots +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__again-btn" data-scan-action="rescan">Try another photo</button>' +
        '</div>' +
      '</div>';
  }

  function renderResults (capture, data) {
    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      return renderResultsLow(capture, { results: [] });
    }
    if (data.confidence === 'high') return renderResultsHigh(capture, data);
    if (data.confidence === 'medium') return renderResultsMedium(capture, data);
    return renderResultsLow(capture, data);
  }

  async function startCamera () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error('getUserMedia unavailable. HTTPS or localhost required.'), { name: 'NotSupportedError' });
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        focusMode: 'continuous'
      },
      audio: false
    });
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('muted', 'true');
    videoEl.muted = true;
    await videoEl.play();
  }

  function stopCamera () {
    if (stream) {
      stream.getTracks().forEach(function (t) {
        try { t.stop(); } catch (err) { /* noop */ }
      });
      stream = null;
    }
    if (videoEl) {
      try { videoEl.srcObject = null; } catch (err) { /* noop */ }
      videoEl = null;
    }
  }

  function captureFrame () {
    // Capture only what the user can see in the viewfinder. The video
    // element uses object-fit: cover, so the visible region is a centre
    // crop of the native camera stream (typically 16:9) into the
    // viewfinder's aspect ratio (currently 4:3). Capturing the full
    // native frame would include strips of background the user thought
    // they'd framed out.
    if (!videoEl || videoEl.readyState < 2) return null;
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return null;

    const frameEl = mountEl.querySelector('.scan__camera-frame');
    const rect = frameEl ? frameEl.getBoundingClientRect() : null;
    const frameRatio = (rect && rect.height > 0)
      ? rect.width / rect.height
      : 4 / 3;

    const videoRatio = vw / vh;
    let sx, sy, sw, sh;
    if (videoRatio > frameRatio) {
      sh = vh;
      sw = Math.round(vh * frameRatio);
      sx = Math.round((vw - sw) / 2);
      sy = 0;
    } else {
      sw = vw;
      sh = Math.round(vw / frameRatio);
      sx = 0;
      sy = Math.round((vh - sh) / 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, sw, sh);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: sw, height: sh };
  }

  async function transitionToActive () {
    state = STATE_ACTIVE;
    renderActive();
    // Start downloading the model in the background while the user
    // frames their shot. By the time they hit Capture, the heavy work
    // is often already done.
    if (!modelWarm) {
      preload().then(function () {
        modelWarm = true;
      }).catch(function (err) {
        console.warn('[visual-search] preload failed; will retry on capture:', err);
      });
    }
    try {
      await startCamera();
    } catch (err) {
      console.error('[visual-search] camera start failed:', err);
      stopCamera();
      renderIdle({ error: permissionMessage(err) });
    }
  }

  async function postEmbedding (vec) {
    const res = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      // Slice() to detach from any underlying SharedArrayBuffer that
      // some Transformers.js builds may use; fetch can't send those.
      body: new Float32Array(vec).buffer
    });
    if (!res.ok) {
      const text = await res.text().catch(function () { return ''; });
      throw new Error('Search failed (' + res.status + '): ' + text);
    }
    return res.json();
  }

  async function transitionToSearch () {
    const cap = captureFrame();
    if (!cap) return;
    buzz();
    lastCapture = cap;
    stopCamera();

    // First scan in this session: show the model-loading state while
    // Transformers.js + weights download (~30s on cold cache, instant
    // after that). On warm scans, jump straight to "searching".
    if (!modelWarm) {
      state = STATE_LOADING_MODEL;
      renderProcessing(cap, 'Setting up visual search', 'First time only — about 30 seconds');
    } else {
      state = STATE_SEARCHING;
      renderProcessing(cap, 'Searching the collection', null);
    }

    let vec;
    try {
      vec = await embedFrame(cap.dataUrl);
      modelWarm = true;
    } catch (err) {
      console.error('[visual-search] embed failed:', err);
      pushAnalytics({
        event: 'VisualSearch',
        ga_event: {
          category: 'visual-search',
          action: 'search-error',
          label: 'embed-failed',
          'non-interaction': 'true'
        }
      });
      state = STATE_IDLE;
      renderIdle({ error: 'Visual search setup failed: ' + (err && err.message ? err.message : 'unknown error') });
      return;
    }

    // Once the model has run, the visual progress should switch to
    // "searching" even if we were in loading-model previously.
    if (state === STATE_LOADING_MODEL) {
      state = STATE_SEARCHING;
      renderProcessing(cap, 'Searching the collection', null);
    }

    let data;
    try {
      data = await postEmbedding(vec);
    } catch (err) {
      console.error('[visual-search] search request failed:', err);
      pushAnalytics({
        event: 'VisualSearch',
        ga_event: {
          category: 'visual-search',
          action: 'search-error',
          label: 'request-failed',
          'non-interaction': 'true'
        }
      });
      state = STATE_IDLE;
      renderIdle({ error: 'We could not reach the search service. Please try again.' });
      return;
    }

    // Successful search: push a rich event to GTM so we can see what
    // kinds of objects people are scanning, the confidence distribution,
    // and the score distribution. No PII — only the top result's public
    // catalogue metadata + scoring info; never the photo or embedding.
    const top = (data && Array.isArray(data.results) && data.results[0]) || {};
    pushAnalytics({
      event: 'VisualSearch',
      ga_event: {
        category: 'visual-search',
        action: 'search-complete',
        label: data.confidence || 'unknown',
        value: Math.round(((data && data.topScore) || 0) * 1000),
        'non-interaction': 'true'
      },
      visual_search: {
        confidence: data.confidence,
        top_score: data.topScore,
        top_object_id: top.objectId,
        top_title: top.title,
        top_category: top.category,
        top_object_type: top.objectType,
        top_maker: top.maker,
        results_count: (data && data.results) ? data.results.length : 0,
        search_ms: data.searchMs
      }
    });

    state = STATE_RESULTS;
    renderResults(cap, data);
  }

  function transitionToIdle () {
    stopCamera();
    state = STATE_IDLE;
    renderIdle();
  }

  // Single delegated click handler — re-renders mountEl swap nodes out so
  // listener attachment via delegation is simpler than per-render attach.
  mountEl.addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-scan-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-scan-action');
    if (action === 'start' && state === STATE_IDLE) transitionToActive();
    else if (action === 'capture' && state === STATE_ACTIVE) transitionToSearch();
    else if (action === 'cancel' && state === STATE_ACTIVE) transitionToIdle();
    else if (action === 'rescan' && state === STATE_RESULTS) transitionToActive();
  });

  // Pause/recover when iOS background-kills the camera.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === STATE_ACTIVE) {
      stopCamera();
      state = STATE_IDLE;
      renderIdle();
    }
  });

  // Best-effort cleanup on page unload.
  window.addEventListener('pagehide', function () {
    stopCamera();
  });

  return {
    boot: function () {
      // The server-rendered idle state is already in the DOM; only re-render
      // if we navigated here client-side and the markup is empty.
      if (!mountEl.querySelector('[data-scan-action="start"]')) {
        renderIdle();
      }
    },
    getState: function () { return state; },
    getLastCapture: function () { return lastCapture; }
  };
}

module.exports = { createController };
