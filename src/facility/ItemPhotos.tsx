import type { RoundPhotoRef } from './facilityRound';
import { formatStartedAt } from './dateTimeLocal';

interface Props {
  itemText: string;
  photos: RoundPhotoRef[];
  /** Photo id -> image; null while the images are being read. */
  photoData: Record<string, string> | null;
  /** Shows the "add photo" button; given only for a cell marked ×. */
  onAdd?: () => void;
  onDelete: (photo: RoundPhotoRef) => void;
}

/** The "add photo" button of an × cell and the photos already on it, each with its comment and a delete button. */
export default function ItemPhotos({ itemText, photos, photoData, onAdd, onDelete }: Props) {
  return (
    <div className="mt-3 space-y-3">
      {photos.length > 0 && (
        <ul aria-label={`${itemText} の写真`} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="rounded-xl border border-line overflow-hidden bg-base">
              <PhotoImage dataUrl={imageOf(photoData, photo.id)} />
              <div className="px-3 py-2 space-y-1">
                {photo.comment && <p className="text-sm text-text leading-relaxed break-words">{photo.comment}</p>}
                <p className="text-[11px] text-text-faint">{formatStartedAt(photo.takenAt)}</p>
                <button
                  type="button"
                  onClick={() => onDelete(photo)}
                  aria-label={`写真 ${index + 1} を削除`}
                  className="w-full py-2 rounded-lg text-xs font-bold text-danger border border-line hover:border-danger transition-colors"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        <button type="button" onClick={onAdd} className="btn-primary w-full py-3 text-sm font-bold">
          写真を追加
        </button>
      )}
    </div>
  );
}

/** The photo's image; null while the images are being read, undefined when it could not be read. */
function imageOf(photoData: Record<string, string> | null, id: string): string | null | undefined {
  if (photoData === null) return null;
  return Object.hasOwn(photoData, id) ? photoData[id] : undefined;
}

/** The image; a frame saying so when it could not be read (undefined), or while it is being read (null). */
function PhotoImage({ dataUrl }: { dataUrl: string | null | undefined }) {
  if (dataUrl) return <img src={dataUrl} alt="" className="w-full h-28 object-cover" />;
  return (
    <div className="w-full h-28 flex items-center justify-center bg-base-deep px-2 text-center text-xs text-text-muted">
      {dataUrl === null ? '読み込み中...' : '写真を読めませんでした'}
    </div>
  );
}

interface DeleteDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/** On-screen confirmation before deleting one photo. */
export function PhotoDeleteDialog({ onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-photo-title"
        className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
      >
        <div>
          <h2 id="delete-photo-title" className="text-base font-bold text-text">
            この写真を削除しますか？
          </h2>
          <p className="mt-1 text-sm text-text-muted leading-relaxed">写真とそのコメントが消え、元に戻せません。</p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-danger transition-colors"
          >
            削除する
          </button>
          <button
            type="button"
            onClick={onCancel}
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
