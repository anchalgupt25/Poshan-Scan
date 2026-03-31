/**
 * Render the Result screen from a ScoreResult + Product API response.
 */
import { getCurrentChild } from './profile.js';

const DIM_LABELS = {
  nutrition: 'Nutrition',
  ingredients: 'Ingredients',
  processing: 'Processing',
  age_safety: 'Age Safety',
};

const DIM_COLORS = {
  nutrition: 'var(--saffron)',
  ingredients: 'var(--terra)',
  processing: 'var(--rose)',
  age_safety: 'var(--forest)',
};

function gradeStyle(grade) {
  const g = (grade || 'C').toUpperCase();
  if (g === 'A') return 'background:rgba(45,106,79,0.12);color:var(--forest);border:1px solid rgba(45,106,79,0.25);';
  if (g === 'B') return 'background:rgba(212,160,23,0.12);color:var(--turmeric);border:1px solid rgba(212,160,23,0.25);';
  if (g === 'D') return 'background:rgba(192,69,75,0.12);color:var(--rose);border:1px solid rgba(192,69,75,0.25);';
  return 'background:rgba(232,146,10,0.12);color:var(--saffron);border:1px solid rgba(232,146,10,0.25);';
}

function scoreColor(score) {
  if (score >= 65) return 'var(--forest)';
  if (score >= 50) return 'var(--saffron)';
  return 'var(--rose)';
}

