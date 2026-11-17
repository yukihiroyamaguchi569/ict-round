import { useEffect, useRef, useState } from 'react';
import {
  applicableItems,
  departmentComment,
  departmentProgress,
  markOf,
  type FacilityRound,
  type Mark,
  type RoundPhotoRef,
} from './facilityRound';
import MarkButtons from './MarkButtons';
import ItemPhotos, { PhotoDeleteDialog } from './ItemPhotos';
import { TEXTAREA_CLASS } from './optionStyles';

interface Props {
  round: FacilityRound;
  department: string;
  onMark: (itemId: string, mark: Mark) => void;
  onComment: (text: string) => void;
  /** Opens another department of the round. */
  onOpen: (department: string) => void;
  /** Photo id -> image; null while the images are being read. */
  photoData: Record<string, string> | null;
  /** Opens the add-photo screen for an item marked ×. */
  onAddPhoto: (itemId: string) => void;
  onDeletePhoto: (photoId: string) => void;
}

/** One department: its applicable items with ○ / × and the photos of × items, and the way to the previous and next departments. */
// eslint-disable-next-line max-lines-per-function -- mostly JSX markup of the department's cards; the logic is in facilityRound and the hooks
export default function DepartmentScreen({ round, department, onMark, onComment, onOpen, photoData, onAddPhoto, onDeletePhoto }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [pendingDelete, setPendingDelete] = useState<RoundPhotoRef | null>(null);
  const items = applicableItems(round, department);
  const progress = departmentProgress(round, department);
  const index = round.departments.findIndex((d) => d.name === department);
  const previous = round.departments[index - 1]?.name;
  const next = index >= 0 ? round.departments[index + 1]?.name : undefined;

  // Moving to another department starts from its name, at the top of the page.
  useEffect(() => {
    heading.current?.focus();
  }, [department]);

  // The delete button that opened the dialog, so cancelling puts focus back on it.
  const opener = useRef<HTMLElement | null>(null);
  const askDelete = (photo: RoundPhotoRef) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingDelete(photo);
  };
  // Focus moves once the screen behind the dialog is no longer inert.
  const confirmDelete = (photoId: string) => {
    setPendingDelete(null);
    onDeletePhoto(photoId);
    // The pressed button is gone with its photo; the department name stays, without scrolling to it.
    setTimeout(() => heading.current?.focus({ preventScroll: true }));
  };
  const cancelDelete = () => {
    setPendingDelete(null);
    setTimeout(() => opener.current?.focus());
  };

  return (
    <>
      <div className="space-y-5" inert={pendingDelete !== null}>
        <div className="card p-5">
          <h2 ref={heading} tabIndex={-1} className="text-xl font-extrabold text-text break-words focus:outline-none">
            {department}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            記入済み {progress.marked} / {progress.total}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="card p-5 text-sm text-text-muted">この部署に当てはまる項目はありません。</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const mark = markOf(round, department, item.id);
              const photos = round.photos.filter((p) => p.department === department && p.itemId === item.id);
              return (
                <li key={item.id} className="card p-5">
                  <p className="text-base text-text leading-relaxed break-words">{item.text}</p>
                  <MarkButtons
                    itemText={item.text}
                    value={mark}
                    onPress={(value) => onMark(item.id, value)}
                    locked={photos.length > 0}
                  />
                  {(mark === 'ng' || photos.length > 0) && (
                    <ItemPhotos
                      itemText={item.text}
                      photos={photos}
                      photoData={photoData}
                      onAdd={mark === 'ng' ? () => onAddPhoto(item.id) : undefined}
                      onDelete={askDelete}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <label className="card p-5 block">
          <span className="block text-sm font-extrabold text-text mb-3">この部署のコメント</span>
          <textarea
            value={departmentComment(round, department)}
            onChange={(e) => onComment(e.target.value)}
            rows={4}
            className={TEXTAREA_CLASS}
          />
        </label>

        <nav aria-label="前後の部署" className="grid grid-cols-2 gap-3">
          {previous && <StepButton label="前の部署" name={previous} onClick={() => onOpen(previous)} />}
          {next && <StepButton label="次の部署" name={next} onClick={() => onOpen(next)} alignEnd />}
        </nav>
      </div>
      {pendingDelete && <PhotoDeleteDialog onConfirm={() => confirmDelete(pendingDelete.id)} onCancel={cancelDelete} />}
    </>
  );
}

function StepButton({ label, name, onClick, alignEnd = false }: { label: string; name: string; onClick: () => void; alignEnd?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${name}`}
      className={`card px-4 py-4 hover:ring-2 hover:ring-primary transition ${alignEnd ? 'col-start-2 text-right' : 'text-left'}`}
    >
      <span className="block text-xs text-text-muted">{alignEnd ? `${label} →` : `← ${label}`}</span>
      <span className="block text-base font-bold text-text break-words">{name}</span>
    </button>
  );
}
