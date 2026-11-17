// Fails when a production build (VITE_FACILITY_ROUND unset) contains the preview-only round screens.
// The round code stores data in IndexedDB, which the public docs say production does not use.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
const PREVIEW_ONLY_MARKERS = ['icn-round-facility', 'ラウンドを始める'];

if (process.env.VITE_FACILITY_ROUND === '1') {
  console.log('check-production-build: skipped (preview build)');
  process.exit(0);
}

const hits = readdirSync(ASSETS_DIR)
  .filter((name) => name.endsWith('.js'))
  .flatMap((name) => {
    const text = readFileSync(join(ASSETS_DIR, name), 'utf8');
    return PREVIEW_ONLY_MARKERS.filter((marker) => text.includes(marker)).map((marker) => `${name}: ${marker}`);
  });

if (hits.length > 0) {
  console.error('check-production-build: preview-only code found in the production build:');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('check-production-build: ok');
