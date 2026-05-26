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
        <div className="onboard-progress">
          <span className="done" /><span className="done" /><span className="active" /><span />
        </div>
        <p className="onboard-step-label">Step 3 of 4 · Allergens to watch for</p>
        <div className="onboard-title">
          Anything we should <em>flag with care</em>?
        </div>
        <div className="onboard-subtitle">
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
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 14, marginBottom: 18, fontStyle: 'italic' }}>
          No allergies right now? Just continue — you can add them anytime.
        </p>
        <label className="onboard-label">Other allergens or ingredients to flag</label>
        <input
          type="text"
          className="text-input"
          placeholder="cashew, pistachio, kiwi…"
          value={form.allergiesOther || ''}
          onChange={(e) => updateForm({ allergiesOther: e.target.value })}
        />
      </div>
      <div className="onboard-bottom">
        <button className="btn-primary" onClick={() => navigate('onboard4')}>
          Continue
        </button>
      </div>
    </div>
  );
}
