/**
 * Main app: navigation, scan flow, history, search.
 * Wires together profile.js, result.js, scanner/barcode.js, and api/client.js.
 */
import { saveProfile, loadProfile, applyProfileToUi, getCurrentChild, collectProfileFromDom } from './profile.js';
import { renderResult } from './result.js';
import { startBarcodeScanner, stopBarcodeScanner } from '../scanner/barcode.js';
import { showPhotoScanSheet } from '../scanner/photo-scan.js';
import { scanBarcode, scanOcr, searchProducts, getScanHistory, logDecisionApi } from '../api/client.js';

let _lastScanId = null;

// Quick-tap demo products shown on empty home screen
const _DEMO_HINTS = [
  { barcode: '8901058852362', name: 'Maggi Noodles',    emoji: '\uD83C\uDF5C' },
  { barcode: '8901058000068', name: 'Cerelac Wheat',    emoji: '\uD83C\uDF3E' },
  { barcode: '8901396024512', name: 'Bournvita',        emoji: '\u2615' },
  { barcode: '8901015005332', name: 'Parle-G',          emoji: '\uD83C\uDF6A' },
  { barcode: '016000121027',  name: 'Cheerios',         emoji: '\uD83E\uDD63' },
  { barcode: '038000199271',  name: 'Froot Loops',      emoji: '\uD83C\uDF6E' },
];

// ─── Navigation ───

// Nav-item IDs per screen (for bottom-nav active state)
const NAV_ACTIVE = {
  home: 'nav-home', scan: 'nav-home', scanner: 'nav-home',
  scanning: 'nav-home', result: 'nav-home', search: 'nav-home',
  history: 'nav-history', profile: 'nav-profile',
};

export function goScreen(id) {
  stopBarcodeScanner(); // always stop camera when leaving scanner
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    const scrollable = target.querySelector('.scrollable');
    if (scrollable) scrollable.scrollTop = 0;
  }
  // Update bottom nav active state on all nav bars
  const activeNav = NAV_ACTIVE[id] || 'nav-home';
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('on'));
  document.querySelectorAll(`[data-nav="${activeNav}"]`).forEach((el) => el.classList.add('on'));
  if (id === 'history') loadHistory();
  if (id === 'profile') loadProfileStats();
}

export function ob(id) {
  // Onboarding screens live in the same screen stack
  goScreen(id);
  // Update ob4 question with name if collected
  if (id === 'ob4') {
    const nameEl = document.getElementById('child-name');
    const q = document.getElementById('ob4-q');
    if (q && nameEl && nameEl.value.trim()) q.textContent = `What matters most for ${nameEl.value.trim()}?`;
  }
  if (id === 'ob5') {
    const profile = collectProfileFromDom();
    applyProfileToUi({ ...profile, age_band: profile.age_band, genderEmoji: profile.genderEmoji });
  }
}

export function goHome() { goScreen('home'); }

export function skipToApp() {
  const child = getCurrentChild();
  if (child) {
    applyProfileToUi(child);
    goScreen('home');
  } else {
    goScreen('ob2');
  }
}

// ─── Onboarding helpers (called from inline onclick) ───

export function selOne(el, group) {
  // Only deselect siblings in the immediate parent container (not the whole screen)
  el.parentElement.querySelectorAll('.age-card, .chip').forEach((c) => c.classList.remove('on'));
  el.classList.add('on');
}

export function selAge(el) {
  // Scope ONLY to the age-grid, never touch gender cards
  const grid = el.closest('.age-grid') || document.querySelector('#ob2 .age-grid');
  if (grid) grid.querySelectorAll('.age-card').forEach((c) => c.classList.remove('on'));
  el.classList.add('on');
}

export function tog(el) { el.classList.toggle('on'); }

export function togGoal(el) {
  const isOn = el.classList.contains('on');
  const count = document.querySelectorAll('.goal-card.on').length;
  if (isOn) {
    el.classList.remove('on');
    el.querySelector('.goal-check').textContent = '';
  } else if (count < 3) {
    el.classList.add('on');
    el.querySelector('.goal-check').textContent = '\u2713';
  }
}

