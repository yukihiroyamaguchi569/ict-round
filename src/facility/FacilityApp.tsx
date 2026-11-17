import { useState } from 'react';
import { ROUND_ENABLED } from './roundEnabled';
import { loadFacilitySettings } from './facilityStorage';
import { useFacilityRounds } from './useFacilityRounds';
import SettingsScreen from './SettingsScreen';
import HomeScreen from './HomeScreen';
import RoundStartScreen from './RoundStartScreen';
import RoundInputScreen from './RoundInputScreen';
import { ThemeProvider } from '../ThemeContext';

type Screen = 'home' | 'settings' | 'start' | 'round';

/**
 * Facility page. Without the preview flag (production) it is the settings screen only,
 * and the round screens and the IndexedDB code drop out of that build (see roundEnabled.ts).
 * Only the preview is themed (the add-photo screen needs the theme); ThemeProvider sets data-theme
 * on the document, so production keeps its current look.
 */
export default function FacilityApp() {
  return ROUND_ENABLED ? (
    <ThemeProvider>
      <RoundApp />
    </ThemeProvider>
  ) : (
    <SettingsScreen />
  );
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

  const openRound = (id: string) => {
    setOpenRoundId(id);
    goTo('round');
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
          const outcome = await start({ ...input, settings });
          // A started round is entered at once, as opening it from home does.
          if (outcome.result === 'started') openRound(outcome.id);
          return outcome.result;
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
      onOpen={openRound}
      onDelete={remove}
    />
  );
}
