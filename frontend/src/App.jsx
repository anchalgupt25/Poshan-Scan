import React, { useEffect } from 'react';
import useStore from './store/useStore';
import AuthScreen from './components/auth/AuthScreen';
import SplashScreen from './components/onboarding/SplashScreen';
import Onboard1 from './components/onboarding/Onboard1';
import Onboard2 from './components/onboarding/Onboard2';
import Onboard3 from './components/onboarding/Onboard3';
import Onboard4 from './components/onboarding/Onboard4';
import HomeScreen from './components/home/HomeScreen';
import ScanningScreen from './components/scanning/ScanningScreen';
import ResultScreen from './components/result/ResultScreen';
import BotScreen from './components/bot/BotScreen';
import ProfileScreen from './components/profile/ProfileScreen';
import KidSelector from './components/profile/KidSelector';
import AdminScreen from './components/admin/AdminScreen';

const screens = {
  splash: SplashScreen,
  auth: AuthScreen,
  onboard1: Onboard1,
  onboard2: Onboard2,
  onboard3: Onboard3,
  onboard4: Onboard4,
  home: HomeScreen,
  scanning: ScanningScreen,
  result: ResultScreen,
  bot: BotScreen,
  profile: ProfileScreen,
  kidSelector: KidSelector,
  admin: AdminScreen,
};

// Screens that don't require a signed-in user.
const PUBLIC_SCREENS = new Set(['splash', 'auth']);

export default function App() {
  const authChecked = useStore((s) => s.authChecked);
  const authToken = useStore((s) => s.authToken);
  const currentScreen = useStore((s) => s.currentScreen);
  const navigate = useStore((s) => s.navigate);
  const bootstrapAuth = useStore((s) => s.bootstrapAuth);
  const loadKidsFromServer = useStore((s) => s.loadKidsFromServer);

  // On mount: validate stored token (if any). If valid, fetch kids so the
  // returning user lands straight on home (or kid selector for multi-kid).
  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    if (authToken) {
      loadKidsFromServer({ navigateOnLoad: true });
    }
  }, [authToken, loadKidsFromServer]);

  // While verifying a stored token, render a minimal splash to avoid a flicker
  if (!authChecked) {
    return (
      <div className="app-shell">
        <div className="screen splash-screen">
          <div className="splash-content">
            <div className="splash-logo" style={{ animation: 'logoFloat 4s ease-in-out infinite' }}>🔬</div>
            <div className="splash-brand">Nouri<em>Scan</em></div>
          </div>
        </div>
      </div>
    );
  }

  // Guard: if the user somehow lands on a protected screen without auth,
  // bounce them back to splash. (Defensive — UI flows should not produce this.)
  if (!authToken && !PUBLIC_SCREENS.has(currentScreen)) {
    navigate('splash');
  }

  const Screen = screens[currentScreen] || SplashScreen;
  return (
    <div className="app-shell">
      <Screen />
    </div>
  );
}
