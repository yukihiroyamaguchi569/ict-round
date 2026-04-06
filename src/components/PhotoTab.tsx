import type { ChecklistItemResult, Photo } from '../types';
import { getItemById } from '../checklistData';

interface Props {
  checklistResults: ChecklistItemResult[];
  generalPhotos: Photo[];
  onAddPhoto: (itemId?: string) => void;
  onDeleteItemPhoto: (itemId: string, photoId: string) => void;
  onDeleteGeneralPhoto: (photoId: string) => void;
}

function PhotoCard({
  photo,
  label,
  onDelete,
}: {
  photo: Photo;
  label?: string;
  onDelete: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="relative">
        <img src={photo.dataUrl} alt="" className="w-full max-h-48 object-cover" />
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 bg-text/50 backdrop-blur-sm text-white rounded-full w-7 h-7 flex items-center justify-center"
          aria-label="削除"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-3 py-2.5">
        {label && (
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1 truncate">{label}</p>
        )}
        {photo.comment && (
          <p className="text-sm text-text leading-relaxed">{photo.comment}</p>
        )}
        <p className="text-[11px] text-text-faint mt-1">{photo.timestamp}</p>
      </div>
    </div>
  );
}

export default function PhotoTab({
  checklistResults,
  generalPhotos,
  onAddPhoto,
  onDeleteItemPhoto,
  onDeleteGeneralPhoto,
}: Props) {
  const itemPhotos = checklistResults.filter((r) => r.photos.length > 0);
  const totalCount = itemPhotos.reduce((sum, r) => sum + r.photos.length, 0) + generalPhotos.length;

  return (
    <div className="px-4 py-4 pb-6 space-y-4">
      {/* Add button */}
      <button
        type="button"
        onClick={() => onAddPhoto(undefined)}
        className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        写真を追加
      </button>

      {totalCount === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-base-deep flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-faint" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-text-muted">写真はまだありません</p>
          <p className="text-xs text-text-faint mt-1">上のボタンから追加できます</p>
        </div>
      ) : (
        <>
          {/* Item-linked photos */}
          {itemPhotos.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 px-1">項目紐付き写真</h3>
              <div className="space-y-3">
                {itemPhotos.map((result) => {
                  const item = getItemById(result.itemId);
                  return result.photos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      label={item?.category + '：' + item?.description.slice(0, 30) + (item && item.description.length > 30 ? '…' : '')}
                      onDelete={() => onDeleteItemPhoto(result.itemId, photo.id)}
                    />
                  ));
                })}
              </div>
            </div>
          )}

          {/* General photos */}
          {generalPhotos.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 px-1">汎用写真</h3>
              <div className="space-y-3">
                {generalPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    onDelete={() => onDeleteGeneralPhoto(photo.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
