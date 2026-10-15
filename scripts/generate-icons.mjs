// Renders build/icon.svg into the PNG sizes and the .icns container macOS needs,
// plus the menu-bar template images. Pure JavaScript: runs on any OS, no Xcode.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../build/', import.meta.url);
const render = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const icon = readFileSync(new URL('icon.svg', root), 'utf8');
writeFileSync(new URL('icon.png', root), render(icon, 1024));

// ICNS: an 8-byte header followed by typed chunks, each holding a PNG.
const chunks = [
  ['ic11', 32], // 16@2x
  ['ic12', 64], // 32@2x
  ['ic07', 128],
  ['ic13', 256], // 128@2x
  ['ic08', 256],
  ['ic14', 512], // 256@2x
  ['ic09', 512],
  ['ic10', 1024], // 512@2x
].map(([type, size]) => {
  const png = render(icon, size);
  const header = Buffer.alloc(8);
  header.write(type, 0, 'ascii');
  header.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([header, png]);
});
const body = Buffer.concat(chunks);
const head = Buffer.alloc(8);
head.write('icns', 0, 'ascii');
head.writeUInt32BE(body.length + 8, 4);
writeFileSync(new URL('icon.icns', root), Buffer.concat([head, body]));

const tray = readFileSync(new URL('trayTemplate.svg', root), 'utf8');
writeFileSync(new URL('trayTemplate.png', root), render(tray, 16));
writeFileSync(new URL('trayTemplate@2x.png', root), render(tray, 32));

console.info('Icons written to build/.');
