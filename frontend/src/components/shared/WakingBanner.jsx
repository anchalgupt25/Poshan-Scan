import React, { useEffect, useState } from 'react';
import { onSlowRequest } from '../../utils/api';
import './wakingBanner.css';

/**
 * "The server is waking up" notice.
 *
 * The API sleeps after ~15 minutes idle on Render's free tier, so the first
 * request after a quiet spell can take 30-50 seconds. Without this the app
 * just sits there and people assume it's broken — the most common reason a
 * first-time user gives up before ever seeing a score.
 *
 * Appears only once a request has already been slow for a couple of seconds,
 * so normal fast requests never flash it. The message escalates as the wait
 * grows, because a static spinner stops being reassuring after ~15 seconds.
 */
export default function WakingBanner() {
  const [slow, setSlow] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => onSlowRequest(setSlow), []);

  useEffect(() => {
    if (!slow) { setElapsed(0); return; }
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [slow]);

  if (!slow) return null;

  // Tell the truth about what's happening, and keep it concrete.
  let message = 'Connecting…';
  if (elapsed >= 25) {
    message = 'Still waking up — almost there';
  } else if (elapsed >= 8) {
    message = 'Waking up the server — this takes up to a minute after a quiet spell';
  } else if (elapsed >= 3) {
    message = 'Waking up the server…';
  }

  return (
    <div className="waking-banner" role="status" aria-live="polite">
      <span className="waking-spinner" aria-hidden />
      <span className="waking-text">{message}</span>
      {elapsed >= 8 && <span className="waking-elapsed">{elapsed}s</span>}
    </div>
  );
}
