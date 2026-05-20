import React from 'react';
import useStore from '../../store/useStore';

export default function BotFab() {
  const navigate = useStore((s) => s.navigate);
  return (
    <button
      className="fab-bot"
      onClick={() => navigate('bot')}
      aria-label="Ask Nouri"
      title="Ask Nouri"
    >
      🤖
    </button>
  );
}
