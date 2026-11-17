import { useState } from 'react';
import { ROUND_ENABLED } from './roundEnabled';
import { loadFacilitySettings } from './facilityStorage';
import { useFacilityRounds } from './useFacilityRounds';
import SettingsScreen from './SettingsScreen';
import HomeScreen from './HomeScreen';
import RoundStartScreen from './RoundStartScreen';

type Screen = 'home' | 'settings' | 'start';

/**
 * Facility page. Without the preview flag (production) it is the settings screen only,
 * and the round screens and the IndexedDB code drop out of that build (see roundEnabled.ts).
 */
export default function FacilityApp() {
  return ROUND_ENABLED ? <RoundApp /> : <SettingsScreen />;
}

/** Screen switch of the preview: home, settings and round start. */
function RoundApp() {
  const [screen, setScreen] = useState<Screen>('home');
  // Read again whenever home is shown, since the settings screen may have replaced them.
  const [settings, setSettings] = useState(loadFacilitySettings);
  const { status, rounds, error, start, remove, clearError } = useFacilityRounds();

  const goHome = () => {
    setSettings(loadFacilitySettings());
    clearError();
    setScreen('home');
  };
  const goTo = (next: Screen) => {
    clearError();
    setScreen(next);
  };

  if (screen === 'settings') return <SettingsScreen onBack={goHome} />;
  if (screen === 'start' && settings) {
    return (
      <RoundStartScreen
        settings={settings}
        now={new Date()}
        error={error}
        onBack={goHome}
        onStart={async (input) => {
          const result = await start({ ...input, settings });
          if (result === 'started') setScreen('home');
          return result;
        }}
      />
    );
  }
  return (
    <HomeScreen
      settings={settings}
      status={status}
      rounds={rounds}
      error={error}
      onStart={() => goTo('start')}
      onOpenSettings={() => goTo('settings')}
      onDelete={remove}
    />
  );
}
