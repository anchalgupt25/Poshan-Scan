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

const screens = {
  splash: SplashScreen,
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
};

export default function App() {
  const authChecked = useStore((s) => s.authChecked);
  const authToken = useStore((s) => s.authToken);
  const currentScreen = useStore((s) => s.currentScreen);
  const bootstrapAuth = useStore((s) => s.bootstrapAuth);
  const loadKidsFromServer = useStore((s) => s.loadKidsFromServer);

  // On mount: validate stored token (if any) against /auth/me
  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  // When auth becomes valid, load kids from the server
  useEffect(() => {
    if (authToken) loadKidsFromServer();
  }, [authToken, loadKidsFromServer]);

  // While we're verifying a stored token, show a minimal splash to avoid
  // the auth screen flashing on every page refresh
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

  // Not signed in → auth screen only
  if (!authToken) {
    return (
      <div className="app-shell">
        <AuthScreen />
      </div>
    );
  }

  // Signed in → normal screen routing
  const Screen = screens[currentScreen] || SplashScreen;
  return (
    <div className="app-shell">
      <Screen />
    </div>
  );
}
