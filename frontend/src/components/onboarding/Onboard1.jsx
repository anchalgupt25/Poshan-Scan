import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

const nutrients = [
  { emoji: '🧂', name: 'Sodium', desc: 'Hidden salt in packaged food' },
  { emoji: '🍬', name: 'Added Sugar', desc: 'Not the fruit kind — the sneaky kind' },
  { emoji: '🦴', name: 'Iron & Calcium', desc: 'Brain + bone builders' },
  { emoji: '⚗️', name: 'Processing Level', desc: 'NOVA 1–4 classification' },
];

export default function Onboard1() {
  const navigate = useStore((s) => s.navigate);
  return (
    <div className="screen onboard-screen animate-fade-in">
      <StatusBar />
      <div className="onboard-header">
        <div className="step-dots">
          <div className="step-dot active" /><div className="step-dot" />
          <div className="step-dot" /><div className="step-dot" />
        </div>
        <p className="onboard-step-label">Step 1 of 4 · What we look for</p>
        <div className="onboard-question">Four things <em>most labels</em> hide</div>
        <div className="onboard-sub">The science behind every score. Tap any to learn more.</div>
      </div>
      <div className="onboard-body">
        <div className="nutrient-grid">
          {nutrients.map((n) => (
            <div className="nutrient-card" key={n.name}>
              <div className="n-emoji">{n.emoji}</div>
              <div className="n-name">{n.name}</div>
              <div className="n-desc">{n.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="onboard-bottom">
        <button className="btn-primary" onClick={() => navigate('onboard2')}>
          Got it — let's set up →
        </button>
      </div>
    </div>
  );
}
