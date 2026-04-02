import { useState } from 'react';
import type { Rating, RoundData } from '../types';
import { TOTAL_ITEMS } from '../checklistData';
import ThemeSelector from './ThemeSelector';
import ChecklistTab from './ChecklistTab';
import PhotoTab from './PhotoTab';
import EvaluationTab from './EvaluationTab';
import BottomTabBar from './BottomTabBar';

type MainTab = 'checklist' | 'photos' | 'evaluation';

interface Props {
  roundData: RoundData;
  onRatingChange: (itemId: string, rating: Rating) => void;
  onAddPhoto: (itemId?: string) => void;
  onDeleteItemPhoto: (itemId: string, photoId: string) => void;
  onDeleteGeneralPhoto: (photoId: string) => void;
  onEvaluationChange: (text: string) => void;
  onReport: () => void;
  onPhotoAddForItem: (itemId: string) => void;
}

export default function MainScreen({
  roundData,
  onRatingChange,
  onAddPhoto,
  onDeleteItemPhoto,
  onDeleteGeneralPhoto,
  onEvaluationChange,
  onReport,
  onPhotoAddForItem,
}: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('checklist');

  const ratedCount = roundData.checklistResults.filter((r) => r.rating !== null).length;
  const totalPhotoCount =
    roundData.checklistResults.reduce((sum, r) => sum + r.photos.length, 0) +
    roundData.generalPhotos.length;

  const handleAddPhotoFromChecklist = (itemId: string) => {
    onPhotoAddForItem(itemId);
  };

  return (
    <div className="min-h-screen bg-base">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-primary" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-text leading-tight">感染対策ラウンド</h1>
            <p className="text-xs text-text-muted truncate">
              {roundData.inspectorName}
              {roundData.wardName ? `・${roundData.wardName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={
                ratedCount === TOTAL_ITEMS
                  ? { backgroundColor: '#059669', color: '#fff' }
                  : { backgroundColor: 'var(--t-primary-light)', color: 'var(--t-primary)' }
              }
            >
              {ratedCount}/{TOTAL_ITEMS}
            </span>
            <ThemeSelector />
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="pb-20">
        {activeTab === 'checklist' && (
          <ChecklistTab
            checklistResults={roundData.checklistResults}
            onRatingChange={onRatingChange}
            onAddPhoto={handleAddPhotoFromChecklist}
          />
        )}
        {activeTab === 'photos' && (
          <PhotoTab
            checklistResults={roundData.checklistResults}
            generalPhotos={roundData.generalPhotos}
            onAddPhoto={onAddPhoto}
            onDeleteItemPhoto={onDeleteItemPhoto}
            onDeleteGeneralPhoto={onDeleteGeneralPhoto}
          />
        )}
        {activeTab === 'evaluation' && (
          <EvaluationTab
            value={roundData.overallEvaluation}
            onChange={onEvaluationChange}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onReport={onReport}
        photoCount={totalPhotoCount}
        hasEvaluation={roundData.overallEvaluation.trim().length > 0}
      />
    </div>
  );
}
