import { useRef, useState } from 'react';
import { appShareData, appShareUrl, isShareCancel, type AppShareMethod } from './appShare';
import { trackEvent } from './analytics';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * The dialog for introducing the app to a colleague: open / close, copying the link, and the OS share sheet.
 * Only the destination is recorded, never round input data.
 */
export function useAppShare() {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  // A second tap while the sheet is open would reject with InvalidStateError
  const sharing = useRef(false);
  // Without this, a slow first write failing after a second one succeeded would overwrite "copied" with "failed"
  const copying = useRef(false);
  const canShareOther = typeof navigator.share === 'function';

  const openDialog = () => {
    setCopyStatus('idle');
    setOpen(true);
  };

  const closeDialog = () => setOpen(false);

  /** Mail, LINE and X are plain links; record the tap. */
  const trackLink = (method: Extract<AppShareMethod, 'email' | 'line' | 'x'>) => {
    trackEvent('app_share', { method });
  };

  const copyLink = async () => {
    if (copying.current) return;
    copying.current = true;
    try {
      // Throws a TypeError when the browser has no Clipboard API, which is handled like a refused write
      await navigator.clipboard.writeText(appShareUrl('copy'));
      setCopyStatus('copied');
      trackEvent('app_share', { method: 'copy' });
    } catch {
      setCopyStatus('failed');
    } finally {
      copying.current = false;
    }
  };

  const shareOther = async () => {
    if (sharing.current) return;
    sharing.current = true;
    try {
      await navigator.share(appShareData());
      trackEvent('app_share', { method: 'share' });
    } catch (err) {
      // Cancelling the sheet is not an error; other failures leave the remaining options in the dialog
      if (!isShareCancel(err)) console.error('共有に失敗しました:', err);
    } finally {
      sharing.current = false;
    }
  };

  return { open, copyStatus, canShareOther, openDialog, closeDialog, trackLink, copyLink, shareOther };
}

export type AppShareState = ReturnType<typeof useAppShare>;
