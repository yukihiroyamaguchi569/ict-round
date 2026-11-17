// Build-time flag for the stage 2 round screens of the all-department round.
// Only the preview build (Cloudflare Pages) sets VITE_FACILITY_ROUND=1; production (GitHub Pages) never does.
export function isRoundEnabled(): boolean {
  return import.meta.env.VITE_FACILITY_ROUND === '1';
}
