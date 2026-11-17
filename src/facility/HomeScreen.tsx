import { useEffect, useRef, useState, type Ref } from 'react';
import type { FacilitySettings } from './facilitySettings';
import { roundProgress, type FacilityRound } from './facilityRound';
import type { RoundsStatus } from './useFacilityRounds';
import { formatStartedAt } from './dateTimeLocal';
import ScreenHeader from './ScreenHeader';

interface Props {
  settings: FacilitySettings | null;
  status: RoundsStatus;
  rounds: FacilityRound[];
  error: string | null;
  /** Puts focus on the list heading when shown, e.g. on coming back from a round. */
  focusList?: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
  onOpen: (id: string) => void;
  /** Resolves to whether the round was deleted. */
  onDelete: (id: string) => Promise<boolean>;
}

/** Home of the facility page: start a round, the rounds on this device, and the way to the settings. */
export default function HomeScreen({ settings, status, rounds, error, focusList = false, onStart, onOpenSettings, onOpen, onDelete }: Props) {
  const [pendingDelete, setPendingDelete] = useState<FacilityRound | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Where focus was when the dialog opened, so cancelling (or a failed delete) puts it back there.
  const opener = useRef<HTMLElement | null>(null);
  // Focus lands on the list heading once the deleted round's button is gone.
  const listHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusList) listHeading.current?.focus();
  }, [focusList]);

  const askDelete = (round: FacilityRound) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingDelete(round);
  };
  const closeDialog = (focusTarget: HTMLElement | null = opener.current) => {
    setPendingDelete(null);
    // After the background is no longer inert.
    setTimeout(() => focusTarget?.focus());
  };
  const confirmDelete = async (id: string) => {
    setDeleting(true);
    const deleted = await onDelete(id);
    setDeleting(false);
    closeDialog(deleted ? listHeading.current : opener.current);
  };

  return (
    <div className="min-h-screen bg-base">
      {/* While the delete dialog is open, keep the screen behind it out of reach of Tab and screen readers */}
      <div inert={pendingDelete !== null}>
        <ScreenHeader subtitle="全部署を回るラウンド（開発中）" />

        <div className="animate-page px-4 py-5 pb-16 max-w-3xl mx-auto space-y-5">
          <StartCard settings={settings} status={status} onStart={onStart} onOpenSettings={onOpenSettings} />

          {error && (
            <div role="alert" className="card p-4 border border-danger">
              <p className="text-sm font-bold text-danger">{error}</p>
            </div>
          )}

          <RoundList status={status} rounds={rounds} onOpen={onOpen} onDelete={askDelete} headingRef={listHeading} />

          <SettingsEntry settings={settings} onOpenSettings={onOpenSettings} />
        </div>
      </div>

      {pendingDelete && (
        <DeleteDialog
          round={pendingDelete}
          busy={deleting}
          onConfirm={() => void confirmDelete(pendingDelete.id)}
          onCancel={() => closeDialog()}
        />
      )}
    </div>
  );
}

interface StartCardProps {
  settings: FacilitySettings | null;
  status: RoundsStatus;
  onStart: () => void;
  onOpenSettings: () => void;
}

function StartCard({ settings, status, onStart, onOpenSettings }: StartCardProps) {
  return (
    <div className="card p-5 space-y-3">
      <button
        type="button"
        onClick={onStart}
        disabled={!settings || status !== 'ready'}
        className="btn-primary w-full py-4 text-base font-bold"
      >
        ラウンドを始める
      </button>
      {!settings && (
        <p className="text-sm text-text-muted leading-relaxed">
          先に施設設定を読み込んでください。
          <button type="button" onClick={onOpenSettings} className="ml-1 font-bold text-primary underline py-2">
            施設設定へ
          </button>
        </p>
      )}
      {status === 'unavailable' && (
        <p role="alert" className="text-sm font-bold text-danger leading-relaxed">
          この端末のブラウザではラウンドを保存できないため、始められません。プライベートブラウズを使っている場合は、通常の画面で開いてください。
        </p>
      )}
    </div>
  );
}

function RoundList({
  status,
  rounds,
  onOpen,
  onDelete,
  headingRef,
}: {
  status: RoundsStatus;
  rounds: FacilityRound[];
  onOpen: (id: string) => void;
  onDelete: (round: FacilityRound) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  return (
    <section aria-label="この端末のラウンド" className="card p-5">
      <h2 ref={headingRef} tabIndex={-1} className="text-sm font-extrabold text-text mb-3 focus:outline-none">
        この端末のラウンド
      </h2>
      {status === 'loading' && <p className="text-xs text-text-muted">読み込み中...</p>}
      {status === 'ready' && rounds.length === 0 && (
        <p className="text-xs text-text-muted py-2">まだラウンドはありません。</p>
      )}
      {rounds.length > 0 && (
        <ul className="space-y-3">
          {rounds.map((round) => (
            <RoundRow key={round.id} round={round} onOpen={() => onOpen(round.id)} onDelete={() => onDelete(round)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RoundRow({ round, onOpen, onDelete }: { round: FacilityRound; onOpen: () => void; onDelete: () => void }) {
  const progress = roundProgress(round);
  const label = `${formatStartedAt(round.startedAt)} ${round.themeName}`;
  return (
    <li className="flex items-center gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text">{formatStartedAt(round.startedAt)}</p>
        <p className="text-sm text-text break-words">{round.themeName}</p>
        <p className="text-xs text-text-muted mt-0.5">
          記入済み {progress.marked} / {progress.total}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label} を開く`}
        className="btn-primary px-5 py-3 text-sm font-bold"
      >
        開く
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`${label} を削除`}
        className="px-4 py-3 text-sm font-bold border-2 border-line rounded-t text-text-muted hover:text-danger hover:border-danger transition-colors"
      >
        削除
      </button>
    </li>
  );
}

function SettingsEntry({ settings, onOpenSettings }: { settings: FacilitySettings | null; onOpenSettings: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className="card w-full p-5 text-left flex items-center gap-3 hover:ring-2 hover:ring-primary transition"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-extrabold text-text">施設設定</span>
        <span className="block text-xs text-text-muted mt-1 break-words">
          {settings
            ? `${settings.themes.length} テーマ・${settings.departments.length} 部署・参加者 ${settings.members.length} 名`
            : 'まだ読み込んでいません'}
        </span>
      </span>
      <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

interface DeleteDialogProps {
  round: FacilityRound;
  /** While the delete runs, both buttons are disabled so it is not sent twice. */
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteDialog({ round, busy, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-round-title"
        className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
      >
        <div>
          <h2 id="delete-round-title" className="text-base font-bold text-text">
            このラウンドを削除しますか？
          </h2>
          <p className="mt-1 text-sm text-text-muted leading-relaxed">
            {formatStartedAt(round.startedAt)}・{round.themeName}
            <br />
            入力した内容と写真も消え、元に戻せません。
          </p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-danger transition-colors disabled:opacity-40"
          >
            削除する
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            // Focus starts on the safe choice.
            autoFocus
            className="w-full py-3 rounded-xl text-sm font-bold text-text-muted border-2 border-line hover:border-primary hover:text-primary transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
