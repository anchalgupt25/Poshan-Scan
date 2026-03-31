/**
 * Main app: navigation, scan flow, history, search.
 * Wires together profile.js, result.js, scanner/barcode.js, and api/client.js.
 */
import { saveProfile, loadProfile, applyProfileToUi, getCurrentChild, collectProfileFromDom } from './profile.js';
import { renderResult } from './result.js';
import { startBarcodeScanner, stopBarcodeScanner } from '../scanner/barcode.js';
import { scanBarcode, scanOcr, searchProducts, getScanHistory, logDecisionApi } from '../api/client.js';

let _lastScanId = null;

// ─── Navigation ───

export function goScreen(id) {
  stopBarcodeScanner(); // always stop camera when leaving scanner
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    const scrollable = target.querySelector('.scrollable');
    if (scrollable) scrollable.scrollTop = 0;
  }
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
  el.parentElement.querySelectorAll('.age-card, .chip').forEach((c) => c.classList.remove('on'));
  el.classList.add('on');
}

export function selAge(el) {
  document.querySelectorAll('#ob2 .age-card').forEach((c) => c.classList.remove('on'));
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
    // Trigger file picker for photo label
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async () => {
      showError('OCR scanning coming soon! Use the Element LLM Gateway key to enable it.', 4000);
    };
    input.click();
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
    goScreen('result');
    renderHomeHistory();
  } catch (err) {
    goScreen('home');
    showError(err.message.includes('not found')
      ? 'Product not found. Try searching by name instead.'
      : `Scan failed: ${err.message}`);
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

function updateLocalHistory(decision) {
  const last = window._lastScanResult;
  if (!last) return;
  let hist = JSON.parse(localStorage.getItem('poshanHistory') || '[]');
  hist.unshift({
    name: last.product.name,
    brand: last.product.brand,
    score: last.score ? last.score.score : null,
    grade: last.score ? last.score.grade : '?',
    decision,
    time: new Date().toISOString(),
  });
  localStorage.setItem('poshanHistory', JSON.stringify(hist.slice(0, 50)));
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
    wrap.innerHTML = '<div style="padding:8px 22px 0;font-size:13px;color:var(--slate-mid);">No scans yet. Tap to scan your first product!</div>';
    return;
  }
  wrap.innerHTML = items.slice(0, 5).map((entry) => `
    <div class="recent-card">
      <div class="grade-badge ${gradeClass(entry.grade)}">${String(entry.grade || '?').toUpperCase()}</div>
      <div class="rc-info">
        <div class="rc-name">${entry.name || 'Scanned product'}</div>
        <div class="rc-brand">${entry.brand || ''} \u00b7 ${entry.decision === 'give' ? '\u2713 Gave' : '\u2715 Skipped'}</div>
        <div class="rc-flags">
          <div class="rc-flag ${entry.score >= 65 ? 'fok' : entry.score >= 50 ? 'fw' : 'fb'}">
            ${entry.score != null ? `${entry.score}/100` : 'No score'}
          </div>
        </div>
      </div>
      <div class="rc-arr">\u203a</div>
    </div>`).join('');
}

async function loadHistory() {
  const child = getCurrentChild();
  const wrap = document.getElementById('history-list');
  if (!wrap) return;
  if (!child || !child.id) {
    // Fallback to localStorage
    let items = [];
    try { items = JSON.parse(localStorage.getItem('poshanHistory') || '[]'); } catch { items = []; }
    wrap.innerHTML = items.length
      ? '<div class="hist-period">Recent scans</div>' + items.map((e) => `
          <div class="recent-card">
            <div class="grade-badge ${gradeClass(e.grade)}">${String(e.grade || '?').toUpperCase()}</div>
            <div class="rc-info"><div class="rc-name">${e.name || 'Product'}</div>
            <div class="rc-brand">${e.score != null ? `${e.score}/100` : ''} \u00b7 ${e.decision || ''}</div></div>
            <div class="rc-arr">\u203a</div>
          </div>`).join('')
      : '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">No scan history yet.</div>';
    return;
  }
  try {
    const history = await getScanHistory(child.id);
    wrap.innerHTML = history.length
      ? '<div class="hist-period">Scan history</div>' + history.map((h) => {
          const sr = h.score_result || {};
          return `<div class="recent-card">
            <div class="grade-badge ${gradeClass(sr.grade)}">${String(sr.grade || '?').toUpperCase()}</div>
            <div class="rc-info">
              <div class="rc-name">${h.barcode ? `Barcode: ${h.barcode}` : 'Scan'}</div>
              <div class="rc-brand">${sr.score != null ? `${sr.score}/100` : ''} \u00b7 ${h.parent_decision || 'undecided'}</div>
            </div>
            <div class="rc-arr">\u203a</div>
          </div>`;
        }).join('')
      : '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">No scan history yet.</div>';
  } catch {
    wrap.innerHTML = '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">Could not load history.</div>';
  }
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

export async function runSearch() {
  const q = document.getElementById('search-input');
  if (!q || !q.value.trim()) return;
  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div style="padding:20px 22px;font-size:13px;color:var(--slate-mid);">Searching\u2026</div>';
  try {
    const child = getCurrentChild();
    const data = await searchProducts(q.value.trim(), child ? child.id : null);
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
      renderResult({ product: products[i], score: scores ? scores[i] : null });
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
