import { useRef } from 'react';
import { appShareData, appShareMailto, isShareCancel, openMailDraft } from './appShare';
import { trackEvent } from './analytics';

/**
 * Introduce the app to a colleague: the OS share sheet when there is one, otherwise a new mail.
 * A cancelled share sheet does nothing; any other share failure falls back to mail.
 * Only the method is recorded, never round input data.
 */
export function useAppShare() {
  // A second tap while the sheet is open would reject with InvalidStateError and wrongly fall back to mail
  const sharing = useRef(false);

  const openMail = () => {
    openMailDraft(appShareMailto());
    trackEvent('app_share', { method: 'email' });
  };

  const shareApp = async () => {
    if (sharing.current) return;
    if (typeof navigator.share !== 'function') {
      openMail();
      return;
    }
    sharing.current = true;
    try {
      await navigator.share(appShareData());
      trackEvent('app_share', { method: 'share' });
    } catch (err) {
      if (!isShareCancel(err)) openMail();
    } finally {
      sharing.current = false;
    }
  };

  const trackAboutClick = () => trackEvent('about_link_click');

  return { shareApp, trackAboutClick };
}
