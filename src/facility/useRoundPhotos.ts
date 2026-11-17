import { useCallback, useEffect, useState, type RefObject } from 'react';
import { addPhotoRef, removePhotoRef, type FacilityRound } from './facilityRound';
import type { DbResult, FacilityDb } from './roundDb';
import { isRecord } from './storedFacilitySettings';
import type { ExportedPhoto } from './facilityRoundExport';
import type { Photo } from '../types';
import { saveErrorMessage } from '../roundData';

export const PHOTO_SAVE_ERROR_MESSAGE = '写真を保存できませんでした。もう一度「追加する」を押してください。';

/** The quota message of saveErrorMessage when storage is full, otherwise the photo message. */
export function photoSaveErrorMessage(error: unknown): string {
  const message = saveErrorMessage(error);
  return message === saveErrorMessage(null) ? PHOTO_SAVE_ERROR_MESSAGE : message;
}

/**
 * Photo id -> data URL of stored photo records. Records without a string id or an image data URL are
 * left out, so they show as photos that could not be read. Built with fromEntries, so an id such as
 * "__proto__" stays an own key.
 */
export function photoDataUrls(records: unknown[]): Record<string, string> {
  const entries = records.flatMap((record): [string, string][] => {
    if (!isRecord(record)) return [];
    const { id, dataUrl } = record;
    if (typeof id !== 'string' || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return [];
    return [[id, dataUrl]];
  });
  return Object.fromEntries(entries);
}

/** Stores the images one after another in the save queue; the error of the first that could not be stored. */
async function storeImages(
  target: FacilityDb,
  roundId: string,
  photos: ExportedPhoto[],
  enqueue: RoundPhotosDeps['enqueue']
): Promise<{ error: unknown } | null> {
  for (const photo of photos) {
    const stored = await enqueue(() => target.putPhoto({ id: photo.id, roundId, dataUrl: photo.dataUrl }));
    if (!stored.ok) return { error: stored.error };
  }
  return null;
}

type Change = (apply: (current: FacilityRound) => FacilityRound) => Promise<boolean> | undefined;

interface RoundPhotosDeps {
  roundId: string;
  /** True once the round has been read and the database is open. */
  ready: boolean;
  dbRef: RefObject<FacilityDb | null>;
  latestRef: RefObject<FacilityRound | null>;
  /** Applies a change on screen and saves the round; undefined when nothing changed. */
  change: Change;
  /** Runs a write after every write queued before it. */
  enqueue: <T>(write: () => Promise<DbResult<T>>) => Promise<DbResult<T>>;
}

/**
 * Photos of × cells. The image is stored apart from the round; the round holds only the reference.
 * Adding stores the image first and adds the reference only when that worked. Removing drops the
 * reference, and deletes the image once the round without it has been saved.
 */
export function useRoundPhotos({ roundId, ready, dbRef, latestRef, change, enqueue }: RoundPhotosDeps) {
  // null while the images are being read.
  const [photoData, setPhotoData] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const target = dbRef.current;
    if (!ready || !target) return;
    let cancelled = false;
    void target.getPhotos(roundId).then((read) => {
      if (cancelled) return;
      const loaded = read.ok ? photoDataUrls(read.value) : {};
      // Photos added while reading are kept.
      setPhotoData((added) => ({ ...loaded, ...added }));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, roundId, dbRef]);

  /** Resolves to null when the photo was added, or to the message to show when its image could not be stored. */
  const addPhoto = useCallback(
    async (department: string, itemId: string, photo: Photo): Promise<string | null> => {
      const target = dbRef.current;
      const current = latestRef.current;
      if (!target || !current) return PHOTO_SAVE_ERROR_MESSAGE;
      const stored = await enqueue(() => target.putPhoto({ id: photo.id, roundId: current.id, dataUrl: photo.dataUrl }));
      if (!stored.ok) return photoSaveErrorMessage(stored.error);
      setPhotoData((data) => ({ ...data, [photo.id]: photo.dataUrl }));
      const ref = {
        id: photo.id,
        department,
        itemId,
        comment: photo.comment,
        takenAt: new Date().toISOString(),
        width: photo.width,
        height: photo.height,
      };
      // A failed save of the round is shown like any other autosave failure.
      void change((round) => addPhotoRef(round, ref));
      return null;
    },
    [dbRef, latestRef, enqueue, change]
  );

  const removePhoto = useCallback(
    async (photoId: string): Promise<void> => {
      const target = dbRef.current;
      const saved = change((round) => removePhotoRef(round, photoId));
      // While the round still holds the reference in storage, the image stays.
      if (!target || !saved || !(await saved)) return;
      // A failed delete leaves an unused image, removed with the round.
      await enqueue(() => target.deletePhoto(roundId, photoId));
    },
    [roundId, dbRef, change, enqueue]
  );

  /**
   * Stores images of another device's photos, one after another, before the round that refers to them is saved.
   * Resolves to null once every image is stored (and shown), or to the error of the first that could not be;
   * images stored before it stay, unseen while no reference points to them.
   */
  const storePhotos = useCallback(
    async (photos: ExportedPhoto[]): Promise<{ error: unknown } | null> => {
      const target = dbRef.current;
      const current = latestRef.current;
      const failure = target && current ? await storeImages(target, current.id, photos, enqueue) : { error: null };
      if (failure) return failure;
      const added = Object.fromEntries(photos.map((p) => [p.id, p.dataUrl]));
      setPhotoData((data) => ({ ...data, ...added }));
      return null;
    },
    [dbRef, latestRef, enqueue]
  );

  return { photoData, addPhoto, removePhoto, storePhotos };
}
