import { useEffect, useState } from 'react';
import {
  fetchReleases,
  pickUnseenReleases,
  loadLastSeenVersion,
  markVersionSeen,
  needsReleaseCheck,
  type Release,
} from './whatsNew';

/** Release notes the user has not seen yet, fetched once at launch, and a close action that records them as seen. */
export function useWhatsNew() {
  const [unseenReleases, setUnseenReleases] = useState<Release[]>([]);

  useEffect(() => {
    if (!needsReleaseCheck(loadLastSeenVersion(), __APP_VERSION__)) return;
    let cancelled = false;
    void fetchReleases(import.meta.env.BASE_URL).then((releases) => {
      // On fetch failure, show nothing and keep the record so it is retried next launch.
      if (cancelled || releases === null) return;
      const unseen = pickUnseenReleases(releases, loadLastSeenVersion(), __APP_VERSION__);
      // With no unseen entries, keep the record: releases.json may be a stale cache.
      if (unseen.length > 0) setUnseenReleases(unseen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeWhatsNew = () => {
    // unseenReleases is newest first; record the latest version actually shown.
    const latestShown = unseenReleases[0];
    setUnseenReleases([]);
    if (latestShown) markVersionSeen(latestShown.version);
  };

  return { unseenReleases, closeWhatsNew };
}
