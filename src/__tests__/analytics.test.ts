import { describe, expect, it } from 'vitest';
import { PRODUCTION_HOSTNAME, shouldLoadAnalytics } from '../analytics';

describe('shouldLoadAnalytics', () => {
  it('loads on the production host', () => {
    expect(PRODUCTION_HOSTNAME).toBe('ict-round.conect.llc');
    expect(shouldLoadAnalytics('ict-round.conect.llc', false)).toBe(true);
  });

  it.each([
    ['a Cloudflare Pages preview', 'feat-checklist-editor-79.ict-round-preview.pages.dev'],
    ['the preview project root', 'ict-round-preview.pages.dev'],
    ['localhost (npm run preview / E2E)', 'localhost'],
    ['127.0.0.1', '127.0.0.1'],
    ['GitHub Pages (redirected to production)', 'yukihiroyamaguchi569.github.io'],
    ['a lookalike with a suffix', 'ict-round.conect.llc.example.com'],
    ['a lookalike with a prefix', 'evil-ict-round.conect.llc'],
    ['a subdomain of production', 'www.ict-round.conect.llc'],
    ['an uppercase variant', 'ICT-ROUND.CONECT.LLC'],
    ['the parent domain', 'conect.llc'],
    ['an empty hostname (file://)', ''],
  ])('does not load on %s', (_label, hostname) => {
    expect(shouldLoadAnalytics(hostname, false)).toBe(false);
  });

  it('loads on any host during development (npm run dev)', () => {
    expect(shouldLoadAnalytics('localhost', true)).toBe(true);
    expect(shouldLoadAnalytics('ict-round-preview.pages.dev', true)).toBe(true);
  });
});
