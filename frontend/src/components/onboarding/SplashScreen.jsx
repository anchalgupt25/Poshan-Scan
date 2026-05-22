import React from 'react';
import useStore from '../../store/useStore';
import './onboarding.css';

export default function SplashScreen() {
  const navigate = useStore((s) => s.navigate);
  return (
    <div className="screen splash-screen">
      <div className="splash-content" style={{ animation: 'splashRise 0.9s cubic-bezier(0.2, 0.9, 0.3, 1)' }}>
        <div className="splash-logo">🔬</div>
        <div className="splash-brand">Nouri<em>Scan</em></div>
        <div className="splash-tagline">Know what's really in every food pack your child eats</div>
        <div className="splash-pills">
          <div className="splash-pill"><span className="pill-dot" />Age-safe scoring</div>
          <div className="splash-pill"><span className="pill-dot" />Indian parent lens</div>
          <div className="splash-pill"><span className="pill-dot" />Brain & bone focus</div>
          <div className="splash-pill"><span className="pill-dot" />3-sec verdict</div>
        </div>
      </div>
      <div className="splash-bottom">
        <button className="btn-primary" onClick={() => navigate('onboard1')}>
          🔬 Set Up My Child's Profile
        </button>
        <button className="btn-ghost" onClick={() => navigate('onboard1')} style={{ marginTop: 10 }}>
          I already have an account
        </button>
      </div>
    </div>
  );
}
