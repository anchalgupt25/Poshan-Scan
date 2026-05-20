// Frontend API helper — talks to the FastAPI backend.
// Vite proxies /api/* → http://localhost:8000 (see vite.config.js).

const SESSION_KEY = 'nouri:session';

// Stable per-browser session id (anonymous user identifier for the FastAPI backend)
export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess-' + Math.random().toString(36).slice(2) + '-' + Date.now();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function headers(extra = {}) {
  return {
    'content-type': 'application/json',
    'x-session-id': getSessionId(),
    ...extra,
  };
}

async function jsonOrThrow(r) {
  if (!r.ok) {
    let msg = `Request failed (${r.status})`;
    try {
      const data = await r.json();
      msg = data.detail || data.error || data.message || msg;
    } catch (_) {}
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// ─── Children ──────────────────────────────────────────────────────────────

export async function listChildren() {
  const r = await fetch('/api/children/', { headers: headers() });
  return jsonOrThrow(r);
}

export async function createChild(profile) {
  // profile: { name, age_band, gender, diet_type, allergies: [], goals: [], cuisine?: '' }
  const r = await fetch('/api/children/', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(profile),
  });
  return jsonOrThrow(r);
}

// ─── Scan ──────────────────────────────────────────────────────────────────

export async function scanBarcode(barcode, childId) {
  const url = `/api/scan/barcode/${encodeURIComponent(barcode.trim())}` +
              (childId ? `?child_id=${childId}` : '');
  const r = await fetch(url, { headers: headers() });
  return jsonOrThrow(r);
}

export async function searchProducts(query, childId) {
  const url = `/api/scan/search?q=${encodeURIComponent(query.trim())}` +
              (childId ? `&child_id=${childId}` : '');
  const r = await fetch(url, { headers: headers() });
  return jsonOrThrow(r);
}

export async function ocrLabelImage(imageDataUrl, childId) {
  const mime = (imageDataUrl.match(/^data:([^;]+);/) || [, 'image/jpeg'])[1];
  const r = await fetch('/api/scan/ocr-image', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      imageBase64: imageDataUrl,
      mimeType: mime,
      child_id: childId,
    }),
  });
  return jsonOrThrow(r);
}

export async function getScanHistory(childId, limit = 10) {
  const r = await fetch(`/api/scan/history/${childId}?limit=${limit}`, { headers: headers() });
  return jsonOrThrow(r);
}

// ─── Nouri Bot ─────────────────────────────────────────────────────────────

export async function chatWithNouri({ message, context = 'result', childId, scanData, history = [] }) {
  const r = await fetch('/api/nouri/chat', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      message,
      context,
      child_id: childId,
      scan_data: scanData,
      history,
    }),
  });
  return jsonOrThrow(r);
}

// ─── URL helpers ───────────────────────────────────────────────────────────

// Extract a UPC/EAN barcode from a retailer URL if present.
export function extractBarcodeFromUrl(url) {
  if (!url) return null;
  const patterns = [
    /[?&]upc=(\d{8,14})/i,
    /[?&]ean=(\d{8,14})/i,
    /[?&]gtin=(\d{8,14})/i,
    /\/(\d{12,13})(?:[/?]|$)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Pull a search-friendly product name out of a retailer URL path.
export function extractSearchTermFromUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return ''; }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (!segments.length) return '';

  const clean = (s) =>
    decodeURIComponent(String(s || ''))
      .replace(/-39-/g, "'")
      .replace(/-amp-/g, ' & ')
      .replace(/[-_+]+/g, ' ')
      .replace(/\b\d{6,}\b/g, '')
      .replace(/\b\d+\s*(oz|lb|ct|count|pk|pack)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

  // Amazon: /dp/{id}
  const dpIdx = segments.findIndex((s) => s === 'dp' || s === 'gp');
  if (dpIdx > 0) return clean(segments[dpIdx - 1]);
  // Walmart: /ip/{name}/{id}
  const ipIdx = segments.findIndex((s) => s === 'ip');
  if (ipIdx >= 0 && segments[ipIdx + 1]) return clean(segments[ipIdx + 1]);
  // Target: /p/{name}/-/A-{id}
  if (segments[0] === 'p' && segments[1]) return clean(segments[1]);
  // Instacart: /products/{slug}
  const prodIdx = segments.findIndex((s) => s === 'products' || s === 'product');
  if (prodIdx >= 0 && segments[prodIdx + 1]) return clean(segments[prodIdx + 1]);

  // Fallback: longest segment that looks like a name
  const best = segments
    .filter((s) => /[a-z]/i.test(s) && s.length >= 4 && !/^(dp|gp|ip|products?|item|en|us|p)$/i.test(s))
    .sort((a, b) => b.length - a.length)[0];
  return clean(best || '');
}