export function renderResult(apiResponse) {
  const { product, score: result } = apiResponse;
  const demoMode = apiResponse.demo_mode || false;
  const dataSource = apiResponse.data_source || 'scan';
  if (!product) return;

  const child = getCurrentChild();
  const name = child ? child.name : 'Child';
  const age = child ? (child.age_band || child.ageBand || '') : '';
  const emoji = child ? (child.genderEmoji || '\ud83d\udc76') : '\ud83d\udc76';

  // Score ring
  const scoreNum = result ? result.score : 0;
  const ring = document.getElementById('score-ring');
  const numEl = document.getElementById('score-num');
  if (ring) {
    const offset = 264 * (1 - scoreNum / 100);
    ring.setAttribute('stroke-dashoffset', String(offset));
    ring.setAttribute('stroke', scoreColor(scoreNum));
  }
  if (numEl) { numEl.textContent = String(scoreNum); numEl.style.color = scoreColor(scoreNum); }

  // Grade pill
  const grade = result ? result.grade : '?';
  const gradeLabel = result ? result.grade_label : '';
  const pill = document.getElementById('grade-pill');
  if (pill) { pill.setAttribute('style', gradeStyle(grade)); pill.textContent = `Grade ${grade} \u00b7 ${gradeLabel}`; }

  // Product info
  const el = (id) => document.getElementById(id);
  if (el('result-product-name')) el('result-product-name').textContent = product.name || 'Product';
  if (el('result-product-brand')) el('result-product-brand').textContent = `${product.subtitle || ''} \u00b7 ${product.brand || ''}`.replace(/^ \u00b7 /, '');
  if (el('result-tag-type')) el('result-tag-type').textContent = `\ud83d\udce6 ${product.category || 'Product'}`;
  if (el('result-tag-age')) el('result-tag-age').textContent = `${emoji} ${age}`;
  // Source tag — show data origin + demo badge
  const sourceLabel = demoMode ? '📦 Demo data'
    : dataSource === 'open_food_facts' ? '🌍 Open Food Facts'
    : dataSource === 'usda_fdc' ? '🏛 USDA FDC'
    : dataSource === 'cache' ? '⚡ Cached'
    : `🔬 ${(result && result.scan_source) || 'Scan'}`;
  if (el('result-tag-source')) {
    el('result-tag-source').textContent = sourceLabel;
    if (demoMode) el('result-tag-source').style.cssText = 'background:var(--saffron-light);color:var(--saffron);border-radius:999px;';
  }

  // Child lens
  const lens = document.getElementById('child-lens-text');
  if (lens) {
    lens.querySelector('.cl-text').innerHTML =
      `Scored for <strong>${name} at ${age}</strong> \u2014 using age-appropriate WHO/AAP thresholds.`;
    lens.querySelector('.cl-icon').textContent = emoji;
  }

  if (!result) return;

  // Insights grid (top 4 nutrient highlights)
  const insightGrid = document.getElementById('insights-grid');
  if (insightGrid) {
    const insights = result.nutrient_insights || [];
    const top4 = insights.slice(0, 4);
    insightGrid.innerHTML = top4.map((ins) => {
      const statusColor = ins.status === 'good' ? 'var(--forest)'
        : ins.status === 'warn' ? 'var(--rose)'
        : ins.status === 'caution' ? 'var(--saffron)' : 'var(--slate-mid)';
      return `<div class="insight-card" style="border-color:${statusColor}22;background:${statusColor}08;">
        <div class="ic-label" style="color:${statusColor};">${ins.name}</div>
        <div class="ic-value">${ins.value}${ins.unit}</div>
        <div class="ic-unit" style="color:${statusColor};">${ins.pct_of_daily != null ? `${ins.pct_of_daily}% daily` : ins.status}</div>
      </div>`;
    }).join('');
  }

  // Score dimensions
  const dimRows = document.getElementById('dim-rows');
  if (dimRows) {
    const dims = result.dimensions || {};
    dimRows.innerHTML = Object.entries(DIM_LABELS).map(([key, label]) => {
      const val = dims[key] || 0;
      const color = DIM_COLORS[key] || 'var(--terra)';
      return `<div class="dim-row">
        <div class="dim-label">${label}</div>
        <div class="dim-bg"><div class="dim-fill" style="width:${val}%;background:${color};"></div></div>
        <div class="dim-val" style="color:${color};">${val}</div>
      </div>`;
    }).join('');
  }

  // Flags
  const flagsList = document.getElementById('flags-list');
  if (flagsList) {
    const flags = result.flags || [];
    if (!flags.length) {
      flagsList.innerHTML = '<div class="flag-card green"><div class="flag-dot green"></div><div class="flag-body"><div class="flag-title">No major concerns found \u2713</div><div class="flag-detail">Ingredient and watchlist scan came up clean for this product.</div></div></div>';
    } else {
      flagsList.innerHTML = flags.map((f) => `
        <div class="flag-card ${f.severity}">
          <div class="flag-dot ${f.severity}"></div>
          <div class="flag-body">
            <div class="flag-title">${f.title}</div>
            <div class="flag-detail">${f.detail}</div>
            ${f.source_citation ? `<div class="flag-src">Source: ${f.source_citation}</div>` : ''}
          </div>
        </div>`).join('');
    }
  }

  // Nutrient table
  const ntTable = document.getElementById('nutrient-table');
  if (ntTable) {
    const ins = result.nutrient_insights || [];
    ntTable.innerHTML = ins.map((n) => {
      const pct = n.pct_of_daily || 0;
      const barW = Math.min(pct, 100);
      const color = n.status === 'good' ? 'var(--forest)'
        : n.status === 'warn' ? 'var(--rose)' : 'var(--saffron)';
      return `<div class="nt-row">
        <div class="nt-name">${n.name}</div>
        <div class="nt-bg"><div class="nt-fill" style="width:${barW}%;background:${color};"></div></div>
        <div class="nt-val">${n.value}${n.unit}</div>
        <div class="nt-pct" style="color:${color};">${pct ? pct + '%' : '\u2014'}</div>
      </div>`;
    }).join('');
  }

  // Verdict
  const vc = document.getElementById('verdict-card');
  const vt = document.getElementById('verdict-text');
  const vl = document.getElementById('verdict-label');
  if (vc && vt && vl) {
    const g = (grade || 'C').toUpperCase();
    vc.className = 'verdict-card ' + (g === 'A' || g === 'B' ? 'safe' : g === 'D' ? 'avoid' : 'caution');
    vl.textContent = g === 'A' ? '\u2714 Good Choice' : g === 'B' ? '\u26a0 Good With Notes' : g === 'D' ? '\ud83d\udd34 Avoid' : '\u26a0 Use Occasionally';
    vl.style.color = scoreColor(scoreNum);
    vt.textContent = result.verdict_text || 'Educational information only \u2014 not medical advice.';
  }

  // Store result for decision logging
  window._lastScanResult = { product, score: result };
}
