import { vi } from 'vitest';

const GTAG_SRC_PATTERN = /googletagmanager\.com\/gtag\/js/;

export function gtagScripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll('script')).filter((s) =>
    GTAG_SRC_PATTERN.test(s.src),
  );
}

// MEASUREMENT_ID is read at module load, so re-import after stubbing the env.
export async function loadAnalytics(isDev: boolean) {
  vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123');
  vi.stubEnv('DEV', isDev);
  vi.resetModules();
  return import('../../analytics');
}

export function resetAnalyticsGlobals(): void {
  vi.unstubAllEnvs();
  for (const s of gtagScripts()) s.remove();
  Reflect.deleteProperty(window, 'gtag');
  Reflect.deleteProperty(window, 'dataLayer');
  localStorage.clear();
}
