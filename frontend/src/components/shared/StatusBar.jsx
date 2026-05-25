import React, { useEffect, useState } from 'react';

/**
 * Fake iOS-style status bar (9:41 + signal icons) for the desktop "phone mockup"
 * preview. On a real mobile device the OS already provides this, so we'd be
 * duplicating it — hide ourselves there.
 *
 * Heuristic: show only when the viewport is wider than a phone OR when there's
 * no touch input (i.e. desktop browser previewing the mockup).
 */
export default function StatusBar() {
  const [showFake, setShowFake] = useState(false);

  useEffect(() => {
    const decide = () => {
      const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      const wide = window.innerWidth > 480;
      // Desktop preview: wide viewport AND no touch → show the mockup
      setShowFake(wide && !isTouch);
    };
    decide();
    window.addEventListener('resize', decide);
    return () => window.removeEventListener('resize', decide);
  }, []);

  if (!showFake) {
    // On real mobile: render a tiny spacer so screens don't bump up against
    // the OS status bar / notch. iOS Safari covers ~44px on phones with a notch.
    return <div style={{ height: 'env(safe-area-inset-top, 8px)' }} aria-hidden />;
  }

  return (
    <div className="status-bar">
      <span>9:41</span>
      <div className="icons">
        <span style={{ fontSize: 12 }}>●●●●</span>
        <span style={{ fontSize: 12 }}>📶</span>
        <span style={{ fontSize: 12 }}>🔋</span>
      </div>
    </div>
  );
}
