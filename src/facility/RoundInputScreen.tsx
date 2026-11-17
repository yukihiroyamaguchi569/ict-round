import { useEffect, useRef, useState } from 'react';
import { roundProgress, type FacilityRound } from './facilityRound';
import type { FacilityMember } from './facilitySettings';
import { useFacilityRound } from './useFacilityRound';
import { formatStartedAt } from './dateTimeLocal';
import ScreenHeader from './ScreenHeader';
import DepartmentList from './DepartmentList';
import DepartmentScreen from './DepartmentScreen';
import OverallCard from './OverallCard';
import OverallScreen from './OverallScreen';
import UnsavedLeaveDialog from './UnsavedLeaveDialog';
import AddPhotoScreen from './AddPhotoScreen';

interface Props {
  roundId: string;
  /** Members of the settings on this device, offered on the overall screen; null when none are saved. */
  roster: FacilityMember[] | null;
  onBack: () => void;
  /** Called with the round each time it has been saved. */
  onSaved?: (round: FacilityRound) => void;
}

/** What the screen shows: the department list, the overall screen, or one department. */
type View = 'list' | 'overall' | { department: string };

/** Entering one round: the list of departments, one department's ○ / × and comment, or the overall comment and members. */
export default function RoundInputScreen({ roundId, roster, onBack, onSaved }: Props) {
  const { status, round, saveError, saveNow, ...actions } = useFacilityRound(roundId, { onSaved });
  const [view, setView] = useState<View>('list');
  const { photoItem, openPhoto, closePhoto } = useAddPhotoView();
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const listHeading = useRef<HTMLHeadingElement>(null);

  // Entering the round, or coming back to the list, starts at the list (as moving between departments does).
  useEffect(() => {
    if (status === 'ready' && view === 'list') listHeading.current?.focus();
  }, [status, view]);

  // Leaves only once the round on screen is stored; a save that failed (or fails now) is tried again first.
  const leave = async () => {
    setLeaving(true);
    const saved = await saveNow();
    setLeaving(false);
    if (saved) onBack();
    else setConfirmLeave(true);
  };
  const stay = () => {
    setConfirmLeave(false);
    // After the screen behind the dialog is no longer inert.
    setTimeout(() => listHeading.current?.focus());
  };

  if (status !== 'ready' || !round) return <RoundNotReady loading={status === 'loading'} onBack={onBack} />;

  if (photoItem !== null && typeof view === 'object') {
    return <AddPhotoScreen onAdd={(photo) => actions.addPhoto(view.department, photoItem, photo)} onDone={closePhoto} />;
  }

  const progress = roundProgress(round);
  const subtitle = `${formatStartedAt(round.startedAt)} ${round.themeName}（記入済み ${progress.marked} / ${progress.total}）`;

  return (
    <div className="min-h-screen bg-base">
      {/* While leaving or asking, keep the screen out of reach, so no input arrives after the last save */}
      <div inert={leaving || confirmLeave}>
        {view === 'list' ? (
          <ScreenHeader subtitle={subtitle} onBack={() => void leave()} backDisabled={leaving} />
        ) : (
          <ScreenHeader subtitle={subtitle} onBack={() => setView('list')} backLabel="部署の一覧へ戻る" />
        )}

        <div className="animate-page px-4 py-5 pb-16 max-w-3xl mx-auto space-y-5">
          {saveError && (
            <p role="alert" className="card p-4 border border-danger text-sm font-bold text-danger">
              {saveError}
            </p>
          )}
          {view === 'list' ? (
            <>
              <h2 ref={listHeading} tabIndex={-1} className="sr-only">
                部署の一覧
              </h2>
              <OverallCard round={round} onOpen={() => setView('overall')} />
              <DepartmentList round={round} onOpen={(department) => setView({ department })} />
            </>
          ) : (
            <OpenView view={view} round={round} roster={roster} actions={actions} onAddPhoto={openPhoto} onOpen={(department) => setView({ department })} />
          )}
        </div>
      </div>

      {confirmLeave && <UnsavedLeaveDialog onStay={stay} onLeave={onBack} />}
    </div>
  );
}

/** The add-photo screen over the open department: the item it is for, and the way back to where the department was scrolled. */
function useAddPhotoView() {
  const [photoItem, setPhotoItem] = useState<string | null>(null);
  const scrollBack = useRef<number | null>(null);

  // Runs after the department's own focus on its name, so the item the photo was for is in view again.
  useEffect(() => {
    if (photoItem !== null || scrollBack.current === null) return;
    window.scrollTo(0, scrollBack.current);
    scrollBack.current = null;
  }, [photoItem]);

  const openPhoto = (itemId: string) => {
    scrollBack.current = window.scrollY;
    setPhotoItem(itemId);
  };
  return { photoItem, openPhoto, closePhoto: () => setPhotoItem(null) };
}

type RoundInputActions = Omit<ReturnType<typeof useFacilityRound>, 'status' | 'round' | 'saveError' | 'saveNow'>;

interface OpenViewProps {
  view: Exclude<View, 'list'>;
  round: FacilityRound;
  roster: FacilityMember[] | null;
  actions: RoundInputActions;
  onAddPhoto: (itemId: string) => void;
  onOpen: (department: string) => void;
}

/** The overall screen or one department, opened from the list. */
function OpenView({ view, round, roster, actions, onAddPhoto, onOpen }: OpenViewProps) {
  if (view === 'overall') {
    return (
      <OverallScreen round={round} roster={roster} onOverallComment={actions.writeOverallComment} onMembers={actions.chooseMembers} />
    );
  }
  return (
    <DepartmentScreen
      round={round}
      department={view.department}
      onMark={(itemId, value) => actions.mark(view.department, itemId, value)}
      onComment={(text) => actions.writeDepartmentComment(view.department, text)}
      onOpen={onOpen}
      photoData={actions.photoData}
      onAddPhoto={onAddPhoto}
      onDeletePhoto={(photoId) => void actions.removePhoto(photoId)}
    />
  );
}

/** While the round loads, or when it cannot be read, with the way home. */
function RoundNotReady({ loading, onBack }: { loading: boolean; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-base">
      <ScreenHeader subtitle="ラウンドの入力" onBack={onBack} />
      <div className="px-4 py-5 max-w-3xl mx-auto">
        {loading ? (
          <p className="text-sm text-text-muted">読み込み中...</p>
        ) : (
          <div role="alert" className="card p-5 space-y-3">
            <p className="text-sm font-bold text-danger">このラウンドを読み込めませんでした。削除されたか、データが壊れています。</p>
            <button type="button" onClick={onBack} className="btn-primary w-full py-3 text-sm font-bold">
              ホームへ戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
