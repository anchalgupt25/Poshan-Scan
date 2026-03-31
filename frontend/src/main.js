/**
 * Poshan Scan — entry point.
 * Boots the UI, loads the child profile, and registers all global handlers.
 */
import './styles/app.css';
import {
  goScreen, ob, goHome, skipToApp,
  selOne, selAge, tog, togGoal,
  handleSaveProfile, startScan,
  renderHomeHistory, runSearch,
  logDecision, showError,
} from './app/app.js';
import { loadProfile, applyProfileToUi } from './app/profile.js';

// Expose functions needed by inline onclick handlers in HTML
Object.assign(window, {
  goScreen, ob, goHome, skipToApp,
  selOne, selAge, tog, togGoal,
  saveProfile: handleSaveProfile,
  startScan, runSearch, logDecision, showError,
});

async function boot() {
  const profile = await loadProfile();

  if (profile) {
    applyProfileToUi(profile);
    renderHomeHistory();
    goScreen('home');
  } else {
    goScreen('ob1');
  }
}

document.addEventListener('DOMContentLoaded', boot);
