import React, { useEffect, useRef, useState } from 'react';
import useStore from '../../store/useStore';
import { requestOtp, verifyOtp } from '../../utils/api';
import './auth.css';

export default function AuthScreen() {
  const setAuth = useStore((s) => s.setAuth);
  const navigate = useStore((s) => s.navigate);
  const authIntent = useStore((s) => s.authIntent);
  const loadKidsFromServer = useStore((s) => s.loadKidsFromServer);

  const isSignin = authIntent === 'signin';

  const [stage, setStage] = useState('email');   // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo]   = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  // Surface the invite-code field on the signin path if the backend tells us
  // it doesn't recognise this email (most often because the ephemeral SQLite
  // on Render's free tier got wiped on the last redeploy).
  const [forceInviteCode, setForceInviteCode] = useState(false);
  const otpRefs = useRef([]);
  const showInviteField = !isSignin || forceInviteCode;

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleRequestOtp = async () => {
    setError(''); setInfo('');
    if (!email.includes('@')) { setError('Please enter a valid email.'); return; }
    if (showInviteField && !inviteCode.trim()) {
      setError('Invite code is required.'); return;
    }
    setBusy(true);
    try {
      const r = await requestOtp(email, inviteCode);
      setStage('otp');
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(30);
      setInfo(
        r.delivery === 'console'
          ? '⚠️ Dev mode — your code was printed to the backend console (set RESEND_API_KEY for real email).'
          : `Code sent to ${email}. It expires in ${r.expires_in_minutes || 10} minutes.`
      );
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e) {
      const msg = e.message || 'Could not send code. Try again.';
      // Backend tells us the email isn't registered yet → reveal the invite-
      // code field inline instead of forcing them back to the splash screen.
      if (isSignin && /invite code required/i.test(msg)) {
        setForceInviteCode(true);
        setError(
          "We don't have an account for this email yet. Enter your invite code below — once you set up your first child profile, we'll remember you next time."
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (codeStr) => {
    const finalCode = codeStr || otp.join('');
    if (finalCode.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const r = await verifyOtp(email, finalCode);
      setAuth({ token: r.token, email: r.email });

      // Decide where to land based on what kids exist on the server.
      const kidCount = await loadKidsFromServer({ navigateOnLoad: false });

      if (kidCount > 1) {
        // Multiple kids — make them pick
        navigate('kidSelector');
      } else if (kidCount === 1) {
        // Exactly one kid — straight to home
        navigate('home');
      } else if (isSignin) {
        // "I already have an account" but no kids on the server — gently
        // hand them off to onboarding to set up their first child.
        setError("We couldn't find any child profiles for this email. Let's set one up.");
        setTimeout(() => navigate('onboard1'), 1500);
        return; // keep busy true briefly so the message is readable
      } else {
        // Signup flow — go through onboarding
        navigate('onboard1');
      }
    } catch (e) {
      setError(e.message || 'That code is wrong.');
      setBusy(false);
    }
  };

  const handleOtpChange = (idx, val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 1);
    const next = [...otp];
    next[idx] = cleaned;
    setOtp(next);
    setError('');
    if (cleaned && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (next.every((d) => d !== '')) handleVerifyOtp(next.join(''));
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const next = pasted.split('');
      setOtp(next);
      otpRefs.current[5]?.focus();
      handleVerifyOtp(pasted);
    }
  };

  return (
    <div className="screen auth-screen animate-fade-in">
      <div className="scrollable" style={{ padding: 0 }}>
        <button
          className="nav-back"
          onClick={() => navigate('splash')}
          style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}
          aria-label="Back to splash"
        >
          ←
        </button>

        <div className="auth-brand">
          <div className="auth-logo">🔬</div>
          <div className="auth-brand-name">Nouri<em>Scan</em></div>
          <div className="auth-brand-tag">Know what's really in every food pack</div>
        </div>

        {stage === 'email' ? (
          <div className="auth-card">
            <div className="auth-title">
              {isSignin ? 'Welcome back to ' : 'Sign in to '}
              <em>Nouri</em>
            </div>
            <div className="auth-subtitle">
              {isSignin
                ? "Enter the email you signed up with. We'll send a 6-digit code — no password needed."
                : "Enter your email and your invite code. We'll send a 6-digit code to sign you in — no password needed."}
            </div>

            <div className="auth-field">
              <label className="auth-field-label">Email</label>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                className="text-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (showInviteField) document.getElementById('invite-input')?.focus();
                    else handleRequestOtp();
                  }
                }}
              />
            </div>

            {showInviteField && (
              <div className="auth-field">
                <label className="auth-field-label">Invite code</label>
                <input
                  id="invite-input"
                  type="text"
                  autoCapitalize="characters"
                  className="text-input"
                  placeholder="e.g. NOURI-FAMILY"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
                />
              </div>
            )}

            {error && <div className="auth-error">⚠️ {error}</div>}

            <button
              className="btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleRequestOtp}
              disabled={busy || !email || (showInviteField && !inviteCode)}
            >
              {busy ? 'Sending code…' : 'Send my code'}
            </button>

            <div className="auth-meta">
              {isSignin ? (
                <>
                  New to Nouri Scan?{' '}
                  <button
                    onClick={() => {
                      useStore.getState().setAuthIntent('signup');
                      navigate('splash');
                    }}
                  >
                    Set up a profile
                  </button>
                </>
              ) : (
                <>
                  No invite code? Ask whoever shared Nouri Scan with you, or email{' '}
                  <a href="mailto:hello@nouriscan.app">hello@nouriscan.app</a>.
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="auth-card">
            <div className="auth-title">Check your <em>email</em></div>
            <div className="auth-subtitle">
              We sent a 6-digit code to <strong style={{ color: 'var(--ink)' }}>{email}</strong>. It expires in 10 minutes.
            </div>

            <div className="otp-row" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  className={`otp-digit ${digit ? 'filled' : ''}`}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  disabled={busy}
                />
              ))}
            </div>

            {error && <div className="auth-error">⚠️ {error}</div>}
            {!error && info && <div className="auth-success">📧 {info}</div>}

            <button
              className="btn-primary"
              style={{ marginTop: 18 }}
              onClick={() => handleVerifyOtp()}
              disabled={busy || otp.some((d) => !d)}
            >
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>

            <div className="auth-meta">
              Didn't get it?{' '}
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button onClick={handleRequestOtp} disabled={busy}>Resend code</button>
              )}
              {' · '}
              <button onClick={() => { setStage('email'); setError(''); setInfo(''); setForceInviteCode(false); }}>
                Change email
              </button>
            </div>
          </div>
        )}

        <div className="auth-disclaimer">
          By signing in you agree to use Nouri Scan as educational guidance only. All scores are informational — always consult your pediatrician for medical advice.
        </div>
      </div>
    </div>
  );
}
