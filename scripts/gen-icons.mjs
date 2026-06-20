import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = 'C:/Users/AGrac/.cursor/projects/c-Users-AGrac-OneDrive-Desktop-OfflineQuest/assets/app-icon.png';
const OUT = 'public';

mkdirSync(OUT, { recursive: true });

const targets = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
];

for (const { name, size } of targets) {
  await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toFile(`${OUT}/${name}`);
  console.log(`✓ ${name}`);
}

// Maskable: add green padding so the icon survives circular masks
await sharp(SRC)
  .resize(410, 410, { fit: 'cover' })
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#166534' })
  .resize(512, 512)
  .png()
  .toFile(`${OUT}/pwa-maskable-512x512.png`);
console.log('✓ pwa-maskable-512x512.png');
