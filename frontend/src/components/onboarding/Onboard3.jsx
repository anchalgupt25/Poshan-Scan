import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

const allergens = [
  { id: 'peanut',    emoji: '🥜', label: 'Peanut' },
  { id: 'treenut',   emoji: '🌰', label: 'Tree nuts' },
  { id: 'sesame',    emoji: '🌱', label: 'Sesame' },
  { id: 'dairy',     emoji: '🥛', label: 'Dairy' },
  { id: 'egg',       emoji: '🥚', label: 'Egg' },
  { id: 'soy',       emoji: '🫘', label: 'Soy' },
  { id: 'wheat',     emoji: '🌾', label: 'Wheat / gluten' },
  { id: 'shellfish', emoji: '🦐', label: 'Shellfish' },
  { id: 'fish',      emoji: '🐟', label: 'Fish' },
];

export default function Onboard3() {
  const navigate = useStore((s) => s.navigate);
  const form = useStore((s) => s.onboardForm);
  const updateForm = useStore((s) => s.updateOnboardForm);

  const toggle = (id) => {
    const cur = form.allergies || [];
    updateForm({ allergies: cur.includes(id) ? cur.filter((a) => a !== id) : [...cur, id] });
  };

  return (
    <div className="screen onboard-screen animate-fade-in">
      <StatusBar />
      <div className="onboard-header">
        <div className="step-dots">
          <div className="step-dot done" /><div className="step-dot done" />
          <div className="step-dot active" /><div className="step-dot" />
        </div>
        <p className="onboard-step-label">Step 3 of 4 · Allergens to watch for</p>
        <div className="onboard-question">Anything we should <em>flag with care</em>?</div>
        <div className="onboard-sub">
          Tap any allergens we should always alert on. Includes hidden names and "may contain" warnings.
        </div>
      </div>
      <div className="onboard-body">
        <div className="chip-row">
          {allergens.map((a) => (
            <div
              key={a.id}
              className={`chip ${(form.allergies || []).includes(a.id) ? 'selected' : ''}`}
              onClick={() => toggle(a.id)}
            >
              {a.emoji} {a.label}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 14, marginBottom: 18 }}>
          No allergies right now? Just continue — you can add them anytime.
        </div>
        <label className="onboard-label">Other allergies</label>
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 8 }}>
          Optional — anything else we should flag for your child
        </p>
        <input
          type="text"
          className="text-input"
          placeholder="e.g. coconut, mustard, lupin…"
          value={form.allergiesOther || ''}
          onChange={(e) => updateForm({ allergiesOther: e.target.value })}
        />
      </div>
      <div className="onboard-bottom">
        <button className="btn-primary" onClick={() => navigate('onboard4')}>
          Continue →
        </button>
      </div>
    </div>
  );
}
