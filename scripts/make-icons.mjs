// Renders the app icon SVG to the PNG sizes iOS and the manifest need.
// Run with `npm run icons` after changing the artwork.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const BG = '#17130F';
const ACCENT = '#FF6A13';
const INK = '#1A0E05';

// Full-bleed square: iOS applies its own rounded mask.
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <circle cx="256" cy="256" r="176" fill="none" stroke="#3A2414" stroke-width="36"/>
  <circle cx="256" cy="256" r="176" fill="none" stroke="${ACCENT}" stroke-width="36" stroke-linecap="round"
    stroke-dasharray="${(2 * Math.PI * 176 * 0.72).toFixed(1)} 2000" transform="rotate(-90 256 256)"/>
  <circle cx="256" cy="262" r="124" fill="#9A3A08"/>
  <circle cx="256" cy="250" r="124" fill="${ACCENT}"/>
  <path d="M256 196v108M202 250h108" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>
</svg>`;

await mkdir('public', { recursive: true });
await writeFile('public/favicon.svg', svg(512).trim());
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  await sharp(Buffer.from(svg(size))).resize(size, size).flatten({ background: BG }).png().toFile(`public/${name}`);
  console.log(`public/${name}`);
}
