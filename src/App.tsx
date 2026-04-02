import { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import RoundStart from './components/RoundStart';
import MainScreen from './components/MainScreen';
import PhotoForm from './components/PhotoForm';
import ReportPreview from './components/ReportPreview';
import type { Rating, Photo, RoundData } from './types';
import { CHECKLIST_CATEGORIES } from './checklistData';

type Screen = 'start' | 'main' | 'photo-add' | 'report';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('start');
  const [photoContext, setPhotoContext] = useState<{ itemId?: string } | null>(null);
  const [roundData, setRoundData] = useState<RoundData>({
    inspectorName: '',
    wardName: '',
    startTime: '',
    checklistResults: [],
    generalPhotos: [],
    overallEvaluation: '',
  });

  const handleStartRound = (name: string, wardName: string) => {
    setRoundData({
      inspectorName: name,
      wardName,
      startTime: new Date().toLocaleString('ja-JP'),
      checklistResults: CHECKLIST_CATEGORIES.flatMap((cat) =>
        cat.items.map((item) => ({ itemId: item.id, rating: null, photos: [] }))
      ),
      generalPhotos: [],
      overallEvaluation: '',
    });
    setScreen('main');
  };

  const handleRatingChange = (itemId: string, rating: Rating) => {
    setRoundData((prev) => ({
      ...prev,
      checklistResults: prev.checklistResults.map((r) =>
        r.itemId === itemId ? { ...r, rating } : r
      ),
    }));
  };

  const handleAddPhoto = (photo: Photo) => {
    const itemId = photoContext?.itemId;
    if (itemId) {
      setRoundData((prev) => ({
        ...prev,
        checklistResults: prev.checklistResults.map((r) =>
          r.itemId === itemId ? { ...r, photos: [...r.photos, photo] } : r
        ),
      }));
    } else {
      setRoundData((prev) => ({
        ...prev,
        generalPhotos: [...prev.generalPhotos, photo],
      }));
    }
    setPhotoContext(null);
    setScreen('main');
  };

  const handleDeleteItemPhoto = (itemId: string, photoId: string) => {
    setRoundData((prev) => ({
      ...prev,
      checklistResults: prev.checklistResults.map((r) =>
        r.itemId === itemId
          ? { ...r, photos: r.photos.filter((p) => p.id !== photoId) }
          : r
      ),
    }));
  };

  const handleDeleteGeneralPhoto = (photoId: string) => {
    setRoundData((prev) => ({
      ...prev,
      generalPhotos: prev.generalPhotos.filter((p) => p.id !== photoId),
    }));
  };

  const handleEvaluationChange = (text: string) => {
    setRoundData((prev) => ({ ...prev, overallEvaluation: text }));
  };

  const handleOpenPhotoAdd = (itemId?: string) => {
    setPhotoContext(itemId ? { itemId } : null);
    setScreen('photo-add');
  };

  if (screen === 'start') {
    return <RoundStart onStart={handleStartRound} />;
  }

  if (screen === 'photo-add') {
    return (
      <PhotoForm
        linkedItemId={photoContext?.itemId}
        onAdd={handleAddPhoto}
        onCancel={() => { setPhotoContext(null); setScreen('main'); }}
      />
    );
  }

  if (screen === 'report') {
    return <ReportPreview roundData={roundData} onBack={() => setScreen('main')} />;
  }

  return (
    <MainScreen
      roundData={roundData}
      onRatingChange={handleRatingChange}
      onAddPhoto={handleOpenPhotoAdd}
      onDeleteItemPhoto={handleDeleteItemPhoto}
      onDeleteGeneralPhoto={handleDeleteGeneralPhoto}
      onEvaluationChange={handleEvaluationChange}
      onReport={() => setScreen('report')}
      onPhotoAddForItem={(itemId) => handleOpenPhotoAdd(itemId)}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
