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
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onRatingChange: (itemId: string, rating: Rating) => void;
  onAddPhoto: (itemId?: string) => void;
  onDeleteItemPhoto: (itemId: string, photoId: string) => void;
  onDeleteGeneralPhoto: (photoId: string) => void;
  onEvaluationChange: (text: string) => void;
  onReport: () => void;
}

export default function MainScreen({
  roundData,
  activeTab,
  onTabChange,
  onRatingChange,
  onAddPhoto,
  onDeleteItemPhoto,
  onDeleteGeneralPhoto,
  onEvaluationChange,
  onReport,
}: Props) {

  const ratedCount = roundData.checklistResults.filter((r) => r.rating !== null).length;
  const totalPhotoCount =
    roundData.checklistResults.reduce((sum, r) => sum + r.photos.length, 0) +
    roundData.generalPhotos.length;

  return (
    <div className="min-h-screen bg-base">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}ran-icon.png`} alt="らんちゃん" className="w-9 h-9 object-contain flex-shrink-0" />
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
        onTabChange={onTabChange}
        onReport={onReport}
        photoCount={totalPhotoCount}
        hasEvaluation={roundData.overallEvaluation.trim().length > 0}
      />
    </div>
  );
}
