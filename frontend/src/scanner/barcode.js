/**
 * Real barcode scanner using @zxing/browser.
 * Opens the device camera and decodes barcodes continuously.
 */
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

let reader = null;
let stopFn = null;

/**
 * Start scanning from device camera.
 * @param {HTMLVideoElement} videoEl - The <video> element to stream into
 * @param {(barcode: string) => void} onDetect - Called with barcode string when found
 * @param {(status: string) => void} onStatus - Called with status messages
 */
export async function startBarcodeScanner(videoEl, onDetect, onStatus) {
  reader = new BrowserMultiFormatReader();

  try {
    // Get available cameras, prefer rear (environment) camera on mobile
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    const rearCamera = devices.find(
      (d) => d.label.toLowerCase().includes('back') ||
             d.label.toLowerCase().includes('rear') ||
             d.label.toLowerCase().includes('environment')
    ) || devices[devices.length - 1] || devices[0];

    if (!rearCamera) {
      onStatus('No camera found');
      return;
    }

    onStatus('Camera ready — point at a barcode');

    const controls = await reader.decodeFromVideoDevice(
      rearCamera.deviceId,
      videoEl,
      (result, err) => {
        if (result) {
          onDetect(result.getText());
        }
        // NotFoundException is normal when no barcode visible — ignore it
        if (err && !(err instanceof NotFoundException)) {
          onStatus('Scanner error — try again');
        }
      }
    );

    stopFn = () => controls.stop();
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Camera permission denied. Please allow camera access.'
      : `Camera error: ${err.message}`;
    onStatus(msg);
    console.error('[Scanner]', err);
  }
}

/** Stop the active scanner and release camera. */
export function stopBarcodeScanner() {
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
  reader = null;
}
