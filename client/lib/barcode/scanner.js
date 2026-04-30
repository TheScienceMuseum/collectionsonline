// Camera + barcode decode loop, built on @zxing/browser's MultiFormatReader.
//
// Why we don't just call decodeFromConstraints():
//   zxing-js' built-in continuous decode loop only attempts to decode the
//   camera frame at its natural orientation. Its TRY_HARDER hint is meant
//   to rotate the image internally for 1D barcodes (Code 128, EAN, etc.)
//   but in the browser port it doesn't reliably do that — barcodes whose
//   bars run vertically in the camera frame fail to decode.
//
//   So we run our own scan loop: every ~100ms we grab the current video
//   frame onto a canvas, attempt a decode at 0°, and if that fails we
//   redraw the frame at 90° / 180° / 270° on the canvas and try again.
//   That covers any orientation of barcode from a stationary phone.
//
// Lifecycle: start(videoEl, onResult) → resume()/pause()/stop().
// While "paused" we keep the camera stream open (no permission re-prompt)
// but skip decode attempts.

const { BrowserMultiFormatReader, BarcodeFormat } = require('@zxing/browser');
const { DecodeHintType } = require('@zxing/library');

const SCAN_INTERVAL_MS = 80; // ~12 fps
const DEDUPE_WINDOW_MS = 2000;
const NOT_FOUND_RE = /NotFoundException|No MultiFormat Readers/i;

// Optional debug overlay. Toggle by adding `?debug=1` to the page URL.
const DEBUG = typeof window !== 'undefined' &&
  /[?&]debug=1\b/.test(window.location.search);

function buildHints () {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, // most museum labels
    BarcodeFormat.CODE_39, // legacy museum labels
    BarcodeFormat.EAN_13, // commercial backstops
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.QR_CODE, // future-proofing
    BarcodeFormat.DATA_MATRIX
  ]);
  return hints;
}

