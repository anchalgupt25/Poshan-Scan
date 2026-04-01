/**
 * Photo / label scan sheet.
 *
 * Shows a bottom-sheet UI that:
 *  1. Lets the user take a photo OR pick from gallery
 *  2. Tries ZXing barcode decode on the chosen image
 *  3. Falls back to manual barcode / product-name / URL input
 *
 * Accepts { onBarcode, onSearch } callbacks — keeps it decoupled from app.js.
 */
import { BrowserMultiFormatReader } from '@zxing/browser';

const SHEET_ID = 'photo-scan-sheet';
const BACKDROP_ID = 'photo-scan-backdrop';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {{ onBarcode: (bc: string) => void, onSearch: (q: string) => void }} callbacks
 */
export function showPhotoScanSheet({ onBarcode, onSearch }) {
  _dismiss(); // remove any stale sheet

  const backdrop = _el('div', { id: BACKDROP_ID, style: [
    'position:fixed;inset:0;z-index:8999;',
    'background:rgba(0,0,0,0.45);',
    'animation:fadeIn .2s ease;',
  ].join('') });
  backdrop.onclick = _dismiss;

  const sheet = _buildSheet(callbacks);
  document.body.append(backdrop, sheet);

  // helper closure
  function callbacks(action, value) {
    _dismiss();
    if (action === 'barcode') onBarcode(value);
    else if (action === 'search') onSearch(value);
  }
}

// ─── Sheet builder ─────────────────────────────────────────────────────────────

function _buildSheet(callbacks) {
  const sheet = _el('div', { id: SHEET_ID, style: [
    'position:fixed;bottom:0;left:0;right:0;z-index:9000;',
    'background:var(--cream);border-radius:22px 22px 0 0;',
    'box-shadow:0 -10px 48px rgba(61,43,31,0.22);',
    'padding:18px 22px 44px;',
    'animation:slideUp .3s cubic-bezier(0.16,1,0.3,1);',
    'max-height:90vh;overflow-y:auto;',
  ].join('') });

  sheet.innerHTML = `
    <div style="width:36px;height:4px;background:var(--sand3);border-radius:2px;margin:0 auto 18px;"></div>
    <div style="font-family:var(--font-serif);font-size:19px;font-weight:700;color:var(--slate);margin-bottom:4px;">
      📸 Scan Food Label
    </div>
    <div style="font-size:13px;color:var(--slate-mid);margin-bottom:18px;line-height:1.6;">
      Take a photo of the barcode or ingredients — or paste a product link / name below.
    </div>

    <!-- image pick row -->
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <button id="pss-camera" style="${_btnStyle('var(--terra)')}">
        📷 Take Photo
      </button>
      <button id="pss-gallery" style="${_btnStyle('var(--forest)')}">
        🖼 Gallery
      </button>
    </div>

    <!-- preview -->
    <div id="pss-preview-wrap" style="display:none;margin-bottom:14px;">
      <img id="pss-preview-img" style="
        width:100%;max-height:200px;object-fit:contain;
        border-radius:12px;border:1.5px solid var(--border);
        background:var(--sand2);
      " />
      <div id="pss-decode-status" style="
        margin-top:6px;font-size:12px;color:var(--slate-mid);text-align:center;
      ">Detecting barcode…</div>
    </div>

    <!-- divider -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div style="flex:1;height:1px;background:var(--border);"></div>
      <div style="font-size:12px;color:var(--slate-mid);white-space:nowrap;">OR type / paste</div>
      <div style="flex:1;height:1px;background:var(--border);"></div>
    </div>

    <!-- manual input -->
    <input id="pss-input" type="text" placeholder="Barcode · product name · any website link…"
      style="
        width:100%;box-sizing:border-box;padding:14px 16px;
        border:1.5px solid var(--border2);border-radius:12px;
        font-family:var(--font-sans);font-size:14px;color:var(--slate);
        background:white;margin-bottom:12px;outline:none;
      "
    />
    <button id="pss-lookup" style="${_btnStyle('var(--terra)')} width:100%;margin-bottom:8px;">
      🔍 Look it up
    </button>
    <button id="pss-cancel" style="
      width:100%;padding:12px;background:transparent;
      color:var(--slate-mid);border:1.5px solid var(--border2);
      border-radius:12px;font-family:var(--font-sans);
      font-size:14px;font-weight:600;cursor:pointer;
    ">
      Cancel
    </button>
  `;

  // Wire up buttons after insertion
  requestAnimationFrame(() => {
    sheet.querySelector('#pss-camera').onclick  = () => _pickImage(true,  sheet, callbacks);
    sheet.querySelector('#pss-gallery').onclick = () => _pickImage(false, sheet, callbacks);
    sheet.querySelector('#pss-lookup').onclick  = () => _handleManual(sheet, callbacks);
    sheet.querySelector('#pss-cancel').onclick  = _dismiss;

    const input = sheet.querySelector('#pss-input');
    input.onkeydown = (e) => { if (e.key === 'Enter') _handleManual(sheet, callbacks); };
    input.focus();
  });

  return sheet;
}

