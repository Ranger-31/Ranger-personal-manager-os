/**
 * App icon / Splash 画像を生成する
 *   node scripts/generate-icons.mjs
 * デザイン：ディープグリーンの角丸スクエア + 進捗リング + チェック
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const ACCENT = "#1f7a5c";

// 1024 基準のマーク（背景なし）
const mark = (scale = 1) => {
  const cx = 512;
  const cy = 512;
  const r = 250 * scale;
  const sw = 64 * scale;
  const c = 2 * Math.PI * r;
  const arc = c * 0.78;
  return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="${sw}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff" stroke-width="${sw}"
    stroke-linecap="round" stroke-dasharray="${arc} ${c}" transform="rotate(-90 ${cx} ${cy})"/>
  <path d="M ${cx - 105 * scale} ${cy + 5 * scale} L ${cx - 25 * scale} ${cy + 85 * scale} L ${cx + 120 * scale} ${cy - 75 * scale}"
    fill="none" stroke="#ffffff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const iconSvg = ({ rounded, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="${rounded ? 228 : 0}" fill="${ACCENT}"/>
  ${mark(scale)}
</svg>`;

mkdirSync("public/icons", { recursive: true });
mkdirSync("public/splash", { recursive: true });

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

// 通常アイコン（Android等は角丸済みを使用）
writeFileSync("public/icons/icon-192.png", await png(iconSvg({ rounded: true, scale: 1 }), 192));
writeFileSync("public/icons/icon-512.png", await png(iconSvg({ rounded: true, scale: 1 }), 512));
// maskable：全面塗り + マークを安全領域内に縮小
writeFileSync(
  "public/icons/icon-maskable-512.png",
  await png(iconSvg({ rounded: false, scale: 0.78 }), 512),
);
// iOS ホーム画面用（iOSが角丸を付けるので全面塗り）
writeFileSync("app/apple-icon.png", await png(iconSvg({ rounded: false, scale: 1 }), 180));
// favicon 相当
writeFileSync("app/icon.png", await png(iconSvg({ rounded: true, scale: 1 }), 64));

// iOS Splash（白背景 + 中央アイコン）
const splashSizes = [
  [1170, 2532],
  [1179, 2556],
  [1290, 2796],
  [1125, 2436],
];
for (const [w, h] of splashSizes) {
  const iconSize = Math.round(w * 0.22);
  const icon = await png(iconSvg({ rounded: true, scale: 1 }), iconSize);
  const label = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="${w / 2}" y="${h / 2 + iconSize / 2 + w * 0.09}" text-anchor="middle"
      font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(w * 0.042)}" font-weight="600"
      letter-spacing="${w * 0.004}" fill="#14181f">PERSONAL MANAGER</text>
  </svg>`;
  const buf = await sharp({
    create: { width: w, height: h, channels: 4, background: "#ffffff" },
  })
    .composite([
      { input: icon, top: Math.round(h / 2 - iconSize / 2 - w * 0.04), left: Math.round(w / 2 - iconSize / 2) },
      { input: Buffer.from(label), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
  writeFileSync(`public/splash/splash-${w}x${h}.png`, buf);
}

console.log("icons & splash generated");
