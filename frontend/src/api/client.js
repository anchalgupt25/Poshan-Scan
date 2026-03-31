/**
 * Poshan Scan API client.
 * All backend calls go through here. Vite proxies /api -> http://localhost:8000.
 */

const BASE = '/api';

/** Read session ID from localStorage (or create one). */
export function getSessionId() {
  let sid = localStorage.getItem('poshanSession');
  if (!sid) {
    sid = 'session-' + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem('poshanSession', sid);
  }
  return sid;
}

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Session-Id': getSessionId(),
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${BASE}${path}`, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.status === 204 ? null : resp.json();
}

/* ─── Children ─── */

export async function createChild(profile) {
  return request('POST', '/children/', profile);
}

export async function listChildren() {
  return request('GET', '/children/');
}

export async function updateChild(id, update) {
  return request('PUT', `/children/${id}`, update);
}

export async function deleteChild(id) {
  return request('DELETE', `/children/${id}`);
}

/* ─── Scan ─── */

export async function scanBarcode(barcode, childId = null) {
  const qs = childId ? `?child_id=${childId}` : '';
  return request('GET', `/scan/barcode/${barcode}${qs}`);
}

export async function scanOcr(rawText, childId = null) {
  return request('POST', '/scan/ocr', { raw_text: rawText, child_id: childId });
}

export async function searchProducts(query, childId = null) {
  const qs = childId ? `&child_id=${childId}` : '';
  return request('GET', `/scan/search?q=${encodeURIComponent(query)}${qs}`);
}

export async function getScanHistory(childId, limit = 20) {
  return request('GET', `/scan/history/${childId}?limit=${limit}`);
}

export async function logDecisionApi(scanId, decision) {
  return request('PATCH', `/scan/history/${scanId}/decision?decision=${decision}`);
}
