import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Las imágenes de marca se generan desde SVG; no incluyen datos de inventario.
const icon = await readFile('app/icon.svg');
const mark = icon
  .toString('utf8')
  .replace(/<svg\b[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="202" height="64" viewBox="0 0 202 64" role="img" aria-labelledby="title">
  <title id="title">Goliat</title>
  ${mark}
  <text x="78" y="46" fill="#005a9e" font-family="Arial, sans-serif" font-size="42" font-weight="600" letter-spacing="-1.2">Goliat</text>
</svg>`;
await writeFile('src/assets/goliat-logo.svg', logo);
await sharp(icon)
  .resize(180, 180)
  .flatten({ background: '#ffffff' })
  .png()
  .toFile('app/apple-icon.png');
const png = await sharp(icon).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile('app/favicon.ico', Buffer.concat([header, png]));

const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1730" height="909" viewBox="0 0 1730 909">
  <rect width="1730" height="909" fill="#ffffff"/>
  <path d="M1100 0H1730V909H1380L1030 560Z" fill="#16324f"/>
  <circle cx="1490" cy="165" r="240" fill="#005a9e"/>
  <circle cx="1690" cy="880" r="330" fill="#005a9e"/>
  <g transform="translate(110 122) scale(1.84375)">${mark}</g>
  <g font-family="Arial, sans-serif">
    <text x="110" y="423" fill="#005a9e" font-size="130" font-weight="600" letter-spacing="-4">Goliat</text>
    <text x="117" y="506" fill="#0078d4" font-size="54" font-weight="700">Cloud Inventory</text>
    <text x="117" y="607" fill="#526779" font-size="30">Resources. Subscriptions. Clarity.</text>
    <rect x="115" y="687" width="306" height="64" rx="16" fill="#edf6ff"/>
    <text x="144" y="730" fill="#005a9e" font-size="30" font-weight="700">Microsoft Azure</text>
  </g>
  <g fill="none" stroke="#9bd8ff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1207 469h281a77 77 0 0 0 0-154 111 111 0 0 0-213-39 64 64 0 0 0-68 193Z"/>
    <path d="M1350 469v71m-170 0h340m-340 0v59m170-59v59m170-59v59"/>
    <rect x="1128" y="599" width="104" height="106" rx="22"/>
    <rect x="1298" y="599" width="104" height="106" rx="22"/>
    <rect x="1468" y="599" width="104" height="106" rx="22"/>
    <path d="M1154 631h52m-52 27h34m138-14 24-18 24 18-24 18Z"/>
    <ellipse cx="1520" cy="635" rx="27" ry="11"/>
    <path d="M1493 635v33c0 15 54 15 54 0v-33"/>
  </g>
  <circle cx="1350" cy="375" r="15" fill="#50b4f2"/>
</svg>`;
await mkdir('public/social', { recursive: true });
await writeFile('public/social/goliat-cloud-inventory.svg', cover);
await sharp(Buffer.from(cover)).png().toFile('public/social/cloud-inventory.png');
console.log('Logo, favicon, icono Apple y portada generados.');
