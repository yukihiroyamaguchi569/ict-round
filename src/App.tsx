import { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import RoundStart from './components/RoundStart';
import MainScreen from './components/MainScreen';
import PhotoForm from './components/PhotoForm';
import ReportPreview from './components/ReportPreview';
import type { Rating, Photo, RoundData, SavedChecklist } from './types';
import {
  seedDefaultIfFirstRun,
  getActiveId,
  setActiveId,
  addChecklist,
  deleteChecklist,
} from './checklistStorage';

type Screen = 'start' | 'main' | 'photo-add' | 'report';
type MainTab = 'checklist' | 'photos' | 'evaluation';

function initLibraryAndActive(): { library: SavedChecklist[]; activeId: string } {
  const library = seedDefaultIfFirstRun();
  const savedId = getActiveId();
  const activeId = library.find((c) => c.id === savedId) ? savedId! : library[0].id;
  return { library, activeId };
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('start');
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('checklist');
  const [photoContext, setPhotoContext] = useState<{ itemId?: string } | null>(null);

  const [{ library, activeId }, setLibraryState] = useState(initLibraryAndActive);

  const activeChecklist = library.find((c) => c.id === activeId) ?? library[0];

  const [roundData, setRoundData] = useState<RoundData>({
    inspectorName: '',
    wardName: '',
    startTime: '',
    checklistResults: [],
    generalPhotos: [],
    overallEvaluation: '',
  });

  const handleSelectChecklist = (id: string) => {
    setActiveId(id);
    setLibraryState((prev) => ({ ...prev, activeId: id }));
  };

  const handleAddChecklist = (c: SavedChecklist) => {
    addChecklist(c);
    setLibraryState((prev) => ({ library: [...prev.library, c], activeId: prev.activeId }));
  };

  const handleDeleteChecklist = (id: string) => {
    deleteChecklist(id);
    setLibraryState((prev) => {
      const newLib = prev.library.filter((c) => c.id !== id);
      const newActiveId = prev.activeId === id ? newLib[0]?.id ?? '' : prev.activeId;
      if (newActiveId) setActiveId(newActiveId);
      return { library: newLib, activeId: newActiveId };
    });
  };

  const handleStartRound = (name: string, wardName: string) => {
    setRoundData({
      inspectorName: name,
      wardName,
      startTime: new Date().toLocaleString('ja-JP'),
      checklistResults: activeChecklist.categories.flatMap((cat) =>
        cat.items.map((item) => ({ itemId: item.id, rating: null, photos: [] }))
      ),
      generalPhotos: [],
      overallEvaluation: '',
      checklistName: activeChecklist.name,
    });
    setActiveMainTab('checklist');
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
    setActiveMainTab('photos');
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
    return (
      <RoundStart
        library={library}
        activeId={activeId}
        onStart={handleStartRound}
        onSelectChecklist={handleSelectChecklist}
        onAddChecklist={handleAddChecklist}
        onDeleteChecklist={handleDeleteChecklist}
      />
    );
  }

  if (screen === 'photo-add') {
    return (
      <PhotoForm
        linkedItemId={photoContext?.itemId}
        categories={activeChecklist.categories}
        onAdd={handleAddPhoto}
        onCancel={() => { setPhotoContext(null); setScreen('main'); }}
      />
    );
  }

  if (screen === 'report') {
    return (
      <ReportPreview
        roundData={roundData}
        categories={activeChecklist.categories}
        onBack={() => setScreen('main')}
      />
    );
  }

  return (
    <MainScreen
      roundData={roundData}
      categories={activeChecklist.categories}
      activeTab={activeMainTab}
      onTabChange={setActiveMainTab}
      onRatingChange={handleRatingChange}
      onAddPhoto={handleOpenPhotoAdd}
      onDeleteItemPhoto={handleDeleteItemPhoto}
      onDeleteGeneralPhoto={handleDeleteGeneralPhoto}
      onEvaluationChange={handleEvaluationChange}
      onReport={() => setScreen('report')}
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
