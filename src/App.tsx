import { useState } from 'react';
import RoundStart from './components/RoundStart';
import CheckpointForm from './components/CheckpointForm';
import CheckpointList from './components/CheckpointList';
import ReportPreview from './components/ReportPreview';
import type { Checkpoint, RoundData } from './types';

type Screen = 'start' | 'list' | 'add' | 'report';

function App() {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">感染対策ラウンド</h1>
            <p className="text-sm text-gray-500">{roundData.inspectorName} | {roundData.startTime}</p>
          </div>
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

export default App;
