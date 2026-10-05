import { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import { IconProvider } from './IconContext';
import StartScreen from './components/StartScreen';
import SavedRoundsList from './components/SavedRoundsList';
import RoundScreens from './components/RoundScreens';
import type { SavedRound } from './types';
import { useChecklistLibrary } from './useChecklistLibrary';
import { useSavedRounds } from './useSavedRounds';
import { useRound } from './useRound';
import { useWhatsNew } from './useWhatsNew';

type Screen = 'start' | 'saved-rounds' | 'round';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('start');
  const checklists = useChecklistLibrary();
  const saved = useSavedRounds();
  const round = useRound();
  const whatsNew = useWhatsNew();

  const handleStartRound = (name: string, wardName: string) => {
    round.start(checklists.activeChecklist, name, wardName);
    setScreen('round');
  };

  const handleLoadRound = (savedRound: SavedRound) => {
    const checklistExists = checklists.library.find((c) => c.id === savedRound.checklistId);
    if (!checklistExists) {
      alert('保存時に使用したチェックリストが見つかりません。');
      return;
    }
    checklists.select(savedRound.checklistId);
    round.resume(savedRound);
    setScreen('round');
  };

  const handleDeleteSavedRound = (id: string) => {
    saved.remove(id);
    round.forgetSavedRound(id);
  };

  if (screen === 'start') {
    return (
      <StartScreen
        checklists={checklists}
        whatsNew={whatsNew}
        savedRoundsCount={saved.savedRounds.length}
        initialName={round.carriedInspectorName}
        onStart={handleStartRound}
        onViewSaved={() => setScreen('saved-rounds')}
      />
    );
  }

  if (screen === 'saved-rounds') {
    return (
      <SavedRoundsList
        savedRounds={saved.savedRounds}
        onLoad={handleLoadRound}
        onDelete={handleDeleteSavedRound}
        onBack={() => setScreen('start')}
      />
    );
  }

  return (
    <RoundScreens
      round={round}
      categories={checklists.activeChecklist.categories}
      onSave={() => round.save(checklists.activeId, saved.save)}
      onExit={() => setScreen('start')}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <IconProvider>
        <AppContent />
      </IconProvider>
    </ThemeProvider>
  );
}
