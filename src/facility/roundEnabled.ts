// Build-time flag for the stage 2 round screens of the all-department round.
// Only the preview build (Cloudflare Pages) sets VITE_FACILITY_ROUND=1; production (GitHub Pages) never does.
// A constant, not a function: Vite replaces the expression at build time, so without the flag the
// bundler sees `false` and drops the round screens and the IndexedDB code from the production build.
export const ROUND_ENABLED = import.meta.env.VITE_FACILITY_ROUND === '1';
