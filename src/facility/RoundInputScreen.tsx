import { useEffect, useRef, useState } from 'react';
import { roundProgress, type FacilityRound } from './facilityRound';
import { useFacilityRound } from './useFacilityRound';
import { formatStartedAt } from './dateTimeLocal';
import ScreenHeader from './ScreenHeader';
import DepartmentList from './DepartmentList';
import DepartmentScreen from './DepartmentScreen';
import UnsavedLeaveDialog from './UnsavedLeaveDialog';

interface Props {
  roundId: string;
  onBack: () => void;
  /** Called with the round each time it has been saved. */
  onSaved?: (round: FacilityRound) => void;
}

/** Entering one round: the list of departments, and one department's ○ / × once it is opened. */
export default function RoundInputScreen({ roundId, onBack, onSaved }: Props) {
  const { status, round, saveError, mark, saveNow } = useFacilityRound(roundId, { onSaved });
  const [department, setDepartment] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const listHeading = useRef<HTMLHeadingElement>(null);

  // Entering the round, or coming back from a department, starts at the list (as moving between departments does).
  useEffect(() => {
    if (status === 'ready' && department === null) listHeading.current?.focus();
  }, [status, department]);

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

  const progress = roundProgress(round);
  const subtitle = `${formatStartedAt(round.startedAt)} ${round.themeName}（記入済み ${progress.marked} / ${progress.total}）`;

  return (
    <div className="min-h-screen bg-base">
      {/* While leaving or asking, keep the screen out of reach, so no input arrives after the last save */}
      <div inert={leaving || confirmLeave}>
        {department === null ? (
          <ScreenHeader subtitle={subtitle} onBack={() => void leave()} backDisabled={leaving} />
        ) : (
          <ScreenHeader subtitle={subtitle} onBack={() => setDepartment(null)} backLabel="部署の一覧へ戻る" />
        )}

        <div className="animate-page px-4 py-5 pb-16 max-w-3xl mx-auto space-y-5">
          {saveError && (
            <p role="alert" className="card p-4 border border-danger text-sm font-bold text-danger">
              {saveError}
            </p>
          )}
          {department === null ? (
            <>
              <h2 ref={listHeading} tabIndex={-1} className="sr-only">
                部署の一覧
              </h2>
              <DepartmentList round={round} onOpen={setDepartment} />
            </>
          ) : (
            <DepartmentScreen
              round={round}
              department={department}
              onMark={(itemId, value) => mark(department, itemId, value)}
              onOpen={setDepartment}
            />
          )}
        </div>
      </div>

      {confirmLeave && <UnsavedLeaveDialog onStay={stay} onLeave={onBack} />}
    </div>
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