export async function handleSaveProfile() {
  const child = await saveProfile();
  applyProfileToUi(child);
  goScreen('home');
  renderHomeHistory();
}

// ─── Scan flow ───

export async function startScan(mode) {
  if (mode === 'barcode') {
    goScreen('scanner');
    const video = document.getElementById('barcode-video');
    const status = document.getElementById('scanner-status');
    await startBarcodeScanner(
      video,
      async (barcode) => {
        stopBarcodeScanner();
        await lookupAndScore(barcode, 'barcode');
      },
      (msg) => { if (status) status.textContent = msg; },
    );
  } else if (mode === 'label') {
    showPhotoScanSheet({
      onBarcode: (bc) => lookupAndScore(bc, 'barcode'),
      onSearch:  (q)  => { goScreen('search'); _runSearchQuery(q); },
    });
  }
}

async function lookupAndScore(barcode, source) {
  const child = getCurrentChild();
  goScreen('scanning');

  // Animate steps
  animateStep('step-identify', true);
  const pname = document.getElementById('scanning-product-name');
  if (pname) pname.textContent = `Barcode: ${barcode}`;

  try {
    animateStep('step-identify', false, true);
    animateStep('step-fetch', true);

    const childId = child ? child.id : null;
    const data = await scanBarcode(barcode, childId);
    _lastScanId = data.scan_id || null;

    // Offline / not-in-catalogue fallback — show suggestions instead of crashing
    if (data.not_found) {
      goScreen('home');
      showNotFoundSheet(barcode, data.suggestions || []);
      return;
    }

    animateStep('step-fetch', false, true);
    animateStep('step-score', true);
    const stepText = document.getElementById('step-score-text');
    if (stepText && child) stepText.textContent = `Scoring for ${child.name}\u2026`;
    await delay(400);

    animateStep('step-score', false, true);
    animateStep('step-flags', true);
    await delay(300);
    animateStep('step-flags', false, true);

    renderResult(data);
    autoSaveHistory(data);   // ← persist immediately, no decision needed
    goScreen('result');
    renderHomeHistory();
  } catch (err) {
    goScreen('home');
    showError(`Scan failed: ${err.message}`);
  }
}

function animateStep(id, live, done = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('live', 'done');
  if (live) el.classList.add('live');
  if (done) el.classList.add('done');
  const dot = el.querySelector('.ss-dot');
  if (dot) dot.textContent = done ? '\u2713' : live ? '\u2192' : '';
}

// ─── Decision logging ───

export async function logDecision(decision) {
  if (_lastScanId) {
    await logDecisionApi(_lastScanId, decision).catch(() => {});
  }
  // Update local history
  updateLocalHistory(decision);
  goScreen('home');
}

function autoSaveHistory(data) {
  const { product, score } = data;
  if (!product) return;
  let hist = JSON.parse(localStorage.getItem('poshanHistory') || '[]');
  hist.unshift({
    _id:     Date.now(),
    name:    product.name,
    brand:   product.brand || '',
    score:   score ? score.score  : null,
    grade:   score ? score.grade  : '?',
    topFlag: score && score.flags && score.flags.length ? score.flags[0].title : null,
    decision: null,
    time:    new Date().toISOString(),
  });
  localStorage.setItem('poshanHistory', JSON.stringify(hist.slice(0, 50)));
}

function updateLocalHistory(decision) {
  // Stamp the most recent entry with the user's decision
  let hist = JSON.parse(localStorage.getItem('poshanHistory') || '[]');
  if (hist.length) hist[0].decision = decision;
  localStorage.setItem('poshanHistory', JSON.stringify(hist));
  renderHomeHistory();
}

// ─── History ───

function gradeClass(g) {
  const l = String(g || 'C').toUpperCase();
  return { A: 'gA', B: 'gB', D: 'gD' }[l] || 'gC';
}

