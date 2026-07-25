const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
const INSTALL_TRACKED_KEY = 'pwa_install_tracked';

declare global {
  interface Navigator {
    standalone?: boolean;
  }
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function initAnalytics(): void {
  if (!MEASUREMENT_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params -- gtag.jsは配列でなくargumentsオブジェクトを要求する
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());

  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  // インストール版(PWA)とブラウザ版の利用比率を分析するためのユーザープロパティ
  window.gtag('set', 'user_properties', {
    display_mode: isStandalone ? 'standalone' : 'browser',
  });

  // PWAウィンドウではChrome拡張のデバッグモードが効かないため、
  // 開発時のみコード側から GA4 の DebugView を有効にする
  window.gtag('config', MEASUREMENT_ID, import.meta.env.DEV ? { debug_mode: true } : {});

  // iOS Safari: appinstalled イベントが発火しないため、
  // スタンドアロンモードで初回起動したときにインストールとして計測する
  if (isStandalone && !localStorage.getItem(INSTALL_TRACKED_KEY)) {
    localStorage.setItem(INSTALL_TRACKED_KEY, '1');
    trackEvent('pwa_install', { method: 'standalone_first_launch' });
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!MEASUREMENT_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

// Android/Desktop Chrome: インストール時に appinstalled が発火する
// iOS と二重計測しないよう localStorage フラグで制御
export function trackInstallEvent(): void {
  if (localStorage.getItem(INSTALL_TRACKED_KEY)) return;
  localStorage.setItem(INSTALL_TRACKED_KEY, '1');
  trackEvent('pwa_install', { method: 'appinstalled' });
}
