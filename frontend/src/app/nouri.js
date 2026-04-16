/**
 * Nouri — AI nutritionist chatbot module.
 *
 * Two contexts:
 *   result  → opens from result screen (flag banner or tab pill)
 *   home    → opens from home screen (history-aware summary)
 *
 * Backend `/nouri/chat` is called for every user message.
 * The backend builds a rich prompt from child profile + scan data + history,
 * then hits the Element LLM Gateway (or falls back to a rule-based engine).
 *
 * Disclaimer: informational only — not medical advice.
 */

import { nouriChat } from '../api/client.js';
import { getCurrentChild } from './profile.js';

// ─── State ──────────────────────────────────────────────────────────────────

let _resultScanData = null;     // last scan result passed to initNouriResult()
let _homeHistory    = [];       // recent scan entries for home-drawer summary
let _resultHistory  = [];       // flat conversation so far (result ctx)
let _homeConvHistory = [];      // flat conversation so far (home ctx)
let _backdrop       = null;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Called by result.js after every renderResult().
 * Decides whether to auto-show the flag banner.
 */
export function initNouriResult(scanData) {
  _resultScanData  = scanData;
  _resultHistory   = [];

  // Sync drawer subtitle to product name
  const sub = document.getElementById('nouri-result-sub');
  if (sub && scanData.product) {
    const child = getCurrentChild();
    sub.textContent = [
      scanData.product.name,
      child ? `${child.name} · ${child.age_band}` : '',
    ].filter(Boolean).join(' · ');
  }

  // Auto-show flag banner only when red flags present
  const banner = document.getElementById('nouri-flag-banner');
  if (!banner) return;

  const redFlags = (scanData.score?.flags || []).filter((f) => f.severity === 'red');
  if (redFlags.length > 0) {
    banner.style.display = 'flex';
    const msg = document.getElementById('nfb-msg');
    if (msg) {
      const child = getCurrentChild();
      const name  = child ? child.name : 'your child';
      const label = redFlags.length === 1
        ? `1 red flag — ${redFlags[0].title}`
        : `${redFlags.length} red flags including ${redFlags[0].title}`;
      msg.textContent = `Tap to ask about ${label} for ${name}.`;
    }
    const lbl = document.getElementById('nfb-label');
    if (lbl) lbl.textContent = `Nouri noticed ${redFlags.length} red flag${redFlags.length > 1 ? 's' : ''}`;
  } else {
    banner.style.display = 'none';
  }
}

/**
 * Called by app.js when navigating to the home screen.
 * Generates a history-aware Nouri prompt in the home button.
 */
export function initNouriHome() {
  _homeConvHistory = [];

  try {
    _homeHistory = JSON.parse(localStorage.getItem('nouriHistory') || '[]');
  } catch { _homeHistory = []; }

  const btn = document.getElementById('nouri-home-btn');
  if (!btn) return;

  const child = getCurrentChild();
  const name  = child ? child.name : 'your child';

  if (!_homeHistory.length) {
    btn.style.display = 'none'; // no history yet — nothing useful to surface
    return;
  }

  btn.style.display = 'flex';
  const textEl = btn.querySelector('.nhb-text');
  if (!textEl) return;

  const week = _homeHistory.filter((x) => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return x.time >= cutoff;
  });

  const withScores = week.filter((x) => x.score != null);
  const avg = withScores.length
    ? Math.round(withScores.reduce((s, x) => s + x.score, 0) / withScores.length)
    : null;

  // Find most-flagged concern across the week
  const flagCounts = {};
  week.forEach((x) => { if (x.topFlag) flagCounts[x.topFlag] = (flagCounts[x.topFlag] || 0) + 1; });
  const topFlag   = Object.entries(flagCounts).sort((a, b) => b[1] - a[1])[0];
  const flagText  = topFlag ? ` · ${topFlag[0]} flagged ${topFlag[1]}×` : '';

  textEl.innerHTML = avg != null
    ? `<strong>Ask Nouri</strong> · ${name}'s scans avg ${avg}/100 this week${flagText}`
    : `<strong>Ask Nouri</strong> · Ask anything about ${name}'s nutrition`;

  // Update drawer header subtitle too
  const drawerSub = document.getElementById('nouri-home-sub');
  if (drawerSub) drawerSub.textContent = `Based on ${name}'s last ${_homeHistory.length} scans`;
}

