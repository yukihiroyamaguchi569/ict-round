import { useRef, useState } from 'react';
import PhotoForm from '../components/PhotoForm';
import type { Photo } from '../types';

interface Props {
  /** Stores the photo; resolves to null when it was added, or to the message to show when it was not. */
  onAdd: (photo: Photo) => Promise<string | null>;
  /** Back to the department, after adding or cancelling. */
  onDone: () => void;
}

/**
 * Adding a photo to an × item with the add-photo screen of the main app (no linked-item card).
 * When the photo cannot be stored, the screen stays with the photo and comment, so 追加する can be pressed again.
 */
export default function AddPhotoScreen({ onAdd, onDone }: Props) {
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
      <PhotoForm categories={[]} onAdd={(photo) => void add(photo)} onCancel={onDone} />
    </div>
  );
}
