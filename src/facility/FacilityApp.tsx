import { useState } from 'react';
import { ROUND_ENABLED } from './roundEnabled';
import { loadFacilitySettings } from './facilityStorage';
import { useFacilityRounds } from './useFacilityRounds';
import SettingsScreen from './SettingsScreen';
import HomeScreen from './HomeScreen';
import RoundStartScreen from './RoundStartScreen';
import RoundInputScreen from './RoundInputScreen';

type Screen = 'home' | 'settings' | 'start' | 'round';

/**
 * Facility page. Without the preview flag (production) it is the settings screen only,
 * and the round screens and the IndexedDB code drop out of that build (see roundEnabled.ts).
 */
export default function FacilityApp() {
  return ROUND_ENABLED ? <RoundApp /> : <SettingsScreen />;
}

/** Screen switch of the preview: home, settings, round start and round input. */
function RoundApp() {
  const [screen, setScreen] = useState<Screen>('home');
  // Read again whenever home is shown, since the settings screen may have replaced them.
  const [settings, setSettings] = useState(loadFacilitySettings);
  const { status, rounds, error, start, remove, clearError, replace } = useFacilityRounds();
  const [openRoundId, setOpenRoundId] = useState<string | null>(null);
  // Set when coming back from a round, so home puts focus on its list instead of leaving it on nothing.
  const [focusList, setFocusList] = useState(false);

  const goHome = () => {
    setSettings(loadFacilitySettings());
    clearError();
    setScreen('home');
  };
  const goTo = (next: Screen) => {
    clearError();
    setFocusList(false);
    setScreen(next);
  };

  const leaveRound = () => {
    setFocusList(true);
    goHome();
  };

  if (screen === 'settings') return <SettingsScreen onBack={goHome} />;
  if (screen === 'round' && openRoundId) {
    const roster = settings?.members ?? null;
    return <RoundInputScreen key={openRoundId} roundId={openRoundId} roster={roster} onBack={leaveRound} onSaved={replace} />;
  }
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
      focusList={focusList}
      onStart={() => goTo('start')}
      onOpenSettings={() => goTo('settings')}
      onOpen={(id) => {
        setOpenRoundId(id);
        goTo('round');
      }}
      onDelete={remove}
    />
  );
}
