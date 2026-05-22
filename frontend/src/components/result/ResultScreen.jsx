import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import BotFab from '../shared/BotFab';
import './result.css';

function gradeColor(grade) {
  if (grade === 'A') return 'var(--sage)';
  if (grade === 'B') return 'var(--butter)';
  if (grade === 'C') return 'var(--coral)';
  return '#C0392B';
}
function gradeBg(grade) {
  if (grade === 'A') return 'rgba(127,163,114,0.12)';
  if (grade === 'B') return 'rgba(244,216,154,0.25)';
  if (grade === 'C') return 'rgba(232,112,74,0.10)';
  return 'rgba(192,57,43,0.10)';
}

// Map backend severity → UI badge class
function badgeFromFlags(flags = []) {
  const red = flags.find((f) => (f.severity || '').toLowerCase() === 'red');
  if (red) return { cls: 'flag', text: red.title || 'Concern flagged' };
  const orange = flags.find((f) => (f.severity || '').toLowerCase() === 'orange');
  if (orange) return { cls: 'warn', text: orange.title || 'Caution' };
  return { cls: 'safe', text: 'All Clear' };
}

// Map flag severity to check-card type
function checkType(sev) {
  const s = (sev || '').toLowerCase();
  if (s === 'red') return 'fail';
  if (s === 'orange') return 'warn';
  return 'pass';
}
function checkIcon(sev) {
  const s = (sev || '').toLowerCase();
  if (s === 'red') return '🔴';
  if (s === 'orange') return '🟡';
  return '✅';
}

