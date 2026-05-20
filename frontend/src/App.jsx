import React, { useEffect } from 'react';
import useStore from './store/useStore';
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
  const currentScreen = useStore((s) => s.currentScreen);
  const loadKidsFromServer = useStore((s) => s.loadKidsFromServer);

  useEffect(() => {
    loadKidsFromServer();
  }, [loadKidsFromServer]);

  const Screen = screens[currentScreen] || SplashScreen;

  return (
    <div className="app-shell">
      <Screen />
    </div>
  );
}
