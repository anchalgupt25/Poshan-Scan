import React, { useEffect, useState } from 'react';
import useStore from '../../store/useStore';
import { accountSummary, deleteAccount } from '../../utils/api';
import { hapticNotify } from '../../utils/platform';
import './deleteAccount.css';

/**
 * In-app account deletion.
 *
 * App Store Review Guideline 5.1.1(v) requires that any app supporting account
 * creation also lets the user delete that account from inside the app — not via
 * a support email, and not by a link out to a website. Missing this is a hard
 * rejection.
 *
 * The flow is deliberately two-step with a typed confirmation: deletion is
 * immediate and irreversible, so it should be hard to trigger by accident, but
 * it must not be hidden or obstructed either.
 */
export default function DeleteAccount({ onCancel }) {
  const logout = useStore((s) => s.logout);
  const authEmail = useStore((s) => s.authEmail);

  const [summary, setSummary] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    accountSummary()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { /* Non-fatal — deletion works without the counts. */ });
    return () => { cancelled = true; };
  }, []);

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE' && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      hapticNotify('success');
      setDone(true);
      // Give the confirmation a beat to register, then drop to the splash
      // screen with all local state cleared.
      setTimeout(() => logout(), 1800);
    } catch (err) {
      setBusy(false);
      hapticNotify('error');
      setError(err?.message || 'Could not delete the account. Please try again.');
    }
  };

  if (done) {
    return (
      <div className="da-done">
        <div className="da-done-icon">✓</div>
        <h2 className="da-done-title">Account deleted</h2>
        <p className="da-done-body">
          Your account, child profiles, and scan history have been permanently removed.
        </p>
      </div>
    );
  }

  return (
    <div className="da-wrap">
      <div className="da-warn">
        <div className="da-warn-title">This can't be undone</div>
        <div className="da-warn-body">
          Deleting your account permanently removes everything below. There's no grace
          period and no way to recover it afterwards.
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>WHAT GETS DELETED</div>
      <ul className="da-list">
        <li>
          <span className="da-list-label">Account</span>
          <span className="da-list-value">{authEmail || '—'}</span>
        </li>
        <li>
          <span className="da-list-label">Child profiles</span>
          <span className="da-list-value">
            {summary ? summary.children : '…'}
            {summary?.children === 1 ? ' profile' : ' profiles'}
          </span>
        </li>
        <li>
          <span className="da-list-label">Scan history</span>
          <span className="da-list-value">
            {summary ? summary.scans : '…'}
            {summary?.scans === 1 ? ' scan' : ' scans'}
          </span>
        </li>
      </ul>

      <p className="da-note">
        Your email is removed from our records entirely, so you'd need a new invite code
        to sign up again.
      </p>

      <div className="section-label" style={{ marginTop: 22 }}>TYPE DELETE TO CONFIRM</div>
      <input
        className="text-input da-input"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Type DELETE to confirm account deletion"
      />

      {error && <div className="da-error">{error}</div>}

      <button
        className="da-delete-btn"
        onClick={handleDelete}
        disabled={!canDelete}
      >
        {busy ? 'Deleting…' : 'Permanently delete my account'}
      </button>

      <button className="btn-ghost" style={{ marginTop: 10 }} onClick={onCancel} disabled={busy}>
        Keep my account
      </button>
    </div>
  );
}
