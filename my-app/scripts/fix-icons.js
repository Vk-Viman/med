// Pads non-square icons to square canvas without scaling using sharp
// Usage: node scripts/fix-icons.js
const fs = require('fs');
const path = require('path');

async function ensureSharp() {
  try {
    require.resolve('sharp');
    return require('sharp');
  } catch (e) {
    console.error('\nDependency "sharp" is not installed. Install it first:');
    console.error('  npm i --save-dev sharp');
    process.exit(1);
  }
}

async function padToSquare(inputPath) {
  const sharp = await ensureSharp();
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const { width, height } = meta;
  if (!width || !height) throw new Error(`Cannot read dimensions for ${inputPath}`);
  if (width === height) {
    console.log(`Already square: ${path.basename(inputPath)} (${width}x${height})`);
    return;
  }
  const size = Math.max(width, height);
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  const out = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: inputPath, left, top }])
    .png()
    .toBuffer();
  await fs.promises.writeFile(inputPath, out);
  console.log(`Padded to ${size}x${size}: ${path.basename(inputPath)}`);
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const files = [
    path.join(projectRoot, 'assets', 'icon.png'),
    path.join(projectRoot, 'assets', 'adaptive-icon.png'),
  ];
  for (const f of files) {
    if (fs.existsSync(f)) {
      try { await padToSquare(f); } catch (e) { console.error('Failed for', f, e.message); process.exitCode = 1; }
    } else {
      console.warn('Missing file:', f);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
