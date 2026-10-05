import { useState } from 'react';
import type { ChecklistCategory, Photo } from '../types';
import type { useRound } from '../useRound';
import MainScreen from './MainScreen';
import PhotoForm from './PhotoForm';
import ReportPreview from './ReportPreview';
import LeaveRoundDialog from './LeaveRoundDialog';

type Screen = 'main' | 'photo-add' | 'report';
type MainTab = 'checklist' | 'photos' | 'evaluation';

interface Props {
  round: ReturnType<typeof useRound>;
  categories: ChecklistCategory[];
  onSave: () => boolean;
  onExit: () => void;
}

/**
 * Screens of a round in progress: the main screen with its tabs, the add-photo screen and the report.
 * Mounted fresh for each started or resumed round, so it opens on the main screen's checklist tab.
 */
export default function RoundScreens({ round, categories, onSave, onExit }: Props) {
  const [screen, setScreen] = useState<Screen>('main');
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('checklist');
  const [photoContext, setPhotoContext] = useState<{ itemId?: string } | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const handleAddPhoto = (photo: Photo) => {
    round.addPhoto(photo, photoContext?.itemId);
    setPhotoContext(null);
    setActiveMainTab('photos');
    setScreen('main');
  };

  const handleOpenPhotoAdd = (itemId?: string) => {
    setPhotoContext(itemId ? { itemId } : null);
    setScreen('photo-add');
  };

  const handleGoHome = () => (round.hasUnsavedChanges() ? setShowLeaveDialog(true) : onExit());

  if (screen === 'photo-add') {
    return (
      <PhotoForm
        linkedItemId={photoContext?.itemId}
        categories={categories}
        onAdd={handleAddPhoto}
        onCancel={() => { setPhotoContext(null); setScreen('main'); }}
      />
    );
  }

  if (screen === 'report') {
    return <ReportPreview roundData={round.roundData} categories={categories} onBack={() => setScreen('main')} />;
  }

  return (
    <>
      <MainScreen
        roundData={round.roundData}
        categories={categories}
        activeTab={activeMainTab}
        onTabChange={setActiveMainTab}
        onRatingChange={round.changeRating}
        onAddPhoto={handleOpenPhotoAdd}
        onDeleteItemPhoto={round.deleteItemPhoto}
        onDeleteGeneralPhoto={round.deleteGeneralPhoto}
        onEvaluationChange={round.changeEvaluation}
        onInspectorChange={round.changeInspector}
        onReport={() => setScreen('report')}
        onSave={onSave}
        onHome={handleGoHome}
      />
      {showLeaveDialog && (
        <LeaveRoundDialog
          onSaveAndLeave={() => {
            if (onSave()) onExit();
          }}
          onLeave={onExit}
          onCancel={() => setShowLeaveDialog(false)}
        />
      )}
    </>
  );
}
