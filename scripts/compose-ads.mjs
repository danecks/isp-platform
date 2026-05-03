import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const LOGO_PATH = "artifacts/isp-web/public/images/logo-isp.png";
const OUT_DIR = "attached_assets/anuncios";

const PUESTOS = [
  { slug: "jefe-servicio", titulo: "JEFE DE SERVICIO" },
  { slug: "supervisor", titulo: "SUPERVISORES" },
  { slug: "agente", titulo: "AGENTES DE SEGURIDAD" },
];

const BRAND_NAVY = "#0a1f3d";
const BRAND_GOLD = "#d4a72c";
const BRAND_WHITE = "#ffffff";

let logoTrimmedCache = null;
async function getLogo(targetWidth) {
  if (!logoTrimmedCache) {
    logoTrimmedCache = await sharp(LOGO_PATH).trim({ threshold: 25 }).png().toBuffer();
  }
  return sharp(logoTrimmedCache).resize({ width: targetWidth }).png().toBuffer();
}

function escapeXml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function buildSvg({ W, H, titulo, isVertical, logoBottomY }) {
  const topBandH = isVertical ? Math.round(H * 0.42) : Math.round(H * 0.42);
  const ctaBandH = isVertical ? Math.round(H * 0.32) : Math.round(H * 0.32);

  const buscamosSize = isVertical ? 88 : 60;
  const tituloSize = isVertical
    ? (titulo.length > 18 ? 78 : 110)
    : (titulo.length > 18 ? 56 : 78);

  const buscamosY = logoBottomY + (isVertical ? 90 : 70);
  const tituloY = buscamosY + (isVertical ? 110 : 80);

  const ctaTop = H - ctaBandH;
  const ctaApplyY = ctaTop + (isVertical ? 110 : 80);
  const ctaUrlY = ctaApplyY + (isVertical ? 100 : 78);
  const ctaWaY = H - (isVertical ? 130 : 80);

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRAND_NAVY}" stop-opacity="1"/>
      <stop offset="0.7" stop-color="${BRAND_NAVY}" stop-opacity="1"/>
      <stop offset="1" stop-color="${BRAND_NAVY}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="botFade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${BRAND_NAVY}" stop-opacity="1"/>
      <stop offset="0.7" stop-color="${BRAND_NAVY}" stop-opacity="1"/>
      <stop offset="1" stop-color="${BRAND_NAVY}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${W}" height="${topBandH}" fill="url(#topFade)"/>
  <rect x="0" y="${ctaTop}" width="${W}" height="${ctaBandH}" fill="url(#botFade)"/>

  <text x="${W/2}" y="${buscamosY}" font-family="DejaVu Sans, Arial Black, sans-serif" font-weight="900"
        font-size="${buscamosSize}" fill="${BRAND_WHITE}" text-anchor="middle" letter-spacing="3">BUSCAMOS</text>
  <text x="${W/2}" y="${tituloY}" font-family="DejaVu Sans, Arial Black, sans-serif" font-weight="900"
        font-size="${tituloSize}" fill="${BRAND_GOLD}" text-anchor="middle" letter-spacing="3">${escapeXml(titulo)}</text>

  <rect x="${W*0.1}" y="${ctaTop + 30}" width="${W*0.8}" height="6" fill="${BRAND_GOLD}"/>
  <text x="${W/2}" y="${ctaApplyY}" font-family="DejaVu Sans, sans-serif" font-weight="700"
        font-size="${isVertical ? 52 : 40}" fill="${BRAND_WHITE}" text-anchor="middle" letter-spacing="2">APLICA HOY MISMO</text>
  <text x="${W/2}" y="${ctaUrlY}" font-family="DejaVu Sans, sans-serif" font-weight="900"
        font-size="${isVertical ? 70 : 56}" fill="${BRAND_GOLD}" text-anchor="middle">ispsa.net/kiosco</text>
  <text x="${W/2}" y="${ctaWaY}" font-family="DejaVu Sans, sans-serif" font-weight="700"
        font-size="${isVertical ? 52 : 40}" fill="${BRAND_WHITE}" text-anchor="middle">WhatsApp 5298-5987</text>
</svg>`.trim();
}

async function compose({ bgPath, outPath, isVertical, titulo }) {
  const W = 1080;
  const H = isVertical ? 1920 : 1080;

  const bg = await sharp(bgPath).resize(W, H, { fit: "cover", position: "center" }).toBuffer();

  const logoWidth = isVertical ? 460 : 340;
  const logo = await getLogo(logoWidth);
  const logoMeta = await sharp(logo).metadata();
  const logoX = Math.round((W - logoMeta.width) / 2);
  const logoY = isVertical ? 90 : 60;
  const logoBottomY = logoY + logoMeta.height;

  const svg = buildSvg({ W, H, titulo, isVertical, logoBottomY });

  await sharp(bg)
    .composite([
      { input: Buffer.from(svg), top: 0, left: 0 },
      { input: logo, top: logoY, left: logoX, blend: "screen" },
    ])
    .png({ quality: 92 })
    .toFile(outPath);

  console.log(`OK ${outPath}`);
}

await mkdir(OUT_DIR, { recursive: true });

for (const p of PUESTOS) {
  await compose({
    bgPath: `${OUT_DIR}/bg-${p.slug}-cuadrado.png`,
    outPath: `${OUT_DIR}/final-${p.slug}-cuadrado.png`,
    isVertical: false,
    titulo: p.titulo,
  });
  await compose({
    bgPath: `${OUT_DIR}/bg-${p.slug}-vertical.png`,
    outPath: `${OUT_DIR}/final-${p.slug}-vertical.png`,
    isVertical: true,
    titulo: p.titulo,
  });
}

console.log("DONE");