/** Open the result-screen Nouri drawer. trigger: 'flag' | 'tab' */
export function openNouriResult(trigger = 'tab') {
  const drawer = document.getElementById('nouri-result-drawer');
  if (!drawer || drawer.classList.contains('open')) return;

  const msgs  = document.getElementById('nouri-result-msgs');
  const chips = document.getElementById('nouri-result-suggestions');
  msgs.innerHTML  = '';
  chips.innerHTML = '';

  _showBackdrop(() => closeNouriDrawer('nouri-result-drawer'));
  drawer.classList.add('open');

  // Opening greeting — bot speaks first
  _nouriGreetResult(trigger, msgs, chips);
}

/** Open the home-screen Nouri drawer. */
export function openNouriHome() {
  const drawer = document.getElementById('nouri-home-drawer');
  if (!drawer || drawer.classList.contains('open')) return;

  const msgs  = document.getElementById('nouri-home-msgs');
  const chips = document.getElementById('nouri-home-suggestions');
  msgs.innerHTML  = '';
  chips.innerHTML = '';

  _showBackdrop(() => closeNouriDrawer('nouri-home-drawer'));
  drawer.classList.add('open');

  _nouriGreetHome(msgs, chips);
}

/** Close any named drawer. */
export function closeNouriDrawer(id) {
  const drawer = document.getElementById(id);
  if (drawer) drawer.classList.remove('open');
  _hideBackdrop();
}

/** Send a user message in the result-screen context. */
export async function sendNouriResult() {
  const input = document.getElementById('nouri-result-input');
  const text  = input?.value.trim();
  if (!text) return;
  input.value = '';

  const msgs  = document.getElementById('nouri-result-msgs');
  const chips = document.getElementById('nouri-result-suggestions');
  chips.innerHTML = '';

  _addUserMsg(msgs, text);
  _resultHistory.push({ role: 'user', content: text });

  const typing = _addTyping(msgs);
  _scrollMsgs(msgs);

  try {
    const reply = await _callNouri({
      context:      'result',
      message:      text,
      scan_data:    _resultScanData,
      history:      _resultHistory.slice(-8),
    });
    typing.remove();
    _addNouriMsg(msgs, reply);
    _resultHistory.push({ role: 'nouri', content: reply });
  } catch {
    typing.remove();
    _addNouriMsg(msgs, 'Having trouble reaching the server. Please check your connection and try again.');
  }
  _scrollMsgs(msgs);
}

/** Send a user message in the home context. */
export async function sendNouriHome() {
  const input = document.getElementById('nouri-home-input');
  const text  = input?.value.trim();
  if (!text) return;
  input.value = '';

  const msgs  = document.getElementById('nouri-home-msgs');
  const chips = document.getElementById('nouri-home-suggestions');
  chips.innerHTML = '';

  _addUserMsg(msgs, text);
  _homeConvHistory.push({ role: 'user', content: text });

  const typing = _addTyping(msgs);
  _scrollMsgs(msgs);

  try {
    const reply = await _callNouri({
      context: 'home',
      message: text,
      history: _homeConvHistory.slice(-8),
    });
    typing.remove();
    _addNouriMsg(msgs, reply);
    _homeConvHistory.push({ role: 'nouri', content: reply });
  } catch {
    typing.remove();
    _addNouriMsg(msgs, 'Having trouble reaching the server. Please check your connection and try again.');
  }
  _scrollMsgs(msgs);
}

// ─── Greeting generators ─────────────────────────────────────────────────────

async function _nouriGreetResult(trigger, msgs, chips) {
  const typing = _addTyping(msgs);
  _scrollMsgs(msgs);

  try {
    const greeting = await _callNouri({
      context:   'result',
      message:   `__greet:${trigger}`,  // sentinel: ask bot to open with a greeting
      scan_data: _resultScanData,
      history:   [],
    });
    typing.remove();
    _addNouriMsg(msgs, greeting.text ?? greeting);
    _renderChips(chips, greeting.chips ?? [], 'result');
    _resultHistory.push({ role: 'nouri', content: greeting.text ?? greeting });
  } catch {
    typing.remove();
    const child = getCurrentChild();
    const name  = child ? child.name : 'your child';
    _addNouriMsg(msgs, `I've looked at this score for ${name}. What would you like to know?`);
    _renderChips(chips, [
      'What are the main concerns?',
      'How does the score work?',
      'Is this safe for their age?',
    ], 'result');
  }
}