export default function ResultScreen() {
  const navigate = useStore((s) => s.navigate);
  const scan = useStore((s) => s.selectedProduct);
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
  const grade = score?.grade || 'C';
  const scoreNum = Math.round(score?.score ?? 0);
  const gradeLabel = score?.grade_label || '';
  const dims = score?.dimensions || {};
  const flags = score?.flags || [];
  const insights = score?.nutrient_insights || [];
  const badge = badgeFromFlags(flags);

  const servingG = product?.nutrition?.serving_size_g || product?.serving_size_g || 30;
  const servingsPerPkg = Math.max(1, Math.round((product?.package_size_g || servingG * 5) / servingG));
  const mult = servingMode === 'package' ? servingsPerPkg : 1;

  // Format the value with serving multiplier
  const fmtInsight = (ins) => {
    const raw = parseFloat(ins.value);
    if (!isNaN(raw)) {
      const scaled = raw * mult;
      const rounded = scaled < 1 ? scaled.toFixed(2) : scaled.toFixed(scaled < 10 ? 1 : 0);
      return `${rounded}${ins.unit || ''}`;
    }
    return `${ins.value}${ins.unit || ''}`;
  };

  return (
    <div className="screen animate-fade-in">
      <StatusBar />
      <div className="nav-header">
        <button className="nav-back" onClick={() => navigate('home')}>←</button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Scan Result</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="scrollable" style={{ padding: '0 24px 32px' }}>
        {/* Score header */}
        <div className="result-header" style={{ background: gradeBg(grade) }}>
          <div className="result-product-row">
            <div className="result-thumb">{product.image_url ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '📦'}</div>
            <div className="result-product-info">
              <div className="result-brand">{product.brand || product.data_source || '—'}</div>
              <div className="result-name">{product.name || 'Unknown product'}</div>
            </div>
          </div>
          <div className={`badge ${badge.cls}`}>{badge.text}</div>

          <div className="result-score-ring">
            <svg viewBox="0 0 120 120" className="score-svg">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke={gradeColor(grade)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(scoreNum / 100) * 327} 327`}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div className="score-center">
              <div className="score-number" style={{ color: gradeColor(grade) }}>{scoreNum}</div>
              <div className="score-grade-letter" style={{ color: gradeColor(grade) }}>Grade {grade}</div>
            </div>
          </div>
          <div className="score-label">{gradeLabel}</div>

          <div className="dim-bars">
            {[
              { name: 'Nutrition',  val: dims.nutrition },
              { name: 'Ingredients', val: dims.ingredients },
              { name: 'Processing', val: dims.processing },
              { name: 'Age Safety', val: dims.age_safety },
            ].map((d) => {
              const v = d.val ?? 0;
              return (
                <div key={d.name} className="dim-bar-row">
                  <div className="dim-bar-name">{d.name}</div>
                  <div className="dim-bar-track">
                    <div
                      className="dim-bar-fill"
                      style={{
                        width: `${v}%`,
                        background: v >= 70 ? 'var(--sage)' : v >= 40 ? 'var(--butter)' : 'var(--coral)',
                        animation: `progressFill 1s ease both`,
                      }}
                    />
                  </div>
                  <div className="dim-bar-val">{Math.round(v)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verdict text */}
        {score?.verdict_text && (
          <div className="verdict-box" style={{ marginBottom: 16 }}>
            {score.verdict_text}
          </div>
        )}

        {/* Serving toggle */}
        <div className="serving-toggle">
          <button
            className={`serving-btn ${servingMode === 'serving' ? 'active' : ''}`}
            onClick={() => setServingMode('serving')}
          >
            Per Serving ({servingG}g)
          </button>
          <button
            className={`serving-btn ${servingMode === 'package' ? 'active' : ''}`}
            onClick={() => setServingMode('package')}
          >
            Whole Package
          </button>
        </div>

        {/* Nutrition insights — 2x2 */}
        <div className="section-label" style={{ marginTop: 20 }}>
          NUTRITION {servingMode === 'package' ? '(WHOLE PACKAGE)' : '(PER SERVING)'}
        </div>
        {insights.length > 0 ? (
          <>
            <div className="insight-grid">
              {insights.slice(0, 4).map((ins, i) => (
                <div key={i} className="insight-card">
                  <div className="insight-emoji-lg">{emojiForNutrient(ins.name)}</div>
                  <div className="insight-label">{ins.name}</div>
                  <div className="insight-value-lg">{fmtInsight(ins)}</div>
                  <div className="insight-context-sm">
                    {ins.pct_of_daily ? `${Math.round(ins.pct_of_daily * mult)}% of daily limit` : statusLabel(ins.status)}
                  </div>
                </div>
              ))}
            </div>
            {insights[4] && (
              <div className="insight-card" style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="insight-emoji-lg">{emojiForNutrient(insights[4].name)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="insight-label">{insights[4].name}</div>
                    <div className="insight-value-lg" style={{ marginTop: 2 }}>{fmtInsight(insights[4])}</div>
                    <div className="insight-context-sm">
                      {insights[4].pct_of_daily ? `${Math.round(insights[4].pct_of_daily * mult)}% of daily` : statusLabel(insights[4].status)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="ingredients-box" style={{ color: 'var(--ink-muted)' }}>
            No detailed nutrition data available for this product.
          </div>
        )}

        {/* Safety checks — 2x2 */}
        {flags.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>SAFETY CHECKS</div>
            <div className="check-grid">
              {flags.slice(0, 4).map((f, i) => (
                <div key={i} className={`check-card ${checkType(f.severity)}`}>
                  <div className={`check-icon ${checkType(f.severity)}`}>{checkIcon(f.severity)}</div>
                  <div className="check-name">{f.title}</div>
                  <div className="check-detail">{f.detail}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Ingredients */}
        {product.ingredients_text && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>INGREDIENTS</div>
            <div className="ingredients-box">{product.ingredients_text}</div>
          </>
        )}
      </div>

      <BotFab />
    </div>
  );
}

function emojiForNutrient(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('sodium') || n.includes('salt')) return '🧂';
  if (n.includes('sugar')) return '🍬';
  if (n.includes('iron')) return '🦴';
  if (n.includes('calcium')) return '🥛';
  if (n.includes('protein')) return '💪';
  if (n.includes('fiber') || n.includes('fibre')) return '🌾';
  if (n.includes('fat')) return '🧈';
  if (n.includes('calorie') || n.includes('energy')) return '🔥';
  if (n.includes('zinc')) return '🛡️';
  return '📊';
}
function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'good') return 'Good for your child';
  if (s === 'caution') return 'Watch intake';
  if (s === 'warn') return 'Above recommended limit';
  return '';
}