export function renderHomeHistory() {
  const wrap = document.getElementById('home-recent-list');
  if (!wrap) return;
  let items = [];
  try { items = JSON.parse(localStorage.getItem('poshanHistory') || '[]'); } catch { items = []; }
  if (!items.length) {
    wrap.innerHTML = `
      <div style="padding:8px 22px 4px;font-size:13px;color:var(--slate-mid);">
        No scans yet — try one of these demo products:
      </div>
      <div style="display:flex;gap:8px;padding:4px 22px 0;overflow-x:auto;scrollbar-width:none;padding-bottom:8px;">
        ${_DEMO_HINTS.map((h) => `
          <div onclick="window._scanDemo('${h.barcode}')" style="
            flex-shrink:0;background:var(--cream);border:1.5px solid var(--border);
            border-radius:13px;padding:10px 13px;cursor:pointer;min-width:130px;
          ">
            <div style="font-size:18px;margin-bottom:4px;">${h.emoji}</div>
            <div style="font-size:12px;font-weight:700;color:var(--slate);line-height:1.3;">${h.name}</div>
            <div style="font-size:10px;color:var(--terra);font-weight:700;margin-top:3px;">Tap to scan demo →</div>
          </div>`).join('')}
      </div>`;
    // Expose demo scan trigger globally
    window._scanDemo = (barcode) => lookupAndScore(barcode, 'barcode');
    return;
  }
  wrap.innerHTML = items.slice(0, 5).map((entry) => `
    <div class="recent-card">
      <div class="grade-badge ${gradeClass(entry.grade)}">${String(entry.grade || '?').toUpperCase()}</div>
      <div class="rc-info">
        <div class="rc-name">${entry.name || 'Scanned product'}</div>
        <div class="rc-brand">${entry.brand || ''} &middot; ${entry.decision === 'give' ? '\u2713 Gave' : entry.decision === 'skip' ? '\u2715 Skipped' : '\uD83D\uDD0D Scanned'}</div>
        <div class="rc-flags">
          <div class="rc-flag ${entry.score >= 65 ? 'fok' : entry.score >= 45 ? 'fw' : 'fb'}">
            ${entry.score != null ? `${entry.score}/100` : 'No score'}
          </div>
        </div>
      </div>
      <div class="rc-arr">\u203a</div>
    </div>`).join('');
}

function _buildPatternCard(items) {
  if (!items.length) return '';
  const child = getCurrentChild();
  const name = child ? child.name : 'your child';
  // Last 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const week = items.filter((x) => x.time >= cutoff);
  if (!week.length) return '';
  const withScores = week.filter((x) => x.score != null);
  const avg = withScores.length
    ? Math.round(withScores.reduce((s, x) => s + x.score, 0) / withScores.length)
    : null;
  const concerns = week.flatMap((x) => x.topFlag ? [x.topFlag] : []);
  const topConcern = concerns.length
    ? concerns.sort((a, b) => concerns.filter((c) => c === b).length - concerns.filter((c) => c === a).length)[0]
    : 'ultra-processing';
  const avgColor = avg == null ? 'var(--slate)' : avg >= 65 ? 'var(--forest)' : avg >= 45 ? 'var(--saffron)' : 'var(--rose)';
  return `
    <div class="pattern-card">
      <div class="pc-label">📈 This week&rsquo;s pattern</div>
      <div class="pc-text">${name}&rsquo;s scans average
        <span style="color:${avgColor};font-weight:800;">${avg != null ? avg + '/100' : '—'}</span> this week.
        ${topConcern ? `${topConcern} is the most common concern — flagged in ${concerns.filter((c) => c === topConcern).length} of ${week.length} product${week.length > 1 ? 's' : ''}.` : ''}
      </div>
    </div>`;
}

