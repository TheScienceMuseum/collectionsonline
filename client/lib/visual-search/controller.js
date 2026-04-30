// Visual search client controller. Owns the /scan UX state machine —
// idle → active → searching → results — plus all camera lifecycle
// concerns (permissions, iOS quirks, cleanup).
//
// This first pass only does idle → active → captured-preview. The ML
// pipeline (lazy-load Transformers.js, embed, POST /api/scan/search,
// render results) lands in a follow-up so we can validate the camera
// flow on real iOS Safari first.
//
// Camera robustness patterns (error mapping, playsinline+muted, track
// cleanup, visibilitychange) are adapted from the existing /barcode
// scanner — different code, same lessons. They were learned the hard
// way; reinventing them is asking for support tickets.

const STATE_IDLE = 'idle';
const STATE_ACTIVE = 'active';
const STATE_CAPTURED = 'captured';
const STATE_ERROR = 'error';

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
        '<p class="scan__hint">Works best with a clear photo of a single object, well-lit, against a plain background. Setup the first time you scan takes around 30 seconds.</p>' +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__start-btn" data-scan-action="start">' +
            'Start scan' +
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

  function renderCaptured (capture) {
    mountEl.innerHTML =
      '<div class="scan__captured">' +
        '<figure class="scan__captured-figure">' +
          '<img class="scan__captured-image" alt="Your captured photo" src="' + capture.dataUrl + '">' +
          '<figcaption>Captured ' + capture.width + '×' + capture.height + '. Search not implemented yet — back-end POST lands in the next change.</figcaption>' +
        '</figure>' +
        '<div class="scan__actions">' +
          '<button type="button" class="c-btn c-btn--primary scan__again-btn" data-scan-action="rescan">Scan again</button>' +
        '</div>' +
      '</div>';
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
    try {
      await startCamera();
    } catch (err) {
      console.error('[visual-search] camera start failed:', err);
      stopCamera();
      state = STATE_ERROR;
      renderIdle({ error: permissionMessage(err) });
    }
  }

  function transitionToCaptured () {
    const cap = captureFrame();
    if (!cap) return;
    buzz();
    lastCapture = cap;
    stopCamera();
    state = STATE_CAPTURED;
    renderCaptured(cap);
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
    else if (action === 'capture' && state === STATE_ACTIVE) transitionToCaptured();
    else if (action === 'cancel' && state === STATE_ACTIVE) transitionToIdle();
    else if (action === 'rescan' && state === STATE_CAPTURED) transitionToActive();
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
