import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_HOSTNAME } from '../analytics';

// The static pages are not bundled, so they repeat the production host instead of
// importing PRODUCTION_HOSTNAME. These checks run each copy of the snippet.
const ROOT = join(import.meta.dirname, '..', '..');
const SOURCES = ['public/about/index.html', 'public/updates/index.html', 'scripts/build-docs.mjs'];

const GUARD = 'location.hostname';
const TEST_ID = 'G-TEST123';

// The inline <script> that holds the host check. build-docs.mjs keeps it in a template
// literal, so its ${GA4_ID} placeholders are filled with a test ID.
function gtagInlineScript(text: string): string {
  const guard = text.indexOf(GUARD);
  const open = text.lastIndexOf('<script>', guard);
  const close = text.indexOf('</script>', guard);
  if (guard < 0 || open < 0 || close < 0) throw new Error('gtag inline script not found');
  return text.slice(open + '<script>'.length, close).replaceAll('${GA4_ID}', TEST_ID);
}

interface SandboxGlobals {
  appendedSrcs: string[];
  dataLayer?: unknown[];
  gtag?: unknown;
}

function runSnippet(code: string, hostname: string): SandboxGlobals {
  const appendedSrcs: string[] = [];
  const context = createContext({
    location: { hostname },
    document: {
      createElement: () => ({ async: false, src: '' }),
      head: { appendChild: (el: { src: string }) => appendedSrcs.push(el.src) },
    },
  });
  // Both scripts are fixed text or read from files in this repository, not external input.
  // eslint-disable-next-line sonarjs/code-eval -- makes window the sandbox global, as in a browser
  runInContext('var window = this;', context);
  // eslint-disable-next-line sonarjs/code-eval -- runs the repository's own gtag snippet
  runInContext(code, context);
  return {
    appendedSrcs,
    dataLayer: context.dataLayer as unknown[] | undefined,
    gtag: context.gtag,
  };
}

function commands(dataLayer: unknown[] | undefined): unknown[] {
  return (dataLayer ?? []).map((args) => Array.from(args as ArrayLike<unknown>)[0]);
}

describe.each(SOURCES)('gtag snippet in %s', (source) => {
  const text = readFileSync(join(ROOT, source), 'utf8');
  const code = gtagInlineScript(text);

  it('has no unconditional gtag.js script tag', () => {
    expect(text).not.toMatch(/<script[^>]*\bsrc=["'][^"']*googletagmanager/);
    expect(text.split('googletagmanager.com/gtag/js')).toHaveLength(2);
  });

  it('loads gtag.js and configures GA4 on the production host', () => {
    const result = runSnippet(code, PRODUCTION_HOSTNAME);

    expect(result.appendedSrcs).toEqual([
      `https://www.googletagmanager.com/gtag/js?id=${source.endsWith('.mjs') ? TEST_ID : 'G-YYCY51HV7R'}`,
    ]);
    expect(commands(result.dataLayer)).toEqual(['js', 'config']);
  });

  it.each([
    'feat-checklist-editor-79.ict-round-preview.pages.dev',
    'localhost',
    'yukihiroyamaguchi569.github.io',
    'ict-round.conect.llc.example.com',
    'evil-ict-round.conect.llc',
  ])('does nothing on %s', (hostname) => {
    const result = runSnippet(code, hostname);

    expect(result.appendedSrcs).toEqual([]);
    expect(result.dataLayer).toBeUndefined();
    expect(result.gtag).toBeUndefined();
  });
});