async function loadHistory() {
  const wrap = document.getElementById('history-list');
  if (!wrap) return;

  let items = [];
  try { items = JSON.parse(localStorage.getItem('poshanHistory') || '[]'); } catch { items = []; }

  if (!items.length) {
    wrap.innerHTML = '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">No scans yet &mdash; scan a product to get started!</div>';
    return;
  }

  const decisionLabel = (d) =>
    d === 'give' ? '<span style="color:var(--forest);">\u2713 Gave</span>'
    : d === 'skip' ? '<span style="color:var(--rose);">\u2715 Skipped</span>'
    : '<span style="color:var(--slate-mid);">\uD83D\uDD0D Scanned</span>';

  const timeLabel = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.round((now - d) / 36e5);
    if (diffH < 1)  return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  };

  wrap.innerHTML =
    _buildPatternCard(items) +
    '<div class="hist-period">All scans</div>' +
    items.map((e) => `
      <div class="recent-card">
        <div class="grade-badge ${gradeClass(e.grade)}">${String(e.grade || '?').toUpperCase()}</div>
        <div class="rc-info">
          <div class="rc-name">${e.name || 'Product'}</div>
          <div class="rc-brand">${e.brand || ''} &middot; ${decisionLabel(e.decision)}</div>
          <div class="rc-flags">
            <div class="rc-flag ${(e.score||0)>=65?'fok':(e.score||0)>=45?'fw':'fb'}">
              ${e.score != null ? `${e.score}/100` : 'No score'}
            </div>
            <div class="rc-flag" style="font-size:10px;color:var(--slate-mid);border:none;background:none;">${timeLabel(e.time)}</div>
          </div>
        </div>
        <div class="rc-arr">\u203a</div>
      </div>`).join('');
}

function loadProfileStats() {
  let items = [];
  try { items = JSON.parse(localStorage.getItem('poshanHistory') || '[]'); } catch { items = []; }
  const n = items.length;
  const avoided = items.filter((x) => x.decision === 'skip').length;
  const avg = n ? Math.round(items.filter((x) => x.score != null).reduce((s, x) => s + x.score, 0) / items.length) : 0;
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  s('stat-scans', n); s('stat-avg', avg || '\u2014'); s('stat-avoided', avoided);
}

// ─── Search ───

/**
 * Parse a product URL from any retailer into a search query string.
 * Returns the extracted name/query, or null if not a URL.
 */
function parseProductUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('http')) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);

    // Walmart: /ip/Product-Name/id  or  /ip/id
    if (host.includes('walmart.com')) {
      const ipIdx = parts.indexOf('ip');
      if (ipIdx !== -1 && parts[ipIdx + 1] && /[a-zA-Z]/.test(parts[ipIdx + 1]))
        return decodeURIComponent(parts[ipIdx + 1]).replace(/-/g, ' ');
    }

    // Amazon/Flipkart: text segment before /dp/ or /p/
    const markerIdx = parts.findIndex((p) => p === 'dp' || p === 'p');
    if (markerIdx > 0) {
      return decodeURIComponent(parts[markerIdx - 1]).replace(/[-_]/g, ' ');
    }

    // BigBasket / generic e-commerce: first long non-numeric slug in path
    const slug = parts.find((p) => p.length > 8 && /[a-zA-Z]/.test(p) && !/^\d+$/.test(p));
    if (slug) return decodeURIComponent(slug).replace(/[-_]/g, ' ');

    // Last resort: meaningful words from the whole path
    const words = url.pathname
      .split(/[/\-_%+]/).map(decodeURIComponent)
      .filter((w) => w.length > 3 && !/^\d+$/.test(w));
    return words.length ? words.join(' ') : null;
  } catch {
    return null;
  }
}

async function _runSearchQuery(query) {
  const inputEl = document.getElementById('search-input');
  if (inputEl) inputEl.value = query;
  await runSearch();
}

