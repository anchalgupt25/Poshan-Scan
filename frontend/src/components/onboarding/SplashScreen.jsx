import React from 'react';
import useStore from '../../store/useStore';
import './onboarding.css';

export default function SplashScreen() {
  const navigate = useStore((s) => s.navigate);
  const setAuthIntent = useStore((s) => s.setAuthIntent);

  const handleSignup = () => {
    setAuthIntent('signup');
    navigate('auth');
  };
  const handleSignin = () => {
    setAuthIntent('signin');
    navigate('auth');
  };

  return (
    <div className="screen splash-screen">
      <div className="splash-content">
        {/* Stylized N badge — butter→terracotta gradient circle with sprout glyph */}
        <div className="splash-logo-mark" aria-hidden>
          <svg viewBox="0 0 110 110" width="110" height="110">
            <defs>
              <linearGradient id="splashLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--butter)" />
                <stop offset="100%" stopColor="var(--terracotta)" />
              </linearGradient>
            </defs>
            <circle cx="55" cy="55" r="50" fill="url(#splashLogoGrad)" />
            <circle cx="55" cy="55" r="46" fill="none" stroke="var(--rust)" strokeWidth="2" opacity="0.15" />
            <path d="M 35 78 L 35 36 Q 35 32 39 32 L 43 32 L 70 64 L 70 36 Q 70 32 74 32 L 75 32 Q 79 32 79 36 L 79 78 Q 79 82 75 82 L 70 82 L 43 50 L 43 78 Q 43 82 39 82 L 35 82 Z" fill="var(--rust)" opacity="0.85"/>
            <circle cx="44" cy="28" r="3" fill="var(--sage)" />
            <circle cx="71" cy="86" r="2" fill="var(--sage)" />
          </svg>
        </div>

        <div className="splash-brand">N<em>ouri</em></div>
        <div className="splash-tagline">
          A gentler way to know what's in your little one's snack.
        </div>

        <button className="splash-cta" onClick={handleSignup}>
          Get started
        </button>
        <button className="splash-secondary" onClick={handleSignin}>
          I already have an account
        </button>
      </div>

      <div className="splash-footer">scan · understand · decide</div>
    </div>
  );
}
