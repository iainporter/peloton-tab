#!/usr/bin/env node
/**
 * Generate PWA icon sizes from icon-512.png and a maskable variant from icon.svg.
 * Usage: node scripts/generate-icons.mjs
 * Requires: sharp (npm install --save-dev sharp)
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

const sizes = [72, 96, 128, 144, 152, 384];

async function main() {
  const src = join(iconsDir, "icon-512.png");

  // Generate standard icon sizes from 512px PNG
  for (const size of sizes) {
    await sharp(src)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-${size}.png`));
    console.log(`Created icon-${size}.png`);
  }

  // Generate maskable icon (with safe-zone padding) from SVG
  // Maskable icons need content within the safe zone (inner 80%)
  // We render the SVG at 512px then place it within a larger padded canvas
  const svgPath = join(iconsDir, "icon.svg");
  const innerSize = Math.round(512 * 0.8); // 80% safe zone
  const padding = Math.round((512 - innerSize) / 2);

  const svgBuffer = await sharp(svgPath)
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 249, g: 115, b: 22, alpha: 1 }, // #f97316
    },
  })
    .composite([{ input: svgBuffer, left: padding, top: padding }])
    .png()
    .toFile(join(iconsDir, "icon-maskable-512.png"));

  console.log("Created icon-maskable-512.png");

  // Also create 192px maskable
  await sharp(join(iconsDir, "icon-maskable-512.png"))
    .resize(192, 192)
    .png()
    .toFile(join(iconsDir, "icon-maskable-192.png"));

  console.log("Created icon-maskable-192.png");

  console.log("Done!");
}

main().catch(console.error);
