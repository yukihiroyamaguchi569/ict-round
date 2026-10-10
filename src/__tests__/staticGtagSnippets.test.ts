import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_HOSTNAME } from '../analytics';

// The static pages are not bundled, so they repeat the production host instead of
// importing PRODUCTION_HOSTNAME. These checks keep the copies in line with it.
const ROOT = join(import.meta.dirname, '..', '..');
const SOURCES = ['public/about/index.html', 'public/updates/index.html', 'scripts/build-docs.mjs'];

const GUARD = /if \(location\.hostname === '([^']*)'\) \{([\s\S]*?)\n\s*\}\n\s*<\/script>/;

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe.each(SOURCES)('gtag snippet in %s', (source) => {
  const text = readFileSync(join(ROOT, source), 'utf8');

  it('has no unconditional gtag.js script tag', () => {
    expect(text).not.toMatch(/<script[^>]*\bsrc=["'][^"']*googletagmanager/);
  });

  it('loads gtag.js and configures GA4 only inside the production host check', () => {
    const match = GUARD.exec(text);
    expect(match).not.toBeNull();
    const [, host, body] = match ?? [];
    expect(host).toBe(PRODUCTION_HOSTNAME);

    for (const needle of ['googletagmanager.com/gtag/js', "gtag('config'", "gtag('js'"]) {
      expect(countOf(body, needle)).toBe(1);
      expect(countOf(text, needle)).toBe(1);
    }
  });
});
