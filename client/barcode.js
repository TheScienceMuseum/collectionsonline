// Browserify entry point for /barcode. Loaded only on this page (separate
// bundle from public/bundle.js) so the scanner library doesn't bloat the
// rest of the site.

const { createScanner } = require('./lib/barcode/scanner');
const store = require('./lib/barcode/store');
const ui = require('./lib/barcode/ui');

const MOUNT_ID = 'barcode-app';

function lookup (uid) {
  // We use raw fetch here (not lib/get-data.js) because we need to
  // distinguish 200/404/error and read the body in the not-found case;
  // get-data.js rejects on any non-200 without the body.
  return window.fetch('/barcode/' + encodeURIComponent(uid), {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin'
  }).then(function (res) {
    return res.json().then(function (body) {
      return { ok: res.ok, status: res.status, body };
    });
  });
}

function buzz () {
  if (typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(50); } catch (err) { /* noop */ }
  }
}

// Best-effort orientation lock so the UI doesn't re-flow when staff tilt the
// phone to scan a vertical barcode. Combined with zxing's TRY_HARDER hint
// (which decodes rotated barcodes from a portrait view) this means a vertical
// barcode usually doesn't need any rotation at all — but if the user does
// rotate, the UI stays put.
//
// Caveats:
//   - Screen Orientation lock is Android-Chrome-only in practice. iOS Safari
//     does not implement screen.orientation.lock(); the call is a no-op there.
//   - Most browsers require fullscreen for the lock to take effect, so we
//     request it first. If the user denies fullscreen we silently fall back.
function lockPortrait () {
  const root = document.documentElement;
  if (root.requestFullscreen) {
    root.requestFullscreen({ navigationUI: 'hide' }).catch(function () { /* user denied or unsupported */ });
  }
  if (window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
    try {
      const p = window.screen.orientation.lock('portrait');
      if (p && typeof p.catch === 'function') p.catch(function () { /* not supported (iOS) */ });
    } catch (err) { /* iOS throws synchronously */ }
  }
}

function unlockOrientation () {
  if (window.screen && window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
    try { window.screen.orientation.unlock(); } catch (err) { /* noop */ }
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(function () { /* noop */ });
  }
}

function main () {
  const mount = document.getElementById(MOUNT_ID);
  if (!mount) return;

  const scanner = createScanner();
  let scanning = false;
  let scanningRefs = null; // { video, flash, setHistoryCount, showTorch }
  let scans = store.load();

  function openSheet (data) {
    scanner.pause();
    ui.showSheet(mount, data, {
      onScanAnother: function () { scanner.resume(); },
      onClose: function () { /* swipe-down / backdrop also resumes */ scanner.resume(); }
    });
  }

  function openHistory () {
    ui.showHistoryDrawer(mount, scans, {
      onSelect: function (scan) { openSheet(scan); },
      onClear: function () {
        scans = store.clear();
        if (scanningRefs) scanningRefs.setHistoryCount(0);
      }
    });
  }

  function handleDecoded (text) {
    buzz();
    if (scanningRefs) scanningRefs.flash();
    scanner.pause();
    lookup(text).then(function (res) {
      if (res.ok) {
        scans = store.add({
          uid: res.body.uid,
          barcodeId: res.body.barcodeId || text,
          objectId: res.body.objectId,
          title: res.body.title,
          image: res.body.image,
          path: res.body.path,
          description: res.body.description,
          isPart: res.body.isPart,
          parentTitle: res.body.parentTitle
        });
        if (scanningRefs) scanningRefs.setHistoryCount(scans.length);
        openSheet(res.body);
      } else if (res.status === 404) {
        ui.showToast(mount, 'Barcode ' + text + ' not found in the catalogue.', { variant: 'warn' });
        // Suppress this specific barcode for 30s so we don't refire the
        // lookup (and re-toast) every 2s while the user is still pointing
        // at the same wrapper. Other barcodes still scan instantly.
        scanner.suppress(text, 30000);
        scanner.resume();
      } else {
        ui.showToast(mount, 'Lookup failed. Please try again.', { variant: 'error' });
        // Server-side error — short suppression so the user doesn't see a
        // wall of error toasts, but recovers if it was a transient blip.
        scanner.suppress(text, 5000);
        scanner.resume();
      }
    }).catch(function () {
      ui.showToast(mount, 'Network error. Please try again.', { variant: 'error' });
      scanner.suppress(text, 5000);
      scanner.resume();
    });
  }

  function startScanning () {
    if (scanning) return;
    scanningRefs = ui.renderScanning(mount, scans.length, {
      onClose: function () { stopScanning(); showLanding(); },
      onTorch: function (btn) {
        const next = btn.getAttribute('aria-pressed') !== 'true';
        scanner.setTorch(next).then(function (ok) {
          if (ok) btn.setAttribute('aria-pressed', String(next));
        });
      },
      onHistory: openHistory
    });

    scanner.start(scanningRefs.video, handleDecoded).then(function () {
      scanning = true;
      lockPortrait();
      if (scanner.torchSupported()) scanningRefs.showTorch();
    }).catch(function (err) {
      // Surface the real error to the console so it can be inspected via
      // remote web inspector on iOS / Chrome remote devtools on Android.
      console.error('[barcode] camera start failed:', err);

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

      // Always append the underlying error name so we can debug field reports.
      ui.renderError(mount, message + ' (' + name + (detail ? ': ' + detail : '') + ')', { onRetry: startScanning });
    });
  }

  function stopScanning () {
    scanner.stop();
    unlockOrientation();
    scanning = false;
    scanningRefs = null;
  }

  function showLanding () {
    ui.renderLanding(mount, scans.length, {
      onStart: startScanning,
      onHistory: openHistory
    });
  }

  // When the phone sleeps or the user switches tabs, iOS Safari pauses the
  // <video> element and may eventually kill the camera tracks. We don't
  // want users to come back to a frozen black screen and have to manually
  // close + restart the scanner.
  //
  // On hide:    pause the scan loop so we don't burn cycles on stale frames.
  // On show:    if tracks are still live, just nudge play() and resume.
  //             If tracks are dead (the common iOS-after-sleep case), do a
  //             full restart — which will reuse the existing camera
  //             permission, so it's silent and instant in practice.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (scanning) scanner.pause();
      return;
    }
    if (!scanning) return;
    if (scanner.isStreamAlive()) {
      scanner.poke().then(function (ok) {
        if (ok) scanner.resume();
        else { stopScanning(); startScanning(); }
      });
    } else {
      stopScanning();
      startScanning();
    }
  });

  showLanding();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
