import { describe, it, expect } from 'vitest';
import { APP_SHARE_TEXT, APP_SHARE_TITLE, appShareData, appShareMailto, appShareUrl, isShareCancel } from '../appShare';

describe('appShareUrl', () => {
  it.each([
    ['share', 'https://ict-round.conect.llc/about/?utm_source=app_share&utm_medium=share'],
    ['email', 'https://ict-round.conect.llc/about/?utm_source=app_share&utm_medium=email'],
  ] as const)('points at the production About page tagged for %s', (medium, expected) => {
    expect(appShareUrl(medium)).toBe(expected);
  });
});

describe('appShareData', () => {
  it('passes the title, the text and the share-tagged URL to the share sheet', () => {
    expect(appShareData()).toEqual({
      title: APP_SHARE_TITLE,
      text: APP_SHARE_TEXT,
      url: 'https://ict-round.conect.llc/about/?utm_source=app_share&utm_medium=share',
    });
  });

  it('keeps the URL out of the text so the share sheet does not show it twice', () => {
    expect(appShareData().text).not.toContain('http');
  });
});

describe('appShareMailto', () => {
  const parse = () => {
    const url = appShareMailto();
    const [head, query] = url.split('?');
    return { url, head, params: new URLSearchParams(query) };
  };

  it('opens a new mail with no recipient', () => {
    expect(parse().head).toBe('mailto:');
  });

  it('decodes back to the subject and the text followed by the email-tagged URL', () => {
    const { params } = parse();
    expect(params.get('subject')).toBe('感染対策ラウンドアプリ「めぐる君」のご紹介');
    expect(params.get('body')).toBe(
      `${APP_SHARE_TEXT}\r\nhttps://ict-round.conect.llc/about/?utm_source=app_share&utm_medium=email`,
    );
  });

  it('percent-encodes the query so the URL inside the body does not split the parameters', () => {
    const { url } = parse();
    // Only the two separators of the mailto query itself remain unencoded
    expect(url.match(/[?&=]/g)).toEqual(['?', '=', '&', '=']);
    expect(url).not.toMatch(/[\s「」]/);
    expect(url).toContain('%0D%0A');
  });
});

describe('isShareCancel', () => {
  it('treats an AbortError as the user closing the share sheet', () => {
    expect(isShareCancel(new DOMException('Share canceled', 'AbortError'))).toBe(true);
  });

  it.each([
    ['NotAllowedError', new DOMException('no activation', 'NotAllowedError')],
    ['InvalidStateError', new DOMException('busy', 'InvalidStateError')],
    ['TypeError', new TypeError('bad data')],
    ['a string', 'AbortError'],
    ['null', null],
    ['undefined', undefined],
  ])('does not treat %s as a cancel', (_, err) => {
    expect(isShareCancel(err)).toBe(false);
  });
});