function createScanner () {
  const reader = new BrowserMultiFormatReader(buildHints());

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let stream = null;
  let videoEl = null;
  let paused = false;
  let stopped = true;
  let timer = null;
  let tickCount = 0;
  let lastDecoded = null;
  let lastDecodedAt = 0;
  let debugEl = null;
  let lastHitDeg = null;

  // eslint-disable-next-line no-console
  console.log('[barcode] scanner ready — multi-rotation decode active');

  async function start (el, onResult) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('getUserMedia is not available in this browser. Camera access requires HTTPS (or localhost).');
      err.name = 'NotSupportedError';
      throw err;
    }

    videoEl = el;
    // Request 720p back camera. Sweet spot between detail and per-frame
    // decode cost — 1080p has 2.25× the pixels and slows zxing noticeably
    // on mobile, while 480p loses too much fidelity for small or rotated
    // barcodes. Browsers fall back if the camera can't oblige.
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        // Continuous autofocus where supported (Android Chrome). iOS
        // Safari ignores unknown constraints rather than rejecting, so
        // it's safe to include even though it's a no-op there.
        focusMode: 'continuous'
      },
      audio: false
    });
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('muted', 'true');
    videoEl.muted = true;
    await videoEl.play();

    if (DEBUG) installDebugOverlay();

    paused = false;
    stopped = false;
    scheduleTick(onResult);
  }

  function scheduleTick (onResult) {
    if (stopped) return;
    timer = setTimeout(function () { tick(onResult); }, SCAN_INTERVAL_MS);
  }

  function tick (onResult) {
    if (stopped) return;
    if (paused || !videoEl || videoEl.readyState < 2) {
      scheduleTick(onResult);
      return;
    }

    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) { scheduleTick(onResult); return; }

    // Always try horizontal (0°) first — that's the dominant case for
    // museum scanning, so we want it to fire instantly. We only attempt
    // the 90° rotation every other tick: that's still ~6 vertical attempts
    // per second, which is plenty to catch a deliberately-held vertical
    // barcode, but it means horizontal scans don't pay the cost of a
    // useless 90° decode on every tick.
    tickCount++;
    const tryVertical = (tickCount & 1) === 0;
    const rotations = tryVertical ? [0, 90] : [0];
    let hit = null;
    let hitDeg = null;
    for (let i = 0; i < rotations.length; i++) {
      const text = decodeAtRotation(rotations[i], w, h);
      if (text) { hit = text; hitDeg = rotations[i]; break; }
    }

    if (DEBUG) updateDebug(w, h, hit, hitDeg);

    if (hit) {
      lastHitDeg = hitDeg;
      handleHit(hit, hitDeg, onResult);
    }

    scheduleTick(onResult);
  }

  // Draw the current video frame to our canvas at the requested rotation
  // and ask zxing to decode it. Returns the decoded text or null.
  function decodeAtRotation (deg, w, h) {
    const portrait = (deg === 90 || deg === 270);
    canvas.width = portrait ? h : w;
    canvas.height = portrait ? w : h;
    ctx.imageSmoothingEnabled = false; // crisp barcode edges
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(videoEl, -w / 2, -h / 2, w, h);
    ctx.restore();

    try {
      const result = reader.decodeFromCanvas(canvas);
      return result ? result.getText() : null;
    } catch (err) {
      if (err && err.message && !NOT_FOUND_RE.test(err.message) &&
          err.name !== 'NotFoundException' && err.name !== 'NotFoundException2') {
        // eslint-disable-next-line no-console
        console.debug('[barcode] decode error at', deg, 'deg:', err);
      }
      return null;
    }
  }

  function handleHit (text, deg, onResult) {
    const now = Date.now();
    if (text === lastDecoded && now - lastDecodedAt < DEDUPE_WINDOW_MS) return;
    lastDecoded = text;
    lastDecodedAt = now;
    // eslint-disable-next-line no-console
    console.log('[barcode] decoded at', deg + '°:', text);
    onResult(text);
  }

  // ---- debug overlay (only when ?debug=1) -------------------------------

  function installDebugOverlay () {
    if (debugEl) return;
    debugEl = document.createElement('div');
    debugEl.style.cssText = [
      'position:fixed', 'top:8px', 'left:8px', 'right:8px',
      'padding:6px 10px', 'background:rgba(0,0,0,0.65)', 'color:#0f0',
      'font:11px/1.3 monospace', 'z-index:9999', 'pointer-events:none',
      'white-space:pre-wrap'
    ].join(';');
    document.body.appendChild(debugEl);
  }

  let frameCount = 0;
  let lastSec = Date.now();
  let fps = 0;
  function updateDebug (w, h, hit, hitDeg) {
    frameCount++;
    const now = Date.now();
    if (now - lastSec >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastSec = now;
    }
    if (!debugEl) return;
    debugEl.textContent =
      'rotation: 0/90/270/180   src: ' + w + '×' + h + '   ~' + fps + ' fps\n' +
      'last hit: ' + (lastHitDeg === null ? '—' : lastHitDeg + '°') +
      (hit ? '  →  ' + hit : '');
  }

  // -----------------------------------------------------------------------

  function pause () { paused = true; }

  function resume () {
    paused = false;
    lastDecoded = null;
    lastDecodedAt = 0;
  }

  function stop () {
    stopped = true;
    paused = true;
    if (timer) { clearTimeout(timer); timer = null; }
    if (stream) {
      stream.getTracks().forEach(function (t) {
        try { t.stop(); } catch (err) { /* noop */ }
      });
      stream = null;
    }
    if (videoEl) {
      try { videoEl.srcObject = null; } catch (err) { /* noop */ }
    }
    if (debugEl && debugEl.parentNode) {
      debugEl.parentNode.removeChild(debugEl);
      debugEl = null;
    }
  }

  async function setTorch (on) {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    if (!caps.torch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: !!on }] });
      return true;
    } catch (err) {
      return false;
    }
  }

  function torchSupported () {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== 'function') return false;
    return !!track.getCapabilities().torch;
  }

  // Returns true if every video track on the current stream is still
  // delivering frames. iOS Safari will set tracks to 'ended' when the page
  // has been backgrounded for long enough (e.g. phone goes to sleep), at
  // which point the only fix is to acquire a fresh stream.
  function isStreamAlive () {
    if (!stream) return false;
    const tracks = stream.getVideoTracks();
    if (!tracks.length) return false;
    return tracks.every(function (t) { return t.readyState === 'live'; });
  }

  // Nudge the <video> element back into playback after the page returns
  // from being hidden. Returns a Promise that resolves true on success.
  function poke () {
    if (!videoEl) return Promise.resolve(false);
    const p = videoEl.play();
    if (!p || typeof p.then !== 'function') return Promise.resolve(true);
    return p.then(function () { return true; }).catch(function () { return false; });
  }

  return { start, pause, resume, stop, setTorch, torchSupported, isStreamAlive, poke };
}

module.exports = { createScanner };
