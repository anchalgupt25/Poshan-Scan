import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

const ages = [
  { id: '6-12mo', label: '0–6 mo' },
  { id: '6-12mo', label: '6–12 mo' },
  { id: '1-2y',   label: '12–18 mo' },
  { id: '1-2y',   label: '18–24 mo' },
  { id: '2-4y',   label: '2–3 yrs' },
  { id: '4-6y',   label: '3–5 yrs' },
];

const genders = [
  { id: 'boy',  emoji: '👦', label: 'Boy' },
  { id: 'girl', emoji: '👧', label: 'Girl' },
];

export default function Onboard2() {
  const navigate = useStore((s) => s.navigate);
  const form = useStore((s) => s.onboardForm);
  const updateForm = useStore((s) => s.updateOnboardForm);

  return (
    <div className="screen onboard-screen animate-fade-in">
      <StatusBar />
      <div className="onboard-header">
        <div className="onboard-progress">
          <span className="done" /><span className="active" /><span /><span />
        </div>
        <p className="onboard-step-label">Step 2 of 4 · About your little one</p>
        <div className="onboard-title">
          Tell us a bit about your <em>tiny human</em>.
        </div>
        <div className="onboard-subtitle">
          This stays on your device. We never sell your child's data. Period.
        </div>
      </div>
      <div className="onboard-body">
        <div className="onboard-section">
          <label className="onboard-label">Their first name (or nickname)</label>
          <input
            className="text-input"
            type="text"
            placeholder="e.g. Krish, Amy, Rhea…"
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
          />
        </div>
        <div className="onboard-section">
          <label className="onboard-label">Gender</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {genders.map((g) => (
              <div
                key={g.id}
                className={`age-card ${form.gender === g.id ? 'selected' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: 12 }}
                onClick={() => updateForm({ gender: g.id })}
              >
                <div className="emoji">{g.emoji}</div>
                <div className="label">{g.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="onboard-section">
          <label className="onboard-label">How old are they?</label>
          <div className="age-grid">
            {ages.map((a, i) => (
              <div
                key={i}
                className={`age-pill ${form.age === a.id && form.ageLabel === a.label ? 'selected' : ''}`}
                onClick={() => updateForm({ age: a.id, ageLabel: a.label })}
              >
                {a.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="onboard-bottom">
        <button
          className="btn-primary"
          onClick={() => navigate('onboard3')}
          disabled={!form.name || !form.age || !form.gender}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
