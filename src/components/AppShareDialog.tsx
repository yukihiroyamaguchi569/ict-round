import { useEffect, useRef, type ReactNode } from 'react';
import { appShareLineUrl, appShareMailto, appShareUrl, appShareXUrl } from '../appShare';
import type { AppShareState } from '../useAppShare';

const OPTION_CLASS =
  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-text border-2 border-line hover:border-primary transition-colors';

/** Generic outline icon (no brand logos) drawn from the given path data. */
function OptionIcon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICON = {
  mail: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0l9 6 9-6',
  chat: 'M8 10h8M8 14h5M21 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1121 12z',
  post: 'M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  share: 'M12 15V3m0 0L8 7m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
};

function OptionLink({ href, icon, onClick, newTab = true, children }: {
  href: string;
  icon: string;
  onClick: () => void;
  newTab?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={onClick}
      className={OPTION_CLASS}
    >
      <OptionIcon d={icon} />
      {children}
    </a>
  );
}

/** Copy button, its result, and the hint about apps such as Instagram that take a pasted link. */
function CopyOption({ share }: { share: AppShareState }) {
  return (
    <div>
      <button type="button" onClick={share.copyLink} className={OPTION_CLASS}>
        <OptionIcon d={ICON.link} />
        リンクをコピー
      </button>
      <p className="mt-1 px-1 text-xs text-text-muted">Instagram などに貼り付けて使えます</p>
      {share.copyStatus === 'copied' && (
        <p role="status" className="mt-1 px-1 text-xs font-bold text-primary">コピーしました</p>
      )}
      {share.copyStatus === 'failed' && (
        <div role="status" className="mt-1 px-1 text-xs text-text-muted">
          <p className="font-bold text-red-600">コピーできませんでした</p>
          <p className="mt-1 select-all break-all text-text">{appShareUrl('copy')}</p>
        </div>
      )}
    </div>
  );
}

/** Dialog listing where to send the app's introduction. Render it outside .animate-page. */
export default function AppShareDialog({ share }: { share: AppShareState }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { closeDialog } = share;

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeDialog]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-share-title"
        className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto focus:outline-none"
      >
        <h2 id="app-share-title" className="text-base font-bold text-text">同僚に紹介する</h2>
        <div className="space-y-2">
          <OptionLink href={appShareMailto()} icon={ICON.mail} newTab={false} onClick={() => share.trackLink('email')}>
            メール
          </OptionLink>
          <OptionLink href={appShareLineUrl()} icon={ICON.chat} onClick={() => share.trackLink('line')}>
            LINE
          </OptionLink>
          <OptionLink href={appShareXUrl()} icon={ICON.post} onClick={() => share.trackLink('x')}>
            X
          </OptionLink>
          <CopyOption share={share} />
          {share.canShareOther && (
            <button type="button" onClick={share.shareOther} className={OPTION_CLASS}>
              <OptionIcon d={ICON.share} />
              その他のアプリ
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={closeDialog}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-text-muted border-2 border-line hover:border-primary hover:text-primary transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
