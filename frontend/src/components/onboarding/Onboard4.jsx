import React, { useState } from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

const diets = [
  { id: 'vegetarian',     label: 'Vegetarian' },
  { id: 'vegan',          label: 'Strict vegan' },
  { id: 'jain',           label: 'Jain' },
  { id: 'halal',          label: 'Halal' },
  { id: 'kosher',         label: 'Kosher' },
  { id: 'no-pork',        label: 'No pork' },
  { id: 'no-honey',       label: 'No honey' },
  { id: 'no-added-sugar', label: 'Low added sugar' },
];

export default function Onboard4() {
  const navigate = useStore((s) => s.navigate);
  const form = useStore((s) => s.onboardForm);
  const updateForm = useStore((s) => s.updateOnboardForm);
  const addKid = useStore((s) => s.addKidFromForm);
  const resetForm = useStore((s) => s.resetOnboardForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleDiet = (id) => {
    const cur = form.diets || [];
    updateForm({ diets: cur.includes(id) ? cur.filter((d) => d !== id) : [...cur, id] });
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      await addKid(form);
      resetForm();
      navigate('home');
    } catch (err) {
      setError(err.message || 'Could not save profile. Is the backend running?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen onboard-screen animate-fade-in">
      <StatusBar />
      <div className="onboard-header">
        <div className="onboard-progress">
          <span className="done" /><span className="done" /><span className="done" /><span className="active" />
        </div>
        <p className="onboard-step-label">Step 4 of 4 · Your family's plate</p>
        <div className="onboard-title">
          How does your <em>family</em> eat?
        </div>
        <div className="onboard-subtitle">
          Pick any that apply. We'll spot ingredients that don't fit — including the sneaky ones like rennet, gelatin, and carmine.
        </div>
      </div>
      <div className="onboard-body">
        <div className="dietary-info-banner">
          ✨ Most apps stop at "vegetarian." We go further — including Jain, halal, kosher, and strict-vegan rules that most labels don't surface.
        </div>
        <div className="chip-row">
          {diets.map((d) => (
            <div
              key={d.id}
              className={`chip chip-restriction ${(form.diets || []).includes(d.id) ? 'selected' : ''}`}
              onClick={() => toggleDiet(d.id)}
            >
              {d.label}
            </div>
          ))}
        </div>
        <label className="onboard-label" style={{ marginTop: 22 }}>
          Anything else you'd like Nouri to keep an eye on?
        </label>
        <input
          type="text"
          className="text-input"
          placeholder="e.g. iron-rich snacks, low sodium…"
          value={form.dietNotes || ''}
          onChange={(e) => updateForm({ dietNotes: e.target.value })}
        />
        {error && (
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(232,112,74,0.1)', border: '1px solid rgba(232,112,74,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--coral)' }}>
            ⚠️ {error}
          </div>
        )}
      </div>
      <div className="onboard-bottom">
        <button className="btn-primary" onClick={handleFinish} disabled={saving}>
          {saving ? 'Saving…' : 'All set'}
        </button>
      </div>
    </div>
  );
}
