// Frontend API helper — talks to the FastAPI backend.
//
// Dev: Vite proxies /api/* → http://localhost:8000 (see vite.config.js).
//      → API_BASE = '/api' (relative, proxied)
// Prod: VITE_API_BASE_URL set at build time → absolute URL of backend.
//      → e.g. 'https://nouri-scan-api.onrender.com'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;

const SESSION_KEY = 'nouri:session';
const AUTH_TOKEN_KEY = 'nouri:auth-token';
const AUTH_EMAIL_KEY = 'nouri:auth-email';

// Stable per-browser session id (anonymous user identifier for the FastAPI backend)
export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess-' + Math.random().toString(36).slice(2) + '-' + Date.now();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getAuthToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || null; }
export function getAuthEmail() { return localStorage.getItem(AUTH_EMAIL_KEY) || null; }
export function setAuthLocal(token, email) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token); else localStorage.removeItem(AUTH_TOKEN_KEY);
  if (email) localStorage.setItem(AUTH_EMAIL_KEY, email); else localStorage.removeItem(AUTH_EMAIL_KEY);
}

function headers(extra = {}) {
  const h = {
    'content-type': 'application/json',
    'x-session-id': getSessionId(),
    ...extra,
  };
  const token = getAuthToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
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

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function requestOtp(email, inviteCode) {
  const r = await fetch(apiUrl('/auth/request-otp'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, invite_code: inviteCode }),
  });
  return jsonOrThrow(r);
}

export async function verifyOtp(email, code) {
  const r = await fetch(apiUrl('/auth/verify-otp'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, code }),
  });
  return jsonOrThrow(r);
}

export async function fetchMe() {
  const token = getAuthToken();
  if (!token) return null;
  const r = await fetch(apiUrl('/auth/me'), { headers: headers() });
  if (!r.ok) return null;
  return r.json();
}

// ─── Admin (gated server-side by ADMIN_EMAILS allowlist) ───────────────────

export async function adminStats() {
  const r = await fetch(apiUrl('/admin/stats'), { headers: headers() });
  return jsonOrThrow(r);
}
export async function adminUsers(limit = 100) {
  const r = await fetch(apiUrl(`/admin/users?limit=${limit}`), { headers: headers() });
  return jsonOrThrow(r);
}
export async function adminSignupsByDay() {
  const r = await fetch(apiUrl('/admin/signups-by-day'), { headers: headers() });
  return jsonOrThrow(r);
}
export async function adminScansByDay() {
  const r = await fetch(apiUrl('/admin/scans-by-day'), { headers: headers() });
  return jsonOrThrow(r);
}
export async function adminTopProducts(limit = 25) {
  const r = await fetch(apiUrl(`/admin/top-products?limit=${limit}`), { headers: headers() });
  return jsonOrThrow(r);
}

// ─── Children ──────────────────────────────────────────────────────────────

export async function listChildren() {
  const r = await fetch(apiUrl('/children/'), { headers: headers() });
  return jsonOrThrow(r);
}

export async function createChild(profile) {
  // profile: { name, age_band, gender, diet_type, allergies: [], goals: [], cuisine?: '' }
  const r = await fetch(apiUrl('/children/'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(profile),
  });
  return jsonOrThrow(r);
}

// ─── Scan ──────────────────────────────────────────────────────────────────

export async function scanBarcode(barcode, childId) {
  const url = apiUrl(`/scan/barcode/${encodeURIComponent(barcode.trim())}`)
            + (childId ? `?child_id=${childId}` : '');
  const r = await fetch(url, { headers: headers() });
  return jsonOrThrow(r);
}

export async function searchProducts(query, childId) {
  const url = apiUrl(`/scan/search?q=${encodeURIComponent(query.trim())}`)
            + (childId ? `&child_id=${childId}` : '');
  const r = await fetch(url, { headers: headers() });
  return jsonOrThrow(r);
}

export async function ocrLabelImage(imageDataUrl, childId) {
  const mime = (imageDataUrl.match(/^data:([^;]+);/) || [, 'image/jpeg'])[1];
  const r = await fetch(apiUrl('/scan/ocr-image'), {
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
  const r = await fetch(apiUrl(`/scan/history/${childId}?limit=${limit}`), { headers: headers() });
  return jsonOrThrow(r);
}

// ─── Nouri Bot ─────────────────────────────────────────────────────────────

export async function chatWithNouri({ message, context = 'result', childId, scanData, history = [] }) {
  const r = await fetch(apiUrl('/nouri/chat'), {
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
      // Strip long numeric IDs (Walmart/Target item IDs etc.)
      .replace(/\b\d{5,}\b/g, '')
      // Strip size/quantity phrases — common URL noise that hurts search
      .replace(/\b\d+\s*(oz|fl oz|lb|lbs|kg|g|ml|l|ct|count|pk|pack|packs|servings?|biscuits?|bars?|snacks?|pieces?)\b/gi, '')
      // Strip patterns like "5 Packs", "4 Per Pack", "per serving"
      .replace(/\b\d+\s+per\b/gi, '')
      .replace(/\bper\s+(pack|serving|day|biscuit|bar|piece)s?\b/gi, '')
      // Drop trailing standalone numbers
      .replace(/\b\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);

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
