import type { ReactNode } from 'react';
import { currentFeedbackFormUrl, type FeedbackSource } from '../feedback';
import { trackEvent } from '../analytics';

/**
 * Link to the inquiry form, pre-filled with the app version and the device.
 * A new tab, so an unsaved round stays as it is.
 */
export default function FeedbackLink({ from, className, children }: { from: FeedbackSource; className: string; children: ReactNode }) {
  return (
    <a
      href={currentFeedbackFormUrl()}
      target="_blank"
      rel="noopener"
      onClick={() => trackEvent('feedback_open', { from })}
      className={className}
    >
      {children}
    </a>
  );
}