export async function runSearch() {
  const q = document.getElementById('search-input');
  if (!q || !q.value.trim()) return;

  let searchTerm = q.value.trim();
  const fromUrl = parseProductUrl(searchTerm);
  if (fromUrl) {
    searchTerm = fromUrl;
    q.value = fromUrl;     // show the extracted name in the box
    showError(`Searching for “${fromUrl}” from that link 🔗`, 2500);
  }

  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">Searching\u2026</div>';
  try {
    const child = getCurrentChild();
    const data = await searchProducts(searchTerm, child ? child.id : null);
    const { products, scores } = data;
    if (!products.length) {
      if (resultsEl) resultsEl.innerHTML = '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">No results found. Try a different name.</div>';
      return;
    }
    if (resultsEl) {
      resultsEl.innerHTML = products.map((p, i) => {
        const s = scores && scores[i];
        const grade = s ? s.grade : '?';
        return `<div class="recent-card" onclick="window._selectSearchResult(${i})">
          <div class="grade-badge ${gradeClass(grade)}">${grade}</div>
          <div class="rc-info">
            <div class="rc-name">${p.name}</div>
            <div class="rc-brand">${p.brand || ''}</div>
            ${s ? `<div class="rc-flags"><div class="rc-flag fw">${s.score}/100</div></div>` : ''}
          </div>
          <div class="rc-arr">\u203a</div>
        </div>`;
      }).join('');
    }
    window._selectSearchResult = (i) => {
      const data = { product: products[i], score: scores ? scores[i] : null };
      renderResult(data);
      autoSaveHistory(data);
      goScreen('result');
    };
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<div style="padding:20px 22px;font-size:13px;color:var(--rose);">Search failed: ${err.message}</div>`;
  }
}

// ─── Utilities ───

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function showError(msg, durationMs = 3500) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.textContent = msg;
  banner.style.display = 'block';
  setTimeout(() => { banner.style.display = 'none'; }, durationMs);
}

/**
 * Show a bottom sheet when scanned barcode isn't in the offline catalogue.
 * Offers similar demo products and a search shortcut.
 */
export function showNotFoundSheet(barcode, suggestions = []) {
  // Remove any existing sheet
  document.getElementById('not-found-sheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = 'not-found-sheet';
  sheet.style.cssText = [
    'position:fixed;bottom:0;left:0;right:0;z-index:9000;',
    'background:var(--cream);border-radius:20px 20px 0 0;',
    'box-shadow:0 -8px 40px rgba(61,43,31,0.18);',
    'padding:20px 22px 40px;',
    'animation:slideUp .28s cubic-bezier(0.16,1,0.3,1);',
  ].join('');

  const suggestionsHtml = suggestions.length
    ? suggestions.map((s) => {
        const p = s.product;
        if (!p) return '';
        return `<div class="recent-card" style="cursor:pointer;" onclick="window._loadSuggestion('${p.barcode}')">
          <div class="grade-badge gB" style="font-size:13px;">📦</div>
          <div class="rc-info">
            <div class="rc-name">${p.name}</div>
            <div class="rc-brand">${p.brand || ''} · Try this demo</div>
          </div>
          <div class="rc-arr">›</div>
        </div>`;
      }).join('')
    : '';

  sheet.innerHTML = `
    <div style="width:36px;height:4px;background:var(--sand3);border-radius:2px;margin:0 auto 18px;"></div>
    <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;color:var(--slate);margin-bottom:5px;">
      Product not in offline catalogue
    </div>
    <div style="font-size:13px;color:var(--slate-mid);margin-bottom:16px;line-height:1.6;">
      Barcode <strong>${barcode}</strong> isn't in the local database yet.
      External APIs are pending network access. Try these similar products or search by name:
    </div>
    ${suggestionsHtml}
    <button onclick="document.getElementById('not-found-sheet').remove();window.goScreen('search');" style="
      width:100%;padding:15px;background:var(--terra);color:white;
      border:none;border-radius:14px;font-family:var(--font-sans);
      font-size:15px;font-weight:700;cursor:pointer;margin-top:10px;
    ">🔍 Search by product name</button>
    <button onclick="document.getElementById('not-found-sheet').remove();" style="
      width:100%;padding:12px;background:transparent;color:var(--slate-mid);
      border:1.5px solid var(--border2);border-radius:14px;font-family:var(--font-sans);
      font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;
    ">Dismiss</button>
  `;

  document.body.appendChild(sheet);

  // Clicking a suggestion loads it as if it were scanned
  window._loadSuggestion = async (bc) => {
    sheet.remove();
    await lookupAndScore(bc, 'barcode');
  };

  // Tap outside to dismiss
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:8999;background:rgba(0,0,0,0.3);';
  backdrop.onclick = () => { sheet.remove(); backdrop.remove(); };
  document.body.insertBefore(backdrop, sheet);
}
