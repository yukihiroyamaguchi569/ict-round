// @vitest-environment-options {"url":"https://ict-round.conect.llc/"}
import { afterEach, describe, expect, it } from 'vitest';
import { gtagScripts, loadAnalytics, resetAnalyticsGlobals } from './analyticsInitHelpers';

describe('initAnalytics on the production host', () => {
  afterEach(resetAnalyticsGlobals);

  it('inserts gtag.js and configures GA4 without debug mode', async () => {
    expect(window.location.hostname).toBe('ict-round.conect.llc');
    const { initAnalytics } = await loadAnalytics(false);

    initAnalytics();

    expect(gtagScripts()).toHaveLength(1);
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ 0: 'config', 1: 'G-TEST123', 2: {} }),
    );
  });

  it('trackEvent sends events once initialized', async () => {
    const { initAnalytics, trackEvent } = await loadAnalytics(false);
    initAnalytics();

    trackEvent('round_start', { sample: false });

    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ 0: 'event', 1: 'round_start', 2: { sample: false } }),
    );
  });
});
