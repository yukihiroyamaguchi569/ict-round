/** The existing Google Form for questions and requests about the app. */
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeW5eVVamKxZBNqy__NQAjRdaMeZBo8Y7Os4CpX5KhKIQsugA/viewform';

/** Form fields filled in beforehand; the IDs come from the form's pre-filled link. */
const VERSION_ENTRY = 'entry.999783493';
const DEVICE_ENTRY = 'entry.2044868744';

/** The form's device choices; each must match an option of the form exactly or the answer is left blank. */
export type FeedbackDevice = 'iPhone' | 'iPad' | 'Android' | 'パソコン' | 'その他';

/** Where the form was opened from; the feedback_open event's parameter. */
export type FeedbackSource = 'start' | 'report';

/**
 * Device kind from the User-Agent.
 * iPadOS Safari presents itself as a Mac by default, so a "Macintosh" with more than one touch point is an iPad.
 */
export function detectDevice(userAgent: string, maxTouchPoints: number): FeedbackDevice {
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Macintosh') && maxTouchPoints > 1) return 'iPad';
  // Checked before Linux, which Android's User-Agent also contains
  if (userAgent.includes('Android')) return 'Android';
  if (/Windows|Macintosh|CrOS|Linux/.test(userAgent)) return 'パソコン';
  return 'その他';
}

/**
 * The form's URL with the app version and the device filled in.
 * Only these two go into the URL, never round input data.
 */
export function feedbackFormUrl(version: string, device: FeedbackDevice): string {
  return `${FEEDBACK_FORM_URL}?usp=pp_url&${VERSION_ENTRY}=${encodeURIComponent(version)}&${DEVICE_ENTRY}=${encodeURIComponent(device)}`;
}

/** The form's URL for this app version on this browser's device. */
export function currentFeedbackFormUrl(): string {
  return feedbackFormUrl(__APP_VERSION__, detectDevice(navigator.userAgent, navigator.maxTouchPoints));
}
