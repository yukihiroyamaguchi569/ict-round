import { describe, it, expect } from 'vitest';
import { detectDevice, feedbackFormUrl } from '../feedback';

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeW5eVVamKxZBNqy__NQAjRdaMeZBo8Y7Os4CpX5KhKIQsugA/viewform';

const UA = {
  iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iPadLegacy: 'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ Safari asks for the desktop site by default and sends a Mac User-Agent
  macLike: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
} as const;

/** Splits a URL at its query, which must exist, and parses the query. */
function splitQuery(url: string) {
  const index = url.indexOf('?');
  expect(index).toBeGreaterThan(0);
  return { head: url.slice(0, index), params: new URLSearchParams(url.slice(index + 1)) };
}

describe('detectDevice', () => {
  it('tells an iPhone', () => {
    expect(detectDevice(UA.iPhone, 5)).toBe('iPhone');
  });

  it('tells an iPad that names itself', () => {
    expect(detectDevice(UA.iPadLegacy, 5)).toBe('iPad');
  });

  it('tells an iPad that presents itself as a Mac by its touch points', () => {
    expect(detectDevice(UA.macLike, 5)).toBe('iPad');
  });

  it('keeps a Mac with one touch point a computer (the boundary of the iPad check)', () => {
    expect(detectDevice(UA.macLike, 1)).toBe('パソコン');
  });

  it('keeps a Mac without touch a computer', () => {
    expect(detectDevice(UA.macLike, 0)).toBe('パソコン');
  });

  it.each([
    ['phone', UA.androidPhone],
    ['tablet', UA.androidTablet],
  ])('tells an Android %s despite the Linux in its User-Agent', (_kind, ua) => {
    expect(detectDevice(ua, 5)).toBe('Android');
  });

  it.each([
    ['Windows', UA.windows, 0],
    ['Windows with a touch screen', UA.windows, 10],
    ['Chromebook', UA.chromebook, 0],
    ['Linux', UA.linux, 0],
  ])('counts %s as a computer', (_kind, ua, touch) => {
    expect(detectDevice(ua, touch)).toBe('パソコン');
  });

  it.each([
    ['an empty User-Agent', ''],
    ['an unknown User-Agent', 'SomeBot/1.0'],
    ['an iPod', 'Mozilla/5.0 (iPod touch; CPU OS 15_0 like Mac OS X)'],
  ])('answers その他 for %s', (_kind, ua) => {
    expect(detectDevice(ua, 0)).toBe('その他');
  });
});

describe('feedbackFormUrl', () => {
  it('opens the form pre-filled with the version and the device', () => {
    const { head, params } = splitQuery(feedbackFormUrl('1.19.0', 'iPhone'));
    expect(head).toBe(FORM);
    expect([...params.keys()]).toEqual(['usp', 'entry.999783493', 'entry.2044868744']);
    expect(params.get('usp')).toBe('pp_url');
    expect(params.get('entry.999783493')).toBe('1.19.0');
    expect(params.get('entry.2044868744')).toBe('iPhone');
  });

  it('percent-encodes the Japanese device choice', () => {
    expect(feedbackFormUrl('1.19.0', 'パソコン')).toBe(
      `${FORM}?usp=pp_url&entry.999783493=1.19.0&entry.2044868744=%E3%83%91%E3%82%BD%E3%82%B3%E3%83%B3`,
    );
  });

  it('encodes characters of the version that would break the query', () => {
    const { params } = splitQuery(feedbackFormUrl('1.0.0+a&b=c', 'その他'));
    expect(params.get('entry.999783493')).toBe('1.0.0+a&b=c');
    expect(params.get('entry.2044868744')).toBe('その他');
    expect([...params.keys()]).toHaveLength(3);
  });
});
