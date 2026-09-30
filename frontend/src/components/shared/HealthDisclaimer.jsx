import React, { useEffect, useState } from 'react';
import { storage } from '../../utils/platform';
import './healthDisclaimer.css';

const ACK_KEY = 'nouri:health-ack-v1';

/**
 * One-time acknowledgement that NouriScan gives guidance, not medical advice.
 *
 * Two reasons this exists:
 *
 *  1. App Store review. Guidelines 1.4.1 and 5.1.1(ix) get applied to apps
 *     that could be read as giving medical direction — and an app that scores
 *     infant food safety absolutely reads that way. Stating the boundary up
 *     front, and never phrasing a score as a medical verdict, is what keeps
 *     this on the right side of that line.
 *
 *  2. It's true. The score is computed from public AAP and RDA guidance
 *     against a parent-entered profile. It doesn't know the child's medical
 *     history, and it shouldn't pretend to.
 *
 * Shown once per install, then never again. The key is versioned so the text
 * can be re-acknowledged if it materially changes.
 */
export default function HealthDisclaimer() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ack = await storage.get(ACK_KEY);
      if (!cancelled && !ack) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const accept = async () => {
    await storage.set(ACK_KEY, new Date().toISOString());
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="hd-backdrop" role="dialog" aria-modal="true" aria-labelledby="hd-title">
      <div className="hd-sheet">
        <div className="hd-mark">🔬</div>

        <h2 id="hd-title" className="hd-title">
          Before you start
        </h2>

        <p className="hd-lede">
          NouriScan helps you read a label faster. It doesn't replace your pediatrician.
        </p>

        <ul className="hd-points">
          <li>
            <strong>Scores are guidance, not a diagnosis.</strong> They come from public
            nutrition guidance — AAP daily intake and RDA references — applied to the age
            and allergens you enter.
          </li>
          <li>
            <strong>We don't know your child's history.</strong> Medical conditions,
            medications, and your doctor's specific instructions all override anything
            you see here.
          </li>
          <li>
            <strong>Label data can be wrong or out of date.</strong> Always read the
            actual package for allergens before feeding your child, especially if the
            allergy is severe.
          </li>
          <li>
            <strong>In an emergency, call your doctor or emergency services.</strong>{' '}
            Don't use this app to make urgent decisions.
          </li>
        </ul>

        <label className="hd-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            I understand NouriScan provides nutrition information for educational
            purposes and is not medical advice.
          </span>
        </label>

        <button className="btn-primary hd-accept" onClick={accept} disabled={!checked}>
          Got it — let's go
        </button>
      </div>
    </div>
  );
}
