/** Production About page. Fixed instead of location.origin so a preview deployment's URL is never handed out. */
const ABOUT_URL = 'https://ict-round.conect.llc/about/';

export type AppShareMedium = 'share' | 'email';

export const APP_SHARE_TITLE = '感染対策ラウンドアプリ「めぐる君」のご紹介';
export const APP_SHARE_TEXT =
  '院内の感染対策ラウンドの記録と報告書づくりができる無料のアプリです。登録は不要で、入力したデータは端末の中だけに保存されます。';

/** About page URL tagged with UTM parameters so visits from app shares can be told apart. */
export function appShareUrl(medium: AppShareMedium): string {
  return `${ABOUT_URL}?utm_source=app_share&utm_medium=${medium}`;
}

/** Data for the OS share sheet. */
export function appShareData(): ShareData {
  return { title: APP_SHARE_TITLE, text: APP_SHARE_TEXT, url: appShareUrl('share') };
}

/** mailto: URL that opens a new mail with the introduction; the recipient is left empty. */
export function appShareMailto(): string {
  const subject = encodeURIComponent(APP_SHARE_TITLE);
  // RFC 6068 asks for CRLF line breaks in a mailto body
  const body = encodeURIComponent(`${APP_SHARE_TEXT}\r\n${appShareUrl('email')}`);
  return `mailto:?subject=${subject}&body=${body}`;
}

/** True when the user closed the share sheet; nothing should happen then. */
export function isShareCancel(err: unknown): boolean {
  // Checked by name: browsers reject with a DOMException, which is not an Error subclass everywhere
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}

/** Navigates to the mail draft. Kept here as the boundary tests replace. */
export function openMailDraft(url: string): void {
  window.location.href = url;
}
