import React from 'react';
import useStore from '../../store/useStore';

/**
 * "Ask Nouri" sticky bottom bar (renamed from FAB to match prototype).
 *
 * `variant`:
 *   - 'home'   → "Anything about food & your kiddo" subtitle
 *   - 'result' → "Why is this flagged? What can I give instead?"
 */
export default function BotFab({ variant = 'home' }) {
  const navigate = useStore((s) => s.navigate);

  const subtitle =
    variant === 'result'
      ? 'Why is this flagged? What can I give instead?'
      : 'Anything about food & your kiddo';

  return (
    <div className="ask-bar">
      <div
        className="ask-bar-inner"
        onClick={() => navigate('bot')}
        role="button"
        aria-label="Ask Nouri"
      >
        <div className="ask-bar-avatar">💬</div>
        <div className="ask-bar-text">
          <div className="ask-bar-title">Ask Nouri</div>
          <div className="ask-bar-sub">{subtitle}</div>
        </div>
        <div className="ask-bar-arrow">→</div>
      </div>
    </div>
  );
}
