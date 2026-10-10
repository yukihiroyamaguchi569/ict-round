import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_HOSTNAME } from '../analytics';

// The static pages are not bundled, so they repeat the production host instead of
// importing PRODUCTION_HOSTNAME. These checks keep the copies in line with it.
const ROOT = join(import.meta.dirname, '..', '..');
const SOURCES = ['public/about/index.html', 'public/updates/index.html', 'scripts/build-docs.mjs'];

const GUARD = `if (location.hostname === '${PRODUCTION_HOSTNAME}') {`;

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

// From the host check to the end of its <script> element.
function guardedBlock(text: string): string | null {
  const start = text.indexOf(GUARD);
  if (start < 0) return null;
  const end = text.indexOf('</script>', start);
  return end < 0 ? null : text.slice(start, end);
}

describe.each(SOURCES)('gtag snippet in %s', (source) => {
  const text = readFileSync(join(ROOT, source), 'utf8');

  it('has no unconditional gtag.js script tag', () => {
    expect(text).not.toMatch(/<script[^>]*\bsrc=["'][^"']*googletagmanager/);
  });

  it('loads gtag.js and configures GA4 only inside the production host check', () => {
    const block = guardedBlock(text);
    expect(block).not.toBeNull();
    const body = block ?? '';
    // The if block closes right before </script>, so nothing after it runs unguarded.
    expect(body.trimEnd().endsWith('}')).toBe(true);

    for (const needle of ['googletagmanager.com/gtag/js', "gtag('config'", "gtag('js'"]) {
      expect(countOf(body, needle)).toBe(1);
      expect(countOf(text, needle)).toBe(1);
    }
  });
});
