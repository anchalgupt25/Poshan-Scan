/**
 * Profile collection from onboarding DOM + save/load via backend API.
 */
import { createChild, listChildren, updateChild } from '../api/client.js';

// In-memory current child profile
let _currentChild = null;

export function getCurrentChild() { return _currentChild; }
export function setCurrentChild(c) { _currentChild = c; }

/** Collect profile from onboarding DOM inputs. */
export function collectProfileFromDom() {
  const nameEl = document.getElementById('child-name');
  const name = nameEl ? nameEl.value.trim() : 'Child';

  const ob2 = document.getElementById('ob2');
  const ageEl = ob2 && ob2.querySelector('.age-grid .age-card.on .ac-r');
  const age_band = ageEl ? ageEl.textContent.trim() : '1\u20132 years';

  const genderRow = ob2 && ob2.querySelectorAll('.ob-section')[1];
  const genderCard = genderRow && genderRow.querySelector('.age-card.on');
  const gender = genderCard ? genderCard.querySelector('.ac-r').textContent.trim() : 'Girl';
  const genderEmoji = genderCard ? genderCard.querySelector('.ac-e').textContent.trim() : '\ud83d\udc67';

  const ob3 = document.getElementById('ob3');
  const dietEl = ob3 && ob3.querySelectorAll('.ob-section')[0].querySelector('.chip.on');
  const diet_type = dietEl
    ? dietEl.textContent.trim().replace(/^[\s\S]{1,3}\s/, '').trim()
    : 'Pure Veg';

  const allergySec = ob3 && ob3.querySelectorAll('.ob-section')[1];
  const allergies = allergySec
    ? Array.from(allergySec.querySelectorAll('.chip.on')).map((c) =>
        c.textContent.trim().replace(/^[\s\S]{1,3}\s/, '').trim()
      )
    : [];

  const cuisineEl = ob3 && ob3.querySelectorAll('.ob-section')[2].querySelector('.chip.on');
  const cuisine = cuisineEl
    ? cuisineEl.textContent.trim().replace(/^[\s\S]{1,3}\s/, '').trim()
    : 'North Indian';

  const ob4 = document.getElementById('ob4');
  const goals = ob4
    ? Array.from(ob4.querySelectorAll('.goal-card.on')).map((g) =>
        g.querySelector('.goal-name').textContent.trim()
      )
    : [];

  return { name, age_band, gender, genderEmoji, diet_type, allergies, cuisine, goals };
}

/** Save profile: create via API or update if existing. */
export async function saveProfile() {
  const data = collectProfileFromDom();
  const { genderEmoji, ...apiData } = data;

  try {
    let child;
    if (_currentChild && _currentChild.id) {
      child = await updateChild(_currentChild.id, apiData);
    } else {
      child = await createChild(apiData);
    }
    child.genderEmoji = genderEmoji;
    _currentChild = child;
    persistLocal(child);
    return child;
  } catch (err) {
    // Fallback to local-only if backend unreachable
    console.warn('[Profile] Backend unavailable, saving locally:', err);
    const localProfile = { ...data, id: null };
    _currentChild = localProfile;
    persistLocal(localProfile);
    return localProfile;
  }
}

/** Load profile from backend (or localStorage fallback). */
export async function loadProfile() {
  try {
    const children = await listChildren();
    if (children && children.length > 0) {
      const child = children[0];
      child.genderEmoji = child.gender === 'Boy' ? '\ud83d\udc66' : '\ud83d\udc67';
      _currentChild = child;
      persistLocal(child);
      return child;
    }
  } catch (err) {
    console.warn('[Profile] Backend unavailable, using local cache');
  }
  return loadLocal();
}

function persistLocal(profile) {
  localStorage.setItem('poshanProfile', JSON.stringify(profile));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem('poshanProfile');
    if (raw) {
      _currentChild = JSON.parse(raw);
      return _currentChild;
    }
  } catch { /* ignore */ }
  return null;
}

export function goalShortLabel(full) {
  if (full.includes('Brain')) return '\ud83e\udde0 Brain Dev';
  if (full.includes('Bone')) return '\ud83e\uddb4 Bone';
  if (full.includes('Immunity')) return '\ud83d\udee1\ufe0f Immunity';
  if (full.includes('Heart')) return '\u2764\ufe0f Heart';
  if (full.includes('Physical')) return '\ud83d\udcaa Growth';
  return full.split(' ')[0] || full;
}

