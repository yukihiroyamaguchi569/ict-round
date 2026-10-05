import type { Rating, RoundData, ChecklistCategory } from '../types';
import MainHeader from './MainHeader';
import ChecklistTab from './ChecklistTab';
import PhotoTab from './PhotoTab';
import EvaluationTab from './EvaluationTab';
import BottomTabBar from './BottomTabBar';

type MainTab = 'checklist' | 'photos' | 'evaluation';

interface Props {
  roundData: RoundData;
  categories: ChecklistCategory[];
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onRatingChange: (itemId: string, rating: Rating) => void;
  onAddPhoto: (itemId?: string) => void;
  onDeleteItemPhoto: (itemId: string, photoId: string) => void;
  onDeleteGeneralPhoto: (photoId: string) => void;
  onEvaluationChange: (text: string) => void;
  onInspectorChange: (name: string) => void;
  onReport: () => void;
  onSave: () => boolean;
  onHome: () => void;
}

export default function MainScreen({
  roundData,
  categories,
  activeTab,
  onTabChange,
  onRatingChange,
  onAddPhoto,
  onDeleteItemPhoto,
  onDeleteGeneralPhoto,
  onEvaluationChange,
  onInspectorChange,
  onReport,
  onSave,
  onHome,
}: Props) {
  const totalPhotoCount =
    roundData.checklistResults.reduce((sum, r) => sum + r.photos.length, 0) +
    roundData.generalPhotos.length;

  return (
    <div className="min-h-screen bg-base">
      {/* Sticky header */}
      <MainHeader
        roundData={roundData}
        categories={categories}
        onInspectorChange={onInspectorChange}
        onSave={onSave}
        onHome={onHome}
      />

      {/* Tab content */}
      <TabContent
        activeTab={activeTab}
        roundData={roundData}
        categories={categories}
        onRatingChange={onRatingChange}
        onAddPhoto={onAddPhoto}
        onDeleteItemPhoto={onDeleteItemPhoto}
        onDeleteGeneralPhoto={onDeleteGeneralPhoto}
        onEvaluationChange={onEvaluationChange}
      />

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

type TabContentProps = Pick<
  Props,
  | 'activeTab'
  | 'roundData'
  | 'categories'
  | 'onRatingChange'
  | 'onAddPhoto'
  | 'onDeleteItemPhoto'
  | 'onDeleteGeneralPhoto'
  | 'onEvaluationChange'
>;

/** Body of the active tab. */
function TabContent({
  activeTab,
  roundData,
  categories,
  onRatingChange,
  onAddPhoto,
  onDeleteItemPhoto,
  onDeleteGeneralPhoto,
  onEvaluationChange,
}: TabContentProps) {
  return (
    <div className="pb-20">
      {activeTab === 'checklist' && (
        <ChecklistTab
          categories={categories}
          checklistResults={roundData.checklistResults}
          onRatingChange={onRatingChange}
        />
      )}
      {activeTab === 'photos' && (
        <PhotoTab
          categories={categories}
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
  );
}