// ─── Image pick + ZXing decode ─────────────────────────────────────────────────

function _pickImage(useCamera, sheet, callbacks) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (useCamera) input.capture = 'environment';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    _showPreview(sheet, objectUrl);
    const barcode = await _decodeBarcode(objectUrl);
    URL.revokeObjectURL(objectUrl);
    const statusEl = sheet.querySelector('#pss-decode-status');
    if (barcode) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--forest);">\u2713 Barcode: ${barcode}</span>`;
      setTimeout(() => callbacks('barcode', barcode), 600);
    } else {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--saffron);">No barcode found &mdash; please type the product name below.</span>';
      sheet.querySelector('#pss-input')?.focus();
    }
  };
  input.click();
}

function _showPreview(sheet, src) {
  const wrap = sheet.querySelector('#pss-preview-wrap');
  const img  = sheet.querySelector('#pss-preview-img');
  const stat = sheet.querySelector('#pss-decode-status');
  if (wrap) wrap.style.display = 'block';
  if (img)  img.src = src;
  if (stat) stat.textContent = 'Detecting barcode\u2026';
}

async function _decodeBarcode(imageUrl) {
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(imageUrl);
    return result ? result.getText() : null;
  } catch {
    return null; // NotFoundException or anything else → just null
  }
}

// ─── Manual / URL input handler ────────────────────────────────────────────────

function _handleManual(sheet, callbacks) {
  const raw = (sheet.querySelector('#pss-input')?.value || '').trim();
  if (!raw) return;

  // Pure barcode: 8+ digits, no letters
  if (/^\d{8,}$/.test(raw)) {
    callbacks('barcode', raw);
    return;
  }

  // URL → extract product name
  const fromUrl = _parseProductUrl(raw);
  if (fromUrl) {
    callbacks('search', fromUrl);
    return;
  }

  // Plain text → search
  callbacks('search', raw);
}

/**
 * Extract a human-readable product name from a retailer URL.
 * Handles Walmart, Amazon, Flipkart, BigBasket, and generic slugs.
 */
function _parseProductUrl(raw) {
  if (!raw.startsWith('http')) return null;
  try {
    const url   = new URL(raw);
    const host  = url.hostname.replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);

    if (host.includes('walmart.com')) {
      const idx = parts.indexOf('ip');
      if (idx !== -1 && parts[idx + 1] && /[a-zA-Z]/.test(parts[idx + 1]))
        return _slug(parts[idx + 1]);
    }

    const markerIdx = parts.findIndex((p) => p === 'dp' || p === 'p' || p === 'pd');
    if (markerIdx > 0) return _slug(parts[markerIdx - 1]);

    // Generic: first long non-numeric segment
    const slug = parts.find((p) => p.length > 6 && /[a-zA-Z]/.test(p) && !/^\d+$/.test(p));
    if (slug) return _slug(slug);

    return null;
  } catch {
    return null;
  }
}

function _slug(s) {
  return decodeURIComponent(s).replace(/[-_+]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function _dismiss() {
  document.getElementById(SHEET_ID)?.remove();
  document.getElementById(BACKDROP_ID)?.remove();
}

function _el(tag, props = {}) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  return el;
}

function _btnStyle(bg) {
  return [
    `flex:1;padding:13px 10px;background:${bg};color:white;`,
    'border:none;border-radius:12px;font-family:var(--font-sans);',
    'font-size:14px;font-weight:700;cursor:pointer;',
  ].join('');
}
