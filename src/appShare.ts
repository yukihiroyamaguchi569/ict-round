/** Production About page. Fixed instead of location.origin so a preview deployment's URL is never handed out. */
const ABOUT_URL = 'https://ict-round.conect.llc/about/';

/** Where the introduction is sent; also the utm_medium and the app_share event's method. */
export type AppShareMethod = 'email' | 'line' | 'x' | 'copy' | 'share';

/** The introduction's wording, kept in one place for every destination. */
export const APP_SHARE_MESSAGE = {
  subject: '感染対策ラウンドアプリ「めぐる君」のご紹介',
  body: '院内の感染対策ラウンドの記録と報告書づくりができる無料のアプリです。登録は不要で、入力したデータは端末の中だけに保存されます。',
  short: '感染対策ラウンドの記録と報告書づくりができる無料のアプリ「めぐる君」',
} as const;

/** About page URL tagged with UTM parameters so visits from app shares can be told apart. */
export function appShareUrl(method: AppShareMethod): string {
  return `${ABOUT_URL}?utm_source=app_share&utm_medium=${method}`;
}

/** mailto: URL that opens a new mail with the introduction; the recipient is left empty. */
export function appShareMailto(): string {
  const subject = encodeURIComponent(APP_SHARE_MESSAGE.subject);
  // RFC 6068 asks for CRLF line breaks in a mailto body
  const body = encodeURIComponent(`${APP_SHARE_MESSAGE.body}\r\n${appShareUrl('email')}`);
  return `mailto:?subject=${subject}&body=${body}`;
}

/** LINE's share URL; LINE takes the message and the link as one text. */
export function appShareLineUrl(): string {
  const text = encodeURIComponent(`${APP_SHARE_MESSAGE.body}\n${appShareUrl('line')}`);
  return `https://line.me/R/share?text=${text}`;
}

/** X's post intent with the short introduction and the link. */
export function appShareXUrl(): string {
  const text = encodeURIComponent(APP_SHARE_MESSAGE.short);
  const url = encodeURIComponent(appShareUrl('x'));
  return `https://x.com/intent/post?text=${text}&url=${url}`;
}

/** Data for the OS share sheet ("other apps"). */
export function appShareData(): ShareData {
  return { title: APP_SHARE_MESSAGE.subject, text: APP_SHARE_MESSAGE.body, url: appShareUrl('share') };
}

/** True when the user closed the share sheet; nothing should happen then. */
export function isShareCancel(err: unknown): boolean {
  // Checked by name: browsers reject with a DOMException, which is not an Error subclass everywhere
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}
