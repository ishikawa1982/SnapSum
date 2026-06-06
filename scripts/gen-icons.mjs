// 依存なしで PWA 用の単色アイコン PNG を生成する。
// ブランドカラーの角丸背景に "Σ" 風の十字を描くだけの簡易アイコン。
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const [br, bg, bb] = [0x25, 0x63, 0xeb]; // brand #2563eb
  const [wr, wg, wb] = [0xff, 0xff, 0xff];
  const radius = size * 0.18;

  // RGBA ピクセルを生成
  const stride = size * 4 + 1; // +1 はフィルタバイト
  const raw = Buffer.alloc(stride * size);
  const cx = size / 2;
  const cy = size / 2;
  const barW = size * 0.5;
  const barT = size * 0.09;

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = y * stride + 1 + x * 4;
      // 角丸の外は透明
      const inCorner =
        x < radius && y < radius
          ? Math.hypot(radius - x, radius - y) > radius
          : x > size - radius && y < radius
            ? Math.hypot(x - (size - radius), radius - y) > radius
            : x < radius && y > size - radius
              ? Math.hypot(radius - x, y - (size - radius)) > radius
              : x > size - radius && y > size - radius
                ? Math.hypot(x - (size - radius), y - (size - radius)) > radius
                : false;

      if (inCorner) {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
        continue;
      }

      // 簡易な "Σ" 風: 上下の横棒＋斜め線
      const nearTop = Math.abs(y - (cy - size * 0.22)) < barT && Math.abs(x - cx) < barW / 2;
      const nearBottom =
        Math.abs(y - (cy + size * 0.22)) < barT && Math.abs(x - cx) < barW / 2;
      const onDiag =
        x < cx &&
        Math.abs(y - cy - (x - (cx - barW / 2)) * (y < cy ? 1 : -1)) < barT * 1.1 &&
        Math.abs(y - cy) < size * 0.22;
      const isWhite = nearTop || nearBottom || onDiag;

      raw[i] = isWhite ? wr : br;
      raw[i + 1] = isWhite ? wg : bg;
      raw[i + 2] = isWhite ? wb : bb;
      raw[i + 3] = 255;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = makePng(size);
  const path = join(outDir, `pwa-${size}x${size}.png`);
  writeFileSync(path, png);
  console.log(`generated ${path} (${png.length} bytes)`);
}
