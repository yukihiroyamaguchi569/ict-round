import { useRef, useState } from 'react';
import PhotoForm from '../components/PhotoForm';
import type { ChecklistCategory, Photo } from '../types';
import type { FacilityRound } from './facilityRound';

interface Props {
  round: FacilityRound;
  department: string;
  /** The × item the photo is for. */
  itemId: string;
  /** Stores the photo; resolves to null when it was added, or to the message to show when it was not. */
  onAdd: (photo: Photo) => Promise<string | null>;
  /** Back to the department, after adding or cancelling. */
  onDone: () => void;
}

/**
 * The item as PhotoForm's linked-item card shows it. The card shows only the description,
 * so the department name leads it.
 */
function linkedItemCategories(round: FacilityRound, department: string, itemId: string): ChecklistCategory[] {
  const item = round.items.find((i) => i.id === itemId);
  const description = item ? `${department}：${item.text}` : department;
  return [{ category: department, items: [{ id: itemId, category: department, description }] }];
}

/**
 * Adding a photo to an × item with the add-photo screen of the main app; its linked-item card names the department and item.
 * When the photo cannot be stored, the screen stays with the photo and comment, so 追加する can be pressed again.
 */
export default function AddPhotoScreen({ round, department, itemId, onAdd, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // A ref as well, so a second press before the re-render does not add the photo twice.
  const busy = useRef(false);

  const add = async (photo: Photo) => {
    if (busy.current) return;
    busy.current = true;
    setAdding(true);
    const failure = await onAdd(photo);
    busy.current = false;
    setAdding(false);
    if (failure) setError(failure);
    else onDone();
  };

  return (
    <div inert={adding}>
      {error && (
        <p role="alert" className="px-5 py-3 bg-surface border-b border-danger text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <PhotoForm
        linkedItemId={itemId}
        categories={linkedItemCategories(round, department, itemId)}
        onAdd={(photo) => void add(photo)}
        onCancel={onDone}
      />
    </div>
  );
}
