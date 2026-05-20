import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

const ages = [
  { id: '6-12mo', emoji: '🍼', label: '6–12 months', hint: 'Intro foods' },
  { id: '1-2y',   emoji: '🧸', label: '1–2 years',   hint: 'Toddler nutrition' },
  { id: '2-4y',   emoji: '🚲', label: '2–4 years',   hint: 'Active growing' },
  { id: '4-6y',   emoji: '🎨', label: '4–6 years',   hint: 'School-age diet' },
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
        <div className="step-dots">
          <div className="step-dot done" /><div className="step-dot active" />
          <div className="step-dot" /><div className="step-dot" />
        </div>
        <p className="onboard-step-label">Step 2 of 4 · Tell us about your child</p>
        <div className="onboard-question">Who are we <em>scanning food</em> for?</div>
        <div className="onboard-sub">Age unlocks our scoring — what's safe at 6 months isn't at 3 years.</div>
      </div>
      <div className="onboard-body">
        <div className="onboard-section">
          <label className="onboard-label">Child's name</label>
          <input
            className="text-input"
            type="text"
            placeholder="e.g. Arya"
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
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => updateForm({ gender: g.id })}
              >
                <div className="emoji">{g.emoji}</div>
                <div className="label">{g.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="onboard-section">
          <label className="onboard-label">Age range</label>
          <div className="age-grid">
            {ages.map((a) => (
              <div
                key={a.id}
                className={`age-card ${form.age === a.id ? 'selected' : ''}`}
                onClick={() => updateForm({ age: a.id })}
              >
                <div className="emoji">{a.emoji}</div>
                <div className="label">{a.label}</div>
                <div className="hint">{a.hint}</div>
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
          Continue →
        </button>
      </div>
    </div>
  );
}
