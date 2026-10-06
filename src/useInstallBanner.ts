import { useState } from 'react';
import { usePwaInstall } from './usePwaInstall';
import { trackEvent } from './analytics';

/** What the install banner does: show the browser's prompt or the iOS steps, hide itself, and record each step. */
export function useInstallBanner() {
  const { canShowBanner, method, dismiss, promptInstall } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  const install = async () => {
    trackEvent('pwa_install_banner_click', { method });
    if (method === 'prompt') {
      const outcome = await promptInstall();
      trackEvent('pwa_install_prompt_result', { outcome });
      if (outcome === 'accepted') dismiss();
    } else {
      setShowIosGuide(true);
    }
  };

  const dismissBanner = () => {
    trackEvent('pwa_install_banner_dismiss', { method });
    dismiss();
  };

  const closeIosGuide = () => setShowIosGuide(false);

  return { canShowBanner, showIosGuide, install, dismissBanner, closeIosGuide };
}
