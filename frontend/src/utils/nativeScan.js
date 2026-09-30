// Native scanning capabilities — the two features that make the iOS build a
// real app rather than a webview wrapper:
//
//   1. captureLabelPhoto()  — native rear camera → data URL for Claude Vision
//   2. live barcode scanning — ML Kit real-time UPC/EAN detection
//
// Both no-op gracefully on web so ScanningScreen can call them unconditionally
// and fall back to the existing <input type="file"> path.

import { isNative } from './platform';

// Food barcodes are almost always one of these four symbologies. Restricting
// the format list measurably improves detection speed and cuts false reads.
const FOOD_BARCODE_FORMATS = ['UpcA', 'UpcE', 'Ean13', 'Ean8'];

/* ────────────────────────── Native camera ────────────────────────── */

/**
 * Open the native rear camera and return a JPEG data URL, or null if the
 * user cancelled. Shape is identical to what FileReader produced on web, so
 * `ocrLabelImage(dataUrl, childId)` accepts it unchanged.
 */
export async function captureLabelPhoto({ fromGallery = false } = {}) {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource, CameraDirection } =
    await import('@capacitor/camera');

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: fromGallery ? CameraSource.Photos : CameraSource.Camera,
      direction: CameraDirection.Rear,
      saveToGallery: false,
      correctOrientation: true,
      // Nutrition panels are legible well below full sensor resolution, and
      // capping width keeps the base64 payload (and Vision cost) reasonable.
      width: 1600,
      promptLabelHeader: 'Nutrition label',
      promptLabelPhoto: 'Choose from photos',
      promptLabelPicture: 'Take a photo',
      promptLabelCancel: 'Cancel',
    });
    return photo?.dataUrl || null;
  } catch (err) {
    // Capacitor throws on user cancellation — treat that as a non-error.
    const msg = String(err?.message || err || '');
    if (/cancel/i.test(msg)) return null;
    throw err;
  }
}

/* ──────────────────── Live ML Kit barcode scanning ──────────────────── */

/**
 * Check whether camera permission has been granted for barcode scanning.
 * Returns 'granted' | 'denied' | 'prompt'.
 */
export async function barcodePermissionState() {
  if (!isNative()) return 'denied';
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
  const { camera } = await BarcodeScanner.checkPermissions();
  return camera;
}

/** Prompt for camera permission. Returns true when usable. */
export async function requestBarcodePermission() {
  if (!isNative()) return false;
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
  const { camera } = await BarcodeScanner.requestPermissions();
  return camera === 'granted' || camera === 'limited';
}

/**
 * Start a live scan session.
 *
 * On iOS the plugin makes the WKWebView transparent and renders the camera
 * feed *behind* it, so the calling screen is responsible for (a) adding the
 * `barcode-scanning-active` class that clears page backgrounds, and (b)
 * drawing its own reticle overlay in HTML. That's what gives us a branded
 * scanner instead of a stock system sheet.
 *
 * @param onDetected  called with the barcode string on first successful read
 * @returns a stop() function — ALWAYS call it (including on unmount)
 */
export async function startLiveBarcodeScan(onDetected) {
  if (!isNative()) throw new Error('Live scanning requires the NouriScan app.');

  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

  // iOS ships the ML Kit barcode model inside the binary, so unlike Android
  // there is no module to download — but we still guard in case the API is
  // unavailable on an older OS.
  let listener;
  let stopped = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { await listener?.remove(); } catch (_) {}
    try { await BarcodeScanner.stopScan(); } catch (_) {}
    document.documentElement.classList.remove('barcode-scanning-active');
  };

  listener = await BarcodeScanner.addListener('barcodeScanned', async (result) => {
    const raw = result?.barcode?.rawValue;
    if (!raw) return;
    // First valid read wins — stop immediately so we don't fire twice while
    // the camera is still streaming frames.
    await stop();
    onDetected(raw);
  });

  document.documentElement.classList.add('barcode-scanning-active');

  try {
    await BarcodeScanner.startScan({ formats: FOOD_BARCODE_FORMATS });
  } catch (err) {
    await stop();
    throw err;
  }

  return stop;
}

/** Toggle the device torch — useful for barcodes in dim supermarket aisles. */
export async function setTorch(on) {
  if (!isNative()) return;
  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    if (on) await BarcodeScanner.enableTorch();
    else await BarcodeScanner.disableTorch();
  } catch (_) {}
}

/** Whether this device has a torch at all (simulator does not). */
export async function isTorchAvailable() {
  if (!isNative()) return false;
  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const { available } = await BarcodeScanner.isTorchAvailable();
    return !!available;
  } catch (_) {
    return false;
  }
}
