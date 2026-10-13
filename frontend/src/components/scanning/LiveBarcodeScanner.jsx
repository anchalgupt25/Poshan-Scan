import React, { useEffect, useRef, useState } from 'react';
import {
  startLiveBarcodeScan,
  barcodePermissionState,
  requestBarcodePermission,
  setTorch,
  isTorchAvailable,
} from '../../utils/nativeScan';
import { hapticNotify } from '../../utils/platform';
import './liveScanner.css';

/**
 * Full-screen live barcode scanner for the native app.
 *
 * The ML Kit plugin renders the camera feed *behind* a transparent WKWebView,
 * so everything visible here is HTML drawn on top of the live camera: the
 * dimmed surround, the reticle, and the controls. That's what lets the scanner
 * look like part of NouriScan rather than a stock system sheet.
 *
 * Props:
 *   onDetected(barcode) — called once with the first valid read
 *   onCancel()          — user backed out
 */
export default function LiveBarcodeScanner({ onDetected, onCancel }) {
  const [phase, setPhase] = useState('starting'); // starting | scanning | denied | error
  const [errorMsg, setErrorMsg] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchable, setTorchable] = useState(false);
  const stopRef = useRef(null);
  const settledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let state = await barcodePermissionState();
        if (state === 'prompt' || state === 'prompt-with-rationale') {
          const ok = await requestBarcodePermission();
          state = ok ? 'granted' : 'denied';
        }
        if (cancelled) return;

        if (state !== 'granted' && state !== 'limited') {
          setPhase('denied');
          return;
        }

        setTorchable(await isTorchAvailable());
        if (cancelled) return;

        stopRef.current = await startLiveBarcodeScan((barcode) => {
          // Guard against a double-fire between the plugin's callback and
          // our own teardown.
          if (settledRef.current) return;
          settledRef.current = true;
          hapticNotify('success');
          onDetected(barcode);
        });

        if (cancelled) {
          await stopRef.current?.();
          return;
        }
        setPhase('scanning');
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setErrorMsg(err?.message || 'Could not start the camera.');
      }
    })();

    // Always tear the camera session down — including on unmount, which is
    // what stops the preview leaking behind the next screen.
    return () => {
      cancelled = true;
      stopRef.current?.();
    };
  }, [onDetected]);

  const handleCancel = async () => {
    await stopRef.current?.();
    onCancel();
  };

  const handleTorch = async () => {
    const next = !torchOn;
    await setTorch(next);
    setTorchOn(next);
  };

  // Permission denied / hard error states render on an opaque background,
  // because there is no camera feed behind them to show through.
  if (phase === 'denied' || phase === 'error') {
    return (
      <div className="scanner-fallback">
        <div className="scanner-fallback-card">
          <div className="scanner-fallback-icon">{phase === 'denied' ? '🔒' : '⚠️'}</div>
          <h2 className="scanner-fallback-title">
            {phase === 'denied' ? 'Camera access is off' : 'Camera unavailable'}
          </h2>
          <p className="scanner-fallback-body">
            {phase === 'denied'
              ? 'NouriScan needs the camera to read barcodes. Turn it on in Settings → NouriScan → Camera, then come back.'
              : errorMsg}
          </p>
          <button className="btn-primary" onClick={handleCancel}>
            Enter the barcode instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner-overlay">
      {/* Dimmed surround with a clear cut-out over the reticle */}
      <div className="scanner-mask scanner-mask-top" />
      <div className="scanner-mask scanner-mask-bottom" />

      <div className="scanner-reticle">
        <span className="scanner-corner tl" />
        <span className="scanner-corner tr" />
        <span className="scanner-corner bl" />
        <span className="scanner-corner br" />
        {phase === 'scanning' && <span className="scanner-sweep" />}
      </div>

      <div className="scanner-topbar">
        <button className="scanner-icon-btn" onClick={handleCancel} aria-label="Close scanner">
          ✕
        </button>
        {torchable && (
          <button
            className={`scanner-icon-btn ${torchOn ? 'is-on' : ''}`}
            onClick={handleTorch}
            aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
            aria-pressed={torchOn}
          >
            {torchOn ? '🔆' : '🔅'}
          </button>
        )}
      </div>

      <div className="scanner-hint">
        <div className="scanner-hint-title">
          {phase === 'starting' ? 'Starting camera…' : 'Line up the barcode'}
        </div>
        <div className="scanner-hint-sub">
          It reads automatically — hold steady, no need to tap
        </div>
      </div>

      <div className="scanner-bottombar">
        <button className="scanner-text-btn" onClick={handleCancel}>
          Type it in instead
        </button>
      </div>
    </div>
  );
}
