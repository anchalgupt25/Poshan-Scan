import React, { useState, useRef } from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import {
  scanBarcode,
  searchProducts,
  ocrLabelImage,
  extractBarcodeFromUrl,
  extractSearchTermFromUrl,
} from '../../utils/api';
import './scanning.css';

const METHODS = {
  barcode: { emoji: '📷', title: 'Scan Barcode', desc: 'Point camera at the product barcode' },
  photo:   { emoji: '🏷️', title: 'Photo Label',  desc: 'Snap a clear shot of the nutrition label' },
  link:    { emoji: '🔗', title: 'Paste Product Link', desc: 'Amazon, Walmart, Target, Instacart, Whole Foods' },
};

export default function ScanningScreen() {
  const navigate = useStore((s) => s.navigate);
  const setSelectedProduct = useStore((s) => s.setSelectedProduct);
  const activeKid = useStore((s) => s.getActiveKid());
  const scanMethod = useStore((s) => s.scanMethod) || 'barcode';
  const method = METHODS[scanMethod] || METHODS.barcode;
  const childId = activeKid?.id;

  const [manualBarcode, setManualBarcode] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoStatus, setPhotoStatus] = useState(null);
  const fileInputRef = useRef(null);

  const goToResult = (scanResult) => {
    setSelectedProduct(scanResult);
    navigate('result');
  };

  // ─── Barcode lookup ───────────────────────────────────────
  const handleBarcodeLookup = async () => {
    const code = manualBarcode.trim();
    if (!code) return;
    setStatus('looking');
    setErrorMsg('');
    try {
      const r = await scanBarcode(code, childId);
      if (r?.product?.name && r.product.data_source !== 'demo') {
        setStatus('found');
        setTimeout(() => goToResult(r), 600);
      } else if (r?.product?.name) {
        setStatus('found');
        setTimeout(() => goToResult(r), 600);
      } else {
        setStatus('notfound');
        setErrorMsg('Barcode not in our databases yet. Try a different product.');
      }
    } catch (err) {
      setStatus('notfound');
      setErrorMsg(err.message || 'Could not look up barcode.');
    }
  };

  // ─── Link/text search ─────────────────────────────────────
  const handleLinkLookup = async () => {
    const link = linkInput.trim();
    if (!link) return;
    setStatus('looking');
    setErrorMsg('');
    setSearchResults([]);

    // Try barcode extraction first
    const code = extractBarcodeFromUrl(link);
    if (code) {
      try {
        const r = await scanBarcode(code, childId);
        if (r?.product?.name) {
          setStatus('found');
          setTimeout(() => goToResult(r), 600);
          return;
        }
      } catch (_) {}
    }

    // Then text search
    const searchTerm = link.startsWith('http') ? extractSearchTermFromUrl(link) : link;
    if (!searchTerm) {
      setStatus('notfound');
      setErrorMsg('Could not extract a product name from that URL.');
      return;
    }

    try {
      const r = await searchProducts(searchTerm, childId);
      const products = r?.products || [];
      const scores = r?.scores || [];
      if (products.length === 0) {
        setStatus('notfound');
        setErrorMsg(`No products found for "${searchTerm}". Try a more specific name or paste the barcode.`);
      } else if (products.length === 1) {
        setStatus('found');
        setTimeout(() => goToResult({ product: products[0], score: scores[0] }), 600);
      } else {
        setSearchResults(products.map((p, i) => ({ product: p, score: scores[i] })));
        setStatus(null);
      }
    } catch (err) {
      setStatus('notfound');
      setErrorMsg(err.message || 'Search failed');
    }
  };

  // ─── Photo upload ─────────────────────────────────────────
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPhotoPreview(dataUrl);
      setPhotoStatus('processing');
      setErrorMsg('');
      try {
        const r = await ocrLabelImage(dataUrl, childId);
        setPhotoStatus('done');
        setTimeout(() => goToResult(r), 700);
      } catch (err) {
        setPhotoStatus('error');
        setErrorMsg(err.message || 'OCR failed');
      }
    };
    reader.readAsDataURL(file);
  };

  // ============================================================
  //  Barcode mode
  // ============================================================
  if (scanMethod === 'barcode') {
    return (
      <div className="screen animate-fade-in">
        <StatusBar />
        <div className="nav-header">
          <button className="nav-back" onClick={() => navigate('home')}>←</button>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{method.title}</div>
          <div style={{ width: 40 }} />
        </div>

        <div className="scrollable" style={{ padding: '16px 24px 24px' }}>
          <div className="scan-tip" style={{ marginBottom: 20 }}>
            <div className="scan-tip-icon">🧪</div>
            <div>
              <strong>Camera barcode scanning is coming soon.</strong>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.5 }}>
                For now, type the UPC manually below — we'll look it up instantly across USDA + Open Food Facts.
                For the most reliable scan today, use <strong>📷 Photograph the label</strong> from home.
              </div>
            </div>
          </div>

          {/* Removed the empty viewfinder — was a "white wall" that confused users.
              Manual entry form below is now the primary affordance. */}

          <div className="section-label">ENTER BARCODE MANUALLY</div>

          <div className="barcode-example">
            <div className="barcode-example-title">Where to find the barcode</div>
            <div className="barcode-visual">
              <div className="barcode-bars">||||| || ||||| || ||| || |||||</div>
              <div className="barcode-digits">
                <span className="barcode-digit-edge">0</span>
                <span>85239 07320</span>
                <span className="barcode-digit-edge">9</span>
              </div>
            </div>
            <div className="barcode-example-note">
              Look on the back or side of the package. Type <strong>every digit</strong>{' '}
              including the small numbers on the far left and far right — usually 12 digits in the US.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="tel"
              inputMode="numeric"
              className="text-input"
              placeholder="12-digit UPC, e.g. 028000010019"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
              disabled={status === 'looking'}
              style={{ flex: 1 }}
              maxLength={14}
            />
            <button
              className="btn-primary"
              onClick={handleBarcodeLookup}
              disabled={!manualBarcode.trim() || status === 'looking'}
              style={{ width: 'auto', padding: '14px 22px' }}
            >
              {status === 'looking' ? '…' : 'Look up'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 12 }}>
            Try one of these to test: <button
              type="button"
              onClick={() => setManualBarcode('028000010019')}
              style={{ background: 'var(--cream-deep)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: 'var(--ink)', border: 'none', cursor: 'pointer', marginRight: 4 }}
            >028000010019</button> (Honey Nut Cheerios) ·{' '}
            <button
              type="button"
              onClick={() => setManualBarcode('0085239073209')}
              style={{ background: 'var(--cream-deep)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: 'var(--ink)', border: 'none', cursor: 'pointer' }}
            >0085239073209</button> (Goldfish)
          </div>

          {status === 'looking' && (
            <div className="link-status">
              <div className="processing-spinner" />
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                Searching Open Food Facts + USDA…
              </div>
            </div>
          )}

          {status === 'notfound' && (
            <div className="lookup-error">
              <div style={{ fontSize: 28, marginBottom: 6 }}>🔍</div>
              <strong>Not found</strong>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6 }}>{errorMsg}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  //  Photo Label mode
  // ============================================================
  if (scanMethod === 'photo') {
    return (
      <div className="screen animate-fade-in">
        <StatusBar />
        <div className="nav-header">
          <button className="nav-back" onClick={() => navigate('home')}>←</button>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{method.title}</div>
          <div style={{ width: 40 }} />
        </div>

        <div className="scrollable" style={{ padding: '20px 24px 24px' }}>
          {!photoPreview ? (
            <>
              <div className="photo-upload-area" onClick={() => fileInputRef.current?.click()}>
                <div className="photo-upload-icon">📸</div>
                <div className="photo-upload-title">Snap the nutrition label</div>
                <div className="photo-upload-desc">
                  Aim the camera at the back of the package — the white Nutrition Facts panel and ingredients list.
                </div>
                <button className="btn-primary" style={{ marginTop: 16, maxWidth: 280 }}>
                  📷 Open camera
                </button>
                <button
                  className="btn-ghost"
                  style={{ marginTop: 8, maxWidth: 280 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                      // Restore capture so the next "Open camera" still works
                      setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 500);
                    }
                  }}
                >
                  Or upload from photos
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
              <div className="scan-tip">
                <div className="scan-tip-icon">💡</div>
                <div>
                  <strong>For best results:</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 13, color: 'var(--ink-muted)' }}>
                    <li>Photograph the <strong>back of the package</strong>, not the front</li>
                    <li>Good lighting, no glare on the label</li>
                    <li>Fit the whole Nutrition Facts table in frame</li>
                    <li>Hold steady so the text is sharp</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="photo-result">
              <img src={photoPreview} alt="Uploaded label" className="photo-preview" />
              <div className="photo-status">
                {photoStatus === 'processing' && (
                  <>
                    <div className="processing-spinner" />
                    <div>Reading nutrition label…</div>
                    <div className="photo-status-sub">Extracting ingredients and nutrients — usually takes ~5 seconds</div>
                  </>
                )}
                {photoStatus === 'done' && (
                  <>
                    <div style={{ fontSize: 32 }}>✅</div>
                    <div>Label parsed!</div>
                    <div className="photo-status-sub">Loading scoring result…</div>
                  </>
                )}
                {photoStatus === 'error' && (
                  <div className="lookup-error">
                    <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
                    <strong>OCR not available</strong>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5, textAlign: 'left' }}>
                      {errorMsg}
                    </div>
                    <button
                      className="btn-primary"
                      style={{ marginTop: 12, maxWidth: 260 }}
                      onClick={() => { setPhotoPreview(null); setPhotoStatus(null); setErrorMsg(''); }}
                    >
                      Try a different photo
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ marginTop: 8, maxWidth: 260 }}
                      onClick={() => { useStore.getState().setScanMethod('barcode'); useStore.getState().navigate('scanning'); }}
                    >
                      ← Use barcode instead
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  //  Paste Link mode
  // ============================================================
  return (
    <div className="screen animate-fade-in">
      <StatusBar />
      <div className="nav-header">
        <button className="nav-back" onClick={() => navigate('home')}>←</button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{method.title}</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="scrollable" style={{ padding: '20px 24px 24px' }}>
        <div className="link-prompt">
          <div className="link-emoji">🔗</div>
          <div className="link-title">Paste a product link or name</div>
          <div className="link-desc">Amazon, Walmart, Target, Instacart — or just type a name</div>
        </div>

        <div className="scan-tip" style={{ marginBottom: 16 }}>
          <div className="scan-tip-icon">🧪</div>
          <div>
            <strong>This feature is still in beta.</strong>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Retailer site formats change often, so some links may not return a match.
              If it doesn't work, try <strong>Enter Barcode</strong> (most reliable) or
              <strong> Scan Label</strong> (camera + AI) — both are production-ready.
            </div>
          </div>
        </div>

        <input
          className="text-input"
          type="text"
          placeholder="https://www.amazon.com/... or 'Cheerios'"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          disabled={status === 'looking'}
          style={{ marginBottom: 12 }}
        />

        <button
          className="btn-primary"
          onClick={handleLinkLookup}
          disabled={!linkInput.trim() || status === 'looking'}
        >
          {status === 'looking' ? 'Searching…' : 'Find this product'}
        </button>

        {status === 'looking' && (
          <div className="link-status" style={{ marginTop: 16 }}>
            <div className="processing-spinner" />
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              Searching Open Food Facts + USDA…
            </div>
          </div>
        )}

        {status === 'notfound' && (
          <div className="lookup-error">
            <div style={{ fontSize: 28, marginBottom: 6 }}>🔍</div>
            <strong>Couldn't find this one</strong>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5, textAlign: 'left' }}>
              {errorMsg}
              <br /><br />
              <strong style={{ color: 'var(--ink-soft)' }}>The other two scan modes are more reliable — try one of these:</strong>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 12, maxWidth: 280 }}
              onClick={() => { useStore.getState().setScanMethod('barcode'); useStore.getState().navigate('scanning'); }}
            >
              🔢 Enter Barcode instead
            </button>
            <button
              className="btn-ghost"
              style={{ marginTop: 8, maxWidth: 280 }}
              onClick={() => { useStore.getState().setScanMethod('photo'); useStore.getState().navigate('scanning'); }}
            >
              📷 Scan the nutrition label
            </button>
          </div>
        )}

        {searchResults.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 20 }}>
              {searchResults.length} MATCHES — PICK ONE
            </div>
            {searchResults.map((r, i) => (
              <div key={i} className="result-card" onClick={() => goToResult(r)}>
                {r.product.image_url ? (
                  <img src={r.product.image_url} alt="" className="result-card-thumb" style={{ objectFit: 'contain' }} />
                ) : (
                  <div className="result-card-thumb">📦</div>
                )}
                <div className="result-card-info">
                  <div className="result-card-name">{r.product.name || 'Unknown'}</div>
                  <div className="result-card-brand">
                    {r.product.brand || 'No brand'} · NOVA {r.product.nova_group || '?'}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: 'var(--terracotta)' }}>→</div>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: 24 }}>
          <div className="section-label">SUPPORTED RETAILERS</div>
          <div className="retailer-chips">
            <div className="chip">🛒 Amazon</div>
            <div className="chip">🏪 Walmart</div>
            <div className="chip">🎯 Target</div>
            <div className="chip">🥬 Instacart</div>
          </div>
        </div>
      </div>
    </div>
  );
}
