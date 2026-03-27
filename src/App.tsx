import { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import RoundStart from './components/RoundStart';
import CheckpointForm from './components/CheckpointForm';
import CheckpointList from './components/CheckpointList';
import ReportPreview from './components/ReportPreview';
import ThemeSelector from './components/ThemeSelector';
import type { Checkpoint, RoundData } from './types';

type Screen = 'start' | 'list' | 'add' | 'report';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('start');
  const [roundData, setRoundData] = useState<RoundData>({
    inspectorName: '',
    startTime: '',
    checkpoints: [],
  });

  const handleStartRound = (name: string) => {
    setRoundData({
      inspectorName: name,
      startTime: new Date().toLocaleString('ja-JP'),
      checkpoints: [],
    });
    setScreen('list');
  };

  const handleAddCheckpoint = (cp: Checkpoint) => {
    setRoundData((prev) => ({
      ...prev,
      checkpoints: [...prev.checkpoints, cp],
    }));
    setScreen('list');
  };

  const handleDeleteCheckpoint = (id: string) => {
    setRoundData((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((cp) => cp.id !== id),
    }));
  };

  if (screen === 'start') {
    return <RoundStart onStart={handleStartRound} />;
  }

  if (screen === 'add') {
    return <CheckpointForm onAdd={handleAddCheckpoint} onCancel={() => setScreen('list')} />;
  }

  if (screen === 'report') {
    return <ReportPreview roundData={roundData} onBack={() => setScreen('list')} />;
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-text">感染対策ラウンド</h1>
            <p className="text-xs text-text-muted">{roundData.inspectorName} — {roundData.startTime}</p>
          </div>
          <ThemeSelector />
        </div>
      </div>

      <CheckpointList
        checkpoints={roundData.checkpoints}
        onDelete={handleDeleteCheckpoint}
        onAddNew={() => setScreen('add')}
        onGenerateReport={() => setScreen('report')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
