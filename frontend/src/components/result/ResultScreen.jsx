import React from 'react';
import useStore from '../../store/useStore';
import BotFab from '../shared/BotFab';
import './result.css';

function gradeColor(grade) {
  if (grade === 'A') return 'var(--sage)';
  if (grade === 'B') return 'var(--butter)';
  if (grade === 'C') return 'var(--coral)';
  return '#C0392B';
}

// Verdict band: based on the worst flag severity, pick safe/warn/flag bucket.
function verdictBucket(flags = [], grade) {
  const red = flags.find((f) => (f.severity || '').toLowerCase() === 'red');
  if (red) return { bucket: 'flag', icon: '!', label: red.title || 'Flagged' };
  const orange = flags.find((f) => (f.severity || '').toLowerCase() === 'orange');
  if (orange) return { bucket: 'warn', icon: '⚠', label: orange.title || 'Use with care' };
  if (grade === 'A') return { bucket: 'safe', icon: '✓', label: 'Looks good — give it' };
  if (grade === 'B') return { bucket: 'safe', icon: '✓', label: 'Fine a few times a week' };
  if (grade === 'C') return { bucket: 'warn', icon: '⚠', label: 'Occasional treat only' };
  if (grade === 'D') return { bucket: 'flag', icon: '!', label: 'Consider skipping' };
  return { bucket: 'safe', icon: '✓', label: 'Scanned' };
}

// Build Good stuff + Watch out lists from BOTH the backend's explicit flags
// AND the nutrient insights themselves.
//
// Rules (per user-defined logic):
//   GOOD = any nutrient supplying ≥10% of daily need (calcium, iron, protein,
//          fiber, etc.) OR any explicit non-severity flag
//   WATCH = any nutrient with status 'warn' (over limit), any red/orange flag,
//          any added sugar over caution threshold, any artificial dye/flavor hit
function deriveFlagColumns({ flags = [], insights = [], product, score, ageBand }) {
  const good = [];
  const bad = [];

  // Explicit backend flags
  for (const f of flags) {
    const sev = (f.severity || '').toLowerCase();
    if (sev === 'red' || sev === 'orange') {
      bad.push({ title: f.title, detail: f.detail });
    } else if (sev === 'green') {
      good.push({ title: f.title, detail: f.detail });
    }
  }

  // Derive from nutrient insights
  for (const ins of insights) {
    const name = (ins.name || '').toLowerCase();
    const status = (ins.status || '').toLowerCase();
    const pct = Number(ins.pct_of_daily) || 0;
    const value = parseFloat(ins.value) || 0;

    // "Watch out" — sodium / added sugar over limit; nutrients flagged warn
    if (status === 'warn') {
      const pretty = ins.name + (pct ? ` — ${Math.round(pct)}% of daily` : '');
      bad.push({
        title: `${pretty}`,
        detail: name.includes('sodium')
          ? 'Above AAP soft limit for this age — keep an eye on day-total.'
          : name.includes('sugar')
          ? 'AAP recommends zero added sugar under 2y; <25g/day for 2-5y.'
          : 'Above the soft limit for this age band.',
      });
      continue;
    }

    // "Good stuff" — nutrient supplies ≥10% of daily for things parents look for
    const isLookFor = ['protein', 'iron', 'calcium', 'fiber', 'zinc'].some((k) => name.includes(k));
    if (isLookFor && (status === 'good' || pct >= 10) && value > 0) {
      good.push({
        title: `Good source of ${ins.name.toLowerCase()}`,
        detail: pct ? `${Math.round(pct)}% of daily for this age` : 'Above the "look for" threshold',
      });
    }
  }

  // Ingredient-level red flags (from the product directly)
  const ing = (product?.ingredients_text || '').toLowerCase();
  const nf = product?.nutrition || {};
  if (nf.artificial_dyes) {
    bad.push({ title: 'Artificial dyes detected', detail: 'AAP 2018: linked to worsened ADHD symptoms in children.' });
  }
  if (nf.artificial_flavor) {
    bad.push({ title: 'Artificial flavors', detail: 'Look for "natural flavor" or whole-food alternatives.' });
  }
  if (/partially hydrogenated/.test(ing)) {
    bad.push({ title: 'Partially hydrogenated oil', detail: 'Source of trans fats. Avoid for children.' });
  }
  if (/high fructose corn syrup|hfcs/.test(ing)) {
    bad.push({ title: 'High-fructose corn syrup', detail: 'Concentrated added sugar — limit for kids.' });
  }
  if (/\borganic\b/.test(ing) && !good.some((g) => /organic/i.test(g.title))) {
    good.push({ title: 'Made with organic ingredients', detail: 'No synthetic pesticides or GMOs per USDA.' });
  }
  if (/\bwhole grain\b|\bwhole wheat\b|\bwhole oat/.test(ing) && !good.some((g) => /whole grain/i.test(g.title))) {
    good.push({ title: 'Whole grains', detail: 'Better fiber + steadier energy than refined grains.' });
  }
  if (/\bno added sugar\b|\bunsweetened\b/.test(ing) && !good.some((g) => /sugar/i.test(g.title))) {
    good.push({ title: 'No added sugar', detail: 'AAP-aligned for young children.' });
  }

  // Processing penalty
  const nova = product?.nova_group;
  if (nova === 4) {
    bad.push({ title: 'Ultra-processed (NOVA 4)', detail: 'Multiple industrial additives — best as occasional treat.' });
  } else if (nova === 1 || nova === 2) {
    good.push({ title: nova === 1 ? 'Minimally processed' : 'Lightly processed', detail: 'Closer to whole-food form.' });
  }

  // De-dupe by title
  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = (x.title || '').toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return { good: dedupe(good).slice(0, 5), bad: dedupe(bad).slice(0, 5) };
}

