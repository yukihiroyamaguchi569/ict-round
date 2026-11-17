import { useState } from 'react';
import { roundProgress, type FacilityRound } from './facilityRound';
import { useFacilityRound } from './useFacilityRound';
import { formatStartedAt } from './dateTimeLocal';
import ScreenHeader from './ScreenHeader';
import DepartmentList from './DepartmentList';
import DepartmentScreen from './DepartmentScreen';

interface Props {
  roundId: string;
  onBack: () => void;
  /** Called with the round each time it has been saved. */
  onSaved?: (round: FacilityRound) => void;
}

/** Entering one round: the list of departments, and one department's ○ / × once it is opened. */
export default function RoundInputScreen({ roundId, onBack, onSaved }: Props) {
  const { status, round, saveError, mark } = useFacilityRound(roundId, { onSaved });
  const [department, setDepartment] = useState<string | null>(null);

  if (status !== 'ready' || !round) {
    return (
      <div className="min-h-screen bg-base">
        <ScreenHeader subtitle="ラウンドの入力" onBack={onBack} />
        <div className="px-4 py-5 max-w-3xl mx-auto">
          {status === 'loading' ? (
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

  const progress = roundProgress(round);
  const subtitle = `${formatStartedAt(round.startedAt)} ${round.themeName}（記入済み ${progress.marked} / ${progress.total}）`;

  return (
    <div className="min-h-screen bg-base">
      {department === null ? (
        <ScreenHeader subtitle={subtitle} onBack={onBack} />
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
          <DepartmentList round={round} onOpen={setDepartment} />
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
  );
}
