import { afterEach, describe, expect, it } from 'vitest';
import { gtagScripts, loadAnalytics, resetAnalyticsGlobals } from './analyticsInitHelpers';

// jsdom's default URL is http://localhost:3000/, i.e. not the production host.
describe('initAnalytics outside the production host', () => {
  afterEach(resetAnalyticsGlobals);

  it('does not insert gtag.js or define gtag in a production build', async () => {
    expect(window.location.hostname).toBe('localhost');
    const { initAnalytics } = await loadAnalytics(false);

    initAnalytics();

    expect(gtagScripts()).toHaveLength(0);
    expect(typeof window.gtag).toBe('undefined');
    expect(window.dataLayer).toBeUndefined();
    expect(localStorage.getItem('pwa_install_tracked')).toBeNull();
  });

  it('trackEvent stays a no-op when GA4 was not initialized', async () => {
    const { initAnalytics, trackEvent } = await loadAnalytics(false);
    initAnalytics();

    expect(() => trackEvent('round_start')).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });

  it('still loads gtag.js on the dev server (npm run dev)', async () => {
    const { initAnalytics } = await loadAnalytics(true);

    initAnalytics();

    expect(gtagScripts()).toHaveLength(1);
    expect(gtagScripts()[0].src).toContain('id=G-TEST123');
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ 0: 'config', 1: 'G-TEST123', 2: { debug_mode: true } }),
    );
  });
});
