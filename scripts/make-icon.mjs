// Builds app/icon.ico from an inline SVG, rendered at several sizes so Windows picks a crisp one
// for the desktop, the taskbar and Alt+Tab. Run with `npm run icon` after changing the artwork.
//
// Entries are written as classic DIBs (BITMAPINFOHEADER + bottom-up BGRA + AND mask), not PNGs.
// Explorer reads PNG-compressed entries, but GDI's DrawIcon cannot, and a PNG-only .ico throws
// "Requested range extends past the end of the array" wherever GDI does the drawing.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

// Deliberately simple: a white page on the app's accent colour still reads at 16px.
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e08a63"/>
      <stop offset="1" stop-color="#c2542f"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="256" height="256" rx="56" fill="url(#bg)"/>
  <rect x="66" y="44" width="124" height="168" rx="12" fill="#ffffff"/>
  <rect x="88" y="74"  width="80" height="12" rx="6" fill="#c2542f"/>
  <rect x="88" y="104" width="62" height="9"  rx="4.5" fill="#9aa3b2"/>
  <rect x="88" y="126" width="80" height="9"  rx="4.5" fill="#9aa3b2"/>
  <rect x="88" y="148" width="70" height="9"  rx="4.5" fill="#9aa3b2"/>
  <circle cx="182" cy="186" r="38" fill="#ffffff"/>
  <circle cx="182" cy="186" r="31" fill="#3f9e5f"/>
  <path d="M168 186 l10 11 19 -22" fill="none" stroke="#ffffff"
        stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// RGBA top-down (canvas order) -> DIB: 40-byte header, bottom-up BGRA, then a 1bpp AND mask.
function toDib(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);          // biSize
  header.writeInt32LE(size, 4);         // biWidth
  header.writeInt32LE(size * 2, 8);     // biHeight: XOR image plus AND mask
  header.writeUInt16LE(1, 12);          // biPlanes
  header.writeUInt16LE(32, 14);         // biBitCount
  header.writeUInt32LE(0, 16);          // biCompression = BI_RGB

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size * 4; // flip vertically
    const dstRow = y * size * 4;
    for (let x = 0; x < size; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 4;
      xor[d] = rgba[s + 2];       // B
      xor[d + 1] = rgba[s + 1];   // G
      xor[d + 2] = rgba[s];       // R
      xor[d + 3] = rgba[s + 3];   // A
    }
  }
  header.writeUInt32LE(xor.length, 20); // biSizeImage

  // 32bpp icons key off the alpha channel, so the AND mask stays all-zero (fully opaque).
  const maskRow = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRow * size, 0);

  return Buffer.concat([header, xor, mask]);
}

function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);          // reserved
  header.writeUInt16LE(1, 2);          // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;

  images.forEach(({ size, buffer }, i) => {
    const at = 16 * i;
    entries.writeUInt8(size >= 256 ? 0 : size, at);      // 0 means 256
    entries.writeUInt8(size >= 256 ? 0 : size, at + 1);
    entries.writeUInt8(0, at + 2);                        // palette colours
    entries.writeUInt8(0, at + 3);                        // reserved
    entries.writeUInt16LE(1, at + 4);                     // colour planes
    entries.writeUInt16LE(32, at + 6);                    // bits per pixel
    entries.writeUInt32LE(buffer.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += buffer.length;
  });

  return Buffer.concat([header, entries, ...images.map((i) => i.buffer)]);
}

export async function makeIcon() {
  const browser = await chromium.launch();
  const images = [];
  try {
    const page = await browser.newPage();
    await page.setContent('<body style="margin:0"></body>', { waitUntil: 'load' });

    for (const size of SIZES) {
      // Rasterise in the page and read the pixels back, so no PNG decoder is needed here.
      const rgba = await page.evaluate(async ([svg, s]) => {
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        const img = new Image(s, s);
        img.src = url;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, s, s);
        ctx.drawImage(img, 0, 0, s, s);
        return Array.from(ctx.getImageData(0, 0, s, s).data);
      }, [SVG, size]);

      images.push({ size, buffer: toDib(Uint8Array.from(rgba), size) });
    }
  } finally {
    await browser.close();
  }

  await mkdir(path.join(root, 'app'), { recursive: true });
  const out = path.join(root, 'app', 'icon.ico');
  await writeFile(out, packIco(images));
  return { out, sizes: SIZES };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { out, sizes } = await makeIcon();
  console.log(`wrote ${path.relative(root, out)} (${sizes.join(', ')} px)`);
  process.exit(0);
}
