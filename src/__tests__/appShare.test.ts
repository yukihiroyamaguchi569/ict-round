import { describe, it, expect } from 'vitest';
import {
  APP_SHARE_MESSAGE,
  appShareData,
  appShareLineUrl,
  appShareMailto,
  appShareUrl,
  appShareXUrl,
  isShareCancel,
} from '../appShare';

const about = (medium: string) => `https://ict-round.conect.llc/about/?utm_source=app_share&utm_medium=${medium}`;

/** Splits a URL at its query, which must exist, and parses the query. */
function splitQuery(url: string) {
  const index = url.indexOf('?');
  expect(index).toBeGreaterThan(0);
  return { head: url.slice(0, index), params: new URLSearchParams(url.slice(index + 1)) };
}

describe('appShareUrl', () => {
  it.each(['email', 'line', 'x', 'copy', 'share'] as const)('points at the production About page tagged for %s', (method) => {
    expect(appShareUrl(method)).toBe(about(method));
  });
});

describe('appShareMailto', () => {
  it('opens a new mail with no recipient', () => {
    expect(splitQuery(appShareMailto()).head).toBe('mailto:');
  });

  it('decodes back to the subject and the body followed by the email-tagged URL', () => {
    const { params } = splitQuery(appShareMailto());
    expect([...params.keys()]).toEqual(['subject', 'body']);
    expect(params.get('subject')).toBe('感染対策ラウンドアプリ「めぐる君」のご紹介');
    expect(params.get('body')).toBe(`${APP_SHARE_MESSAGE.body}\r\n${about('email')}`);
  });

  it('percent-encodes the values so the URL inside the body does not split the parameters', () => {
    const url = appShareMailto();
    // Only the separators of the mailto query itself remain unencoded
    expect(url.match(/[?&=]/g)).toEqual(['?', '=', '&', '=']);
    expect(url).not.toMatch(/[\s「」]/);
    expect(url).toContain('%0D%0A');
  });
});

describe('appShareLineUrl', () => {
  it('passes the body and the line-tagged URL as one text to LINE', () => {
    const url = appShareLineUrl();
    const { head, params } = splitQuery(url);
    expect(head).toBe('https://line.me/R/share');
    expect([...params.keys()]).toEqual(['text']);
    expect(params.get('text')).toBe(`${APP_SHARE_MESSAGE.body}\n${about('line')}`);
    expect(url.match(/[?&=]/g)).toEqual(['?', '=']);
  });
});

describe('appShareXUrl', () => {
  it('passes the short text and the x-tagged URL as separate parameters to X', () => {
    const url = appShareXUrl();
    const { head, params } = splitQuery(url);
    expect(head).toBe('https://x.com/intent/post');
    expect([...params.keys()]).toEqual(['text', 'url']);
    expect(params.get('text')).toBe(APP_SHARE_MESSAGE.short);
    expect(params.get('url')).toBe(about('x'));
    expect(url.match(/[?&=]/g)).toEqual(['?', '=', '&', '=']);
  });

  it('keeps the short text short enough to post with the link', () => {
    expect(APP_SHARE_MESSAGE.short.length).toBeLessThanOrEqual(60);
  });
});

describe('appShareData', () => {
  it('passes the subject, the body and the share-tagged URL to the share sheet', () => {
    expect(appShareData()).toEqual({ title: APP_SHARE_MESSAGE.subject, text: APP_SHARE_MESSAGE.body, url: about('share') });
  });

  it('keeps the URL out of the text so the share sheet does not show it twice', () => {
    expect(appShareData().text).not.toContain('http');
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
