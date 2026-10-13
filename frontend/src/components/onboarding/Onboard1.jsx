import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

const watchItems = [
  {
    emoji: '🍯',
    name: 'Added sugar',
    tag: 'Watch out',
    tagClass: 'alert',
    detail: 'AAP says zero added sugar under 2. We flag anything sneaky.',
  },
  {
    emoji: '🧂',
    name: 'Sodium',
    tag: 'Watch out',
    tagClass: 'alert',
    detail: 'Most snacks blow past the daily limit in one serving.',
  },
  {
    emoji: '🦴',
    name: 'Iron',
    tag: 'Look for',
    tagClass: 'good',
    detail: 'Critical for brain development — often missed in toddler diets.',
  },
  {
    emoji: '⚗️',
    name: 'Heavy metals',
    tag: 'Watch out',
    tagClass: 'alert',
    detail: 'Lead, cadmium, arsenic in baby/toddler foods. We use HBBF testing data.',
  },
];

export default function Onboard1() {
  const navigate = useStore((s) => s.navigate);

  return (
    <div className="screen onboard-screen animate-fade-in">
      <StatusBar />
      <div className="onboard-header">
        <div className="onboard-progress">
          <span className="active" /><span /><span /><span />
        </div>
        <p className="onboard-step-label">Step 1 of 4 · How Nouri works</p>
        <div className="onboard-title">
          Here's what Nouri <em>watches for</em> in every snack.
        </div>
        <div className="onboard-subtitle">
          Backed by AAP and FDA guidance — these four are the difference-makers for little ones. We surface them in plain English so you don't have to decode labels.
        </div>
      </div>
      <div className="onboard-body">
        <div className="watch-grid">
          {watchItems.map((w) => (
            <div className="watch-card" key={w.name}>
              <div className={`watch-tag ${w.tagClass}`}>{w.tag}</div>
              <div className="watch-emoji">{w.emoji}</div>
              <div className="watch-name">{w.name}</div>
              <div className="watch-detail">{w.detail}</div>
            </div>
          ))}
        </div>
        <p className="watch-footnote">
          Plus your child's allergies and your family's eating style — you'll set those next.
        </p>
      </div>
      <div className="onboard-bottom">
        <button className="btn-primary" onClick={() => navigate('onboard2')}>
          Continue
        </button>
      </div>
    </div>
  );
}