export default function ResultScreen() {
  const navigate = useStore((s) => s.navigate);
  const scan = useStore((s) => s.selectedProduct);
  const activeKid = useStore((s) => s.getActiveKid());
  const servingMode = useStore((s) => s.servingMode);
  const setServingMode = useStore((s) => s.setServingMode);

  if (!scan?.product) {
    return (
      <div className="screen animate-fade-in" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <p>No product selected.</p>
          <button className="btn-primary" onClick={() => navigate('home')} style={{ marginTop: 16, width: 'auto', padding: '12px 32px' }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { product, score } = scan;
  const lowConfidence = scan.low_confidence || (!score && scan.source === 'photo-ocr');
  const ocrNote = scan.ocr_note;
  const grade = score?.grade || 'C';
  const scoreNum = Math.round(score?.score ?? 0);
  const dims = score?.dimensions || {};
  const flags = score?.flags || [];
  const rawInsights = score?.nutrient_insights || [];

  // Top-4 priority: Protein → Iron → Sodium → Calcium, then everything else
  const PRIORITY_ORDER = ['protein', 'iron', 'sodium', 'calcium', 'sugar', 'fiber', 'zinc', 'fat'];
  const insights = (() => {
    const remaining = [...rawInsights];
    const picked = [];
    for (const key of PRIORITY_ORDER) {
      const idx = remaining.findIndex((ins) => (ins.name || '').toLowerCase().includes(key));
      if (idx >= 0) picked.push(...remaining.splice(idx, 1));
    }
    return [...picked, ...remaining];
  })();

  const { good: goodFlags, bad: badFlags } = deriveFlagColumns({
    flags,
    insights: rawInsights,
    product,
    score,
    ageBand: activeKid?.age_band,
  });
  const verdict = verdictBucket(flags, grade);
  const childName = activeKid?.name || 'your child';

  // Serving size handling — only show "(Xg)" when real, only allow Whole Package when servings/pkg known
  const servingG = Number(product?.nutrition?.serving_size_g || product?.serving_size_g || 0) || null;
  const packageG = Number(product?.package_size_g || 0) || null;
  const servingsPerPkg = (servingG && packageG) ? Math.max(1, Math.round(packageG / servingG)) : null;
  const canShowWholePackage = !!servingsPerPkg;
  const mult = (servingMode === 'package' && canShowWholePackage) ? servingsPerPkg : 1;

  const fmtInsight = (ins) => {
    const raw = parseFloat(ins.value);
    if (isNaN(raw) || raw === 0) return '—';
    const scaled = raw * mult;
    const rounded = scaled < 1 ? scaled.toFixed(2) : scaled.toFixed(scaled < 10 ? 1 : 0);
    return `${rounded}${ins.unit || ''}`;
  };

  // Decide if a nutrient card is "alert" (over limit) vs "good" (look-for hit)
  const cardClass = (ins) => {
    const status = (ins.status || '').toLowerCase();
    if (status === 'warn') return 'alert';
    if (status === 'caution') return '';
    if (status === 'good') return 'good';
    return '';
  };
  const cardTag = (ins) => {
    const status = (ins.status || '').toLowerCase();
    if (status === 'warn') return { text: 'High', cls: 'alert' };
    if (status === 'good') return { text: 'Good', cls: 'good' };
    return null;
  };
  const emojiFor = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('sodium')) return '🧂';
    if (n.includes('iron')) return '🦴';
    if (n.includes('protein')) return '💪';
    if (n.includes('calcium')) return '🥛';
    if (n.includes('sugar')) return '🍯';
    if (n.includes('fiber')) return '🌾';
    if (n.includes('zinc')) return '🛡️';
    if (n.includes('fat')) return '🧈';
    if (n.includes('calorie') || n.includes('energy')) return '🔥';
    return '📊';
  };

  return (
    <div className="screen animate-fade-in">
      {/* Sticky top bar with product identity */}
      <div className={`result-top-bar ${verdict.bucket}`}>
        <button className="result-back-btn" onClick={() => navigate('home')}>←</button>
        <div className="result-product-id">
          <div className="result-product-thumb">
            {product.image_url
              ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : '📦'}
          </div>
          <div className="result-product-text">
            <div className="result-product-brand">{product.brand || product.data_source || '—'}</div>
            <div className="result-product-name">{product.name || 'Unknown product'}</div>
          </div>
        </div>
      </div>

      {/* Verdict band */}
      {!lowConfidence && (
        <div className={`verdict-band ${verdict.bucket}`}>
          <div className="verdict-icon">{verdict.icon}</div>
          <div className="verdict-text">
            <div className="verdict-label">{verdict.label}</div>
            <div className="verdict-meta">Scored for {childName} · Grade {grade}</div>
          </div>
        </div>
      )}

      <div className="scrollable">
        {lowConfidence ? (
          <div className="partial-data-box">
            <div className="partial-emoji">📸</div>
            <div className="partial-title">Couldn't read the nutrition label</div>
            <div className="partial-note">
              {ocrNote || "I could see the package but couldn't see the white Nutrition Facts panel or full ingredients list. Please retake the photo of the BACK of the package."}
            </div>
            <button
              className="btn-primary"
              style={{ maxWidth: 260, margin: '0 auto' }}
              onClick={() => { useStore.getState().setScanMethod('photo'); useStore.getState().navigate('scanning'); }}
            >
              📷 Retake photo
            </button>
            <button
              className="btn-ghost"
              style={{ maxWidth: 260, margin: '8px auto 0' }}
              onClick={() => { useStore.getState().setScanMethod('barcode'); useStore.getState().navigate('scanning'); }}
            >
              Or scan barcode instead
            </button>
          </div>
        ) : (
          <>
            {/* Score ring + dimension bars in compact horizontal layout */}
            <div className="score-ring-row">
              <div className="score-ring-mini">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke={gradeColor(grade)}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(scoreNum / 100) * 264} 264`}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dasharray 1s ease' }}
                  />
                </svg>
                <div className="score-ring-center">
                  <div className="score-ring-num" style={{ color: gradeColor(grade) }}>{scoreNum}</div>
                  <div className="score-ring-grade" style={{ color: gradeColor(grade) }}>Grade {grade}</div>
                </div>
              </div>
              <div className="score-dim-bars">
                {[
                  { name: 'Nutrition',   val: dims.nutrition },
                  { name: 'Ingredients', val: dims.ingredients },
                  { name: 'Processing',  val: dims.processing },
                  { name: 'Age Safety',  val: dims.age_safety },
                ].map((d) => {
                  const v = d.val ?? 0;
                  const color = v >= 70 ? 'var(--sage)' : v >= 40 ? 'var(--butter)' : 'var(--coral)';
                  return (
                    <div key={d.name} className="dim-row">
                      <div className="dim-name">{d.name}</div>
                      <div className="dim-track">
                        <div className="dim-fill" style={{ width: `${v}%`, background: color }} />
                      </div>
                      <div className="dim-val">{Math.round(v)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Good / Watch out flag columns */}
            <div className="r-section-label">
              At a glance · for <strong>{childName}</strong>
            </div>
            <div className="flag-cols">
              <div className="flag-col green">
                <div className="flag-col-head"><span className="dot" /> Good stuff</div>
                <div className="flag-list">
                  {goodFlags.length > 0 ? (
                    goodFlags.slice(0, 4).map((f, i) => (
                      <div className="flag-item" key={i}>
                        <span className="flag-item-icon">✓</span>
                        <div className="flag-item-text">
                          <b>{f.title || 'Good'}</b>
                          {f.detail && <small>{f.detail}</small>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flag-empty">Nothing notable</div>
                  )}
                </div>
              </div>
              <div className="flag-col red">
                <div className="flag-col-head"><span className="dot" /> Watch out</div>
                <div className="flag-list">
                  {badFlags.length > 0 ? (
                    badFlags.slice(0, 4).map((f, i) => (
                      <div className="flag-item" key={i}>
                        <span className="flag-item-icon">⚠</span>
                        <div className="flag-item-text">
                          <b>{f.title || 'Flag'}</b>
                          {f.detail && <small>{f.detail}</small>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flag-empty">Nothing flagged 🎉</div>
                  )}
                </div>
              </div>
            </div>

            {/* Serving banner + toggle */}
            <div className="r-section-label">Nutrition notes</div>
            {servingG && (
              <div className="serving-context-banner">
                Serving: {servingG}g{servingsPerPkg ? ` · ${servingsPerPkg} per package` : ''}
              </div>
            )}
            {canShowWholePackage && (
              <div className="serving-toggle-row">
                <div className="serving-toggle">
                  <button
                    className={servingMode === 'serving' ? 'active' : ''}
                    onClick={() => setServingMode('serving')}
                  >
                    Per serving
                  </button>
                  <button
                    className={servingMode === 'package' ? 'active' : ''}
                    onClick={() => setServingMode('package')}
                  >
                    Whole package
                  </button>
                </div>
                <div className="serving-info">× {servingsPerPkg} servings</div>
              </div>
            )}

            {/* Insight grid 2×2 */}
            {insights.length > 0 ? (
              <div className="insight-grid">
                {insights.slice(0, 4).map((ins, i) => {
                  const tag = cardTag(ins);
                  return (
                    <div key={i} className={`insight-card ${cardClass(ins)}`}>
                      <div className="insight-row-top">
                        <div className="insight-emoji">{emojiFor(ins.name)}</div>
                        {tag && <div className={`insight-mini-tag ${tag.cls}`}>{tag.text}</div>}
                      </div>
                      <div className="insight-label">{ins.name}</div>
                      <div className="insight-value">{fmtInsight(ins)}</div>
                      {ins.pct_of_daily ? (
                        <div className="insight-context">{Math.round(ins.pct_of_daily * mult)}% of daily</div>
                      ) : ins.status === 'good' ? (
                        <div className="insight-context">Looks good</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ingredients-box" style={{ color: 'var(--ink-muted)' }}>
                No detailed nutrition data available.
              </div>
            )}

            {/* Ingredients */}
            {product.ingredients_text && (
              <>
                <div className="r-section-label">Ingredients</div>
                <div className="ingredients-box">{product.ingredients_text}</div>
              </>
            )}

            {/* Sources */}
            <div className="source-row">
              📚 <span><strong>Sources:</strong> AAP Pediatric Nutrition Handbook · USDA FoodData Central · Open Food Facts · WHO sodium guidance</span>
            </div>

            <div style={{ height: 90 }} />
          </>
        )}
      </div>

      <BotFab variant="result" />
    </div>
  );
}