/** Apply profile data to all UI elements across screens. */
export function applyProfileToUi(profile) {
  if (!profile) return;
  const name = profile.name || 'Child';
  const emoji = profile.genderEmoji || '\ud83d\udc67';
  const age = profile.age_band || profile.ageBand || '';
  const goals = profile.goals || [];
  const allergies = profile.allergies || [];
  const diet = profile.diet_type || profile.dietType || '';
  const cuisine = profile.cuisine || '';

  // Topbar
  const av = document.getElementById('home-avatar');
  if (av) av.textContent = emoji;
  document.querySelectorAll('.badge-name, #home-child-name').forEach((el) => { el.textContent = name; });
  const ageEl = document.getElementById('home-child-age');
  if (ageEl) ageEl.textContent = `${age} \u00b7 ${goals.slice(0, 2).map(goalShortLabel).join(' + ')}`;

  // Nav
  const navAv = document.getElementById('nav-avatar');
  if (navAv) navAv.textContent = emoji;
  ['nav-child-name', 'hist-nav-name', 'result-nav-name', 'profile-nav-name'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });

  // Home sub
  const sub = document.getElementById('home-scan-sub');
  if (sub) sub.textContent = `Is it safe for ${name}? Built for parents who read every label.`;

  // Onboarding step 4 summary
  const t = document.getElementById('ob5-ready-title');
  if (t) t.textContent = `${name}'s profile is ready`;
  const b = document.getElementById('ob5-ready-blurb');
  if (b) b.textContent = `Every scan is now scored through ${name}'s lens \u2014 age, goals, diet.`;
  const e = document.getElementById('ob5-emoji');
  if (e) e.textContent = emoji;
  const l1 = document.getElementById('ob5-line1');
  if (l1) l1.textContent = `${name} \u00b7 ${profile.gender || 'Child'} \u00b7 ${age}`;
  const l2 = document.getElementById('ob5-line2');
  if (l2) l2.textContent = `${diet} \u00b7 ${cuisine}`;
  const tags = document.getElementById('ob5-tags');
  if (tags) {
    let html = goals.slice(0, 3).map((g) =>
      `<div style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;background:rgba(45,106,79,0.1);color:var(--forest);border:1px solid rgba(45,106,79,0.2);">${goalShortLabel(g)}</div>`
    ).join('');
    html += allergies.map((a) =>
      `<div style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;background:var(--sand2);color:var(--slate-mid);border:1px solid var(--border);">\u26a0\ufe0f ${a}</div>`
    ).join('');
    tags.innerHTML = html;
  }

  // Profile screen
  const pn = document.getElementById('profile-name');
  if (pn) pn.textContent = name;
  const pa = document.getElementById('profile-age');
  if (pa) pa.textContent = `${profile.gender || ''} \u00b7 ${age} \u00b7 Updates automatically`;
  const pav = document.getElementById('profile-avatar');
  if (pav) pav.textContent = emoji;
  const chips = document.getElementById('profile-chips');
  if (chips) {
    chips.innerHTML = [
      diet && `<div class="ph-chip">${diet}</div>`,
      cuisine && `<div class="ph-chip">${cuisine}</div>`,
      ...goals.map((g) => `<div class="ph-chip goal">${goalShortLabel(g)}</div>`),
      ...allergies.map((a) => `<div class="ph-chip">\u26a0\ufe0f ${a}</div>`),
    ].filter(Boolean).join('');
  }
  const lensCard = document.getElementById('profile-lens-card');
  if (lensCard) {
    lensCard.innerHTML = [
      `<div style="font-size:11px;font-weight:700;color:var(--slate-mid);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">Score lens active for ${name}</div>`,
      `<div>\u2713 Sodium: ${age === '6\u201312 months' ? '370mg/day (WHO)' : age === '1\u20132 years' ? '800mg/day (WHO)' : '1000mg+/day'}</div>`,
      goals.includes('Brain Development') ? '<div>\u2713 Iron &amp; Zinc weighted higher (brain dev)</div>' : '',
      allergies.length ? `<div>\u2715 ${allergies.join(', ')} auto-flagged</div>` : '',
    ].filter(Boolean).join('');
  }

  // History screen names
  const hn = document.getElementById('history-child-name');
  if (hn) hn.textContent = name;
}
