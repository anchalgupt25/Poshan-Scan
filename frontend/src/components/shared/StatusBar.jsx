import React from 'react';

/**
 * StatusBar — previously rendered a fake iOS-style status bar (9:41 + signal
 * icons) for the desktop "phone mockup" preview. In practice this caused
 * confusion on real devices where the OS already provides the actual chrome,
 * so it's now reduced to a thin safe-area spacer that pushes content below
 * the notch on iOS without showing anything fake.
 */
export default function StatusBar() {
  return (
    <div
      style={{ height: 'env(safe-area-inset-top, 12px)', flexShrink: 0 }}
      aria-hidden
    />
  );
}
