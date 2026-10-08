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
  // Each opening of the dialog is a session, so a copy that settles after the dialog was reopened leaves the new one alone
  const session = useRef(0);
  // Session whose copy is still pending; without it a slow first write failing after a second one succeeded
  // would overwrite "copied" with "failed"
  const copyingSession = useRef<number | null>(null);
  const canShareOther = typeof navigator.share === 'function';
  // The button that opens the dialog; focus goes back to it on close
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openDialog = () => {
    session.current += 1;
    setCopyStatus('idle');
    setOpen(true);
  };

  const closeDialog = () => setOpen(false);

  /** Mail, LINE and X are plain links; record the tap. */
  const trackLink = (method: Extract<AppShareMethod, 'email' | 'line' | 'x'>) => {
    trackEvent('app_share', { method });
  };

  const copyLink = async () => {
    const current = session.current;
    if (copyingSession.current === current) return;
    copyingSession.current = current;
    const showIfCurrent = (status: CopyStatus) => {
      if (session.current === current) setCopyStatus(status);
    };
    try {
      // Throws a TypeError when the browser has no Clipboard API, which is handled like a refused write
      await navigator.clipboard.writeText(appShareUrl('copy'));
      showIfCurrent('copied');
      trackEvent('app_share', { method: 'copy' });
    } catch {
      showIfCurrent('failed');
    } finally {
      if (copyingSession.current === current) copyingSession.current = null;
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

  return { open, copyStatus, canShareOther, triggerRef, openDialog, closeDialog, trackLink, copyLink, shareOther };
}

export type AppShareState = ReturnType<typeof useAppShare>;