async function _nouriGreetHome(msgs, chips) {
  const typing = _addTyping(msgs);
  _scrollMsgs(msgs);

  try {
    const greeting = await _callNouri({
      context: 'home',
      message: '__greet',
      history: [],
    });
    typing.remove();
    _addNouriMsg(msgs, greeting.text ?? greeting);
    _renderChips(chips, greeting.chips ?? [], 'home');
    _homeConvHistory.push({ role: 'nouri', content: greeting.text ?? greeting });
  } catch {
    typing.remove();
    const child = getCurrentChild();
    const name  = child ? child.name : 'your child';
    _addNouriMsg(msgs, `What would you like to know about ${name}'s nutrition?`);
    _renderChips(chips, [
      'What patterns do you see?',
      'Which products should I swap?',
      'How is overall nutrition looking?',
    ], 'home');
  }
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function _callNouri(payload) {
  const child = getCurrentChild();
  return nouriChat({
    ...payload,
    child_id: child?.id ?? null,
    scan_history: _homeHistory.slice(0, 15),
  });
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function _addNouriMsg(container, html) {
  const d = document.createElement('div');
  d.className = 'msg-nouri';
  d.innerHTML = `<div class="msg-nouri-av">🌿</div><div class="msg-nouri-bubble">${html}</div>`;
  container.appendChild(d);
}

function _addUserMsg(container, text) {
  const d = document.createElement('div');
  d.className = 'msg-user';
  d.innerHTML = `<div class="msg-user-bubble">${_escape(text)}</div>`;
  container.appendChild(d);
}

function _addTyping(container) {
  const d = document.createElement('div');
  d.className = 'nouri-typing';
  d.innerHTML = `
    <div class="nouri-typing-av">🌿</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  container.appendChild(d);
  _scrollMsgs(container);
  return d;
}

function _renderChips(container, labels, ctx) {
  container.innerHTML = '';
  labels.forEach((label) => {
    const chip = document.createElement('div');
    chip.className = 'nouri-suggestion-chip';
    chip.textContent = label;
    chip.onclick = () => _onChipClick(chip, label, ctx);
    container.appendChild(chip);
  });
}

async function _onChipClick(chip, text, ctx) {
  chip.style.opacity = '0.4';
  chip.style.pointerEvents = 'none';

  const msgsId  = ctx === 'result' ? 'nouri-result-msgs' : 'nouri-home-msgs';
  const chipsId = ctx === 'result' ? 'nouri-result-suggestions' : 'nouri-home-suggestions';
  const msgs    = document.getElementById(msgsId);
  const chips   = document.getElementById(chipsId);

  chips.innerHTML = '';
  _addUserMsg(msgs, text);

  if (ctx === 'result') {
    _resultHistory.push({ role: 'user', content: text });
  } else {
    _homeConvHistory.push({ role: 'user', content: text });
  }

  const typing = _addTyping(msgs);
  _scrollMsgs(msgs);

  try {
    const reply = await _callNouri({
      context:   ctx,
      message:   text,
      scan_data: ctx === 'result' ? _resultScanData : null,
      history:   (ctx === 'result' ? _resultHistory : _homeConvHistory).slice(-8),
    });
    typing.remove();
    const replyText = reply.text ?? reply;
    _addNouriMsg(msgs, replyText);
    if (ctx === 'result') _resultHistory.push({ role: 'nouri', content: replyText });
    else _homeConvHistory.push({ role: 'nouri', content: replyText });
  } catch {
    typing.remove();
    _addNouriMsg(msgs, 'Unable to reach Nouri right now. Please try again.');
  }
  _scrollMsgs(msgs);
}

function _scrollMsgs(el) {
  setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
}

function _escape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Backdrop ────────────────────────────────────────────────────────────────

function _showBackdrop(onTap) {
  if (!_backdrop) {
    _backdrop = document.createElement('div');
    _backdrop.className = 'nouri-backdrop';
    document.body.appendChild(_backdrop);
  }
  _backdrop.onclick = () => { onTap(); _hideBackdrop(); };
  // Force reflow then show
  void _backdrop.offsetWidth;
  _backdrop.classList.add('visible');
}

function _hideBackdrop() {
  if (_backdrop) _backdrop.classList.remove('visible');
}
