// Span's mark: the setup screen's picture (App/BrimApp.swift, Preview) made full bleed.
// The icon is the Duo's front screen: the page's banner runs under Safari's glass column, its text stops beside it.
// `bun logo/gen.ts` writes brand/logo/out/ and the app's icon set.
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { INK, SUN, font, png, word, xHeight } from "../lib.ts";

const here = import.meta.dirname;
const out = path.join(here, "out");
const appIcons = path.join(here, "../../App/Assets.xcassets/AppIcon.appiconset");

mkdirSync(out, { recursive: true });

const S = 1024;

const semibold = font("Geist-SemiBold.ttf");

interface Theme {
  readonly field: string;
  readonly line: string;
  readonly glass: string;
  readonly glassOpacity: number;
  readonly edge: string;
  readonly glyph: string;
  readonly shadow: number;
}

const themes = {
  light: {
    field: "#FFFFFF",
    line: "#D9D9DE",
    glass: "#F2F2F7",
    glassOpacity: 0.55,
    edge: "rgba(0,0,0,0.12)",
    glyph: "#1C1C1E",
    shadow: 0.16,
  },
  dark: {
    field: "#1C1C1E",
    line: "#3A3A3F",
    glass: "#FFFFFF",
    glassOpacity: 0.14,
    edge: "rgba(255,255,255,0.10)",
    glyph: "#FFFFFF",
    shadow: 0.4,
  },
} satisfies Record<string, Theme>;

interface Capsule {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const capsule = ({ x, y, w, h }: Capsule, attrs = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" ${attrs}/>`;

// Liquid Glass, flattened: the page frosted behind it, a light fill, a bright rim, a soft shadow.
const glass = (c: Capsule, t: Theme, page: string) =>
  `<defs>` +
  `<clipPath id="cap">${capsule(c)}</clipPath>` +
  `<filter id="frost" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="11"/></filter>` +
  `<filter id="lift" x="-50%" y="-20%" width="200%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#000" flood-opacity="${t.shadow}"/></filter>` +
  `<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.25"/><stop offset="1" stop-color="#fff" stop-opacity="0.7"/></linearGradient>` +
  `</defs>` +
  capsule(c, `fill="${t.field}" filter="url(#lift)"`) +
  `<g clip-path="url(#cap)"><g filter="url(#frost)">${page}</g>${capsule(c, `fill="${t.glass}" fill-opacity="${t.glassOpacity}"`)}</g>` +
  capsule(c, `fill="none" stroke="${t.edge}" stroke-width="3"`) +
  capsule({ x: c.x + 4, y: c.y + 4, w: c.w - 8, h: c.h - 8 }, `fill="none" stroke="url(#rim)" stroke-width="7"`);

// Safari's three column buttons as SF Symbols draws them: share, reader, tabs. 100-unit box.
const glyphs = {
  share: `<path d="M34 40 H26 Q20 40 20 46 V82 Q20 88 26 88 H74 Q80 88 80 82 V46 Q80 40 74 40 H66 M50 62 V10 M34 26 L50 10 L66 26"/>`,
  book: `<path d="M50 28 C40 20 24 18 12 22 V80 C24 76 40 78 50 86 C60 78 76 76 88 80 V22 C76 18 60 20 50 28 Z M50 28 V86"/>`,
  tabs: `<path d="M34 22 Q34 14 42 14 H80 Q88 14 88 22 V60 Q88 68 80 68"/><rect x="12" y="34" width="54" height="54" rx="9"/>`,
};

const glyph = (name: keyof typeof glyphs, cx: number, cy: number, size: number, color: string) =>
  `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${glyphs[name]}</g>`;

const icon = (t: Theme) => {
  const m = 104;
  // Wider than Safari's true 84 of 466 points, so the column and its buttons hold at 60pt.
  const col: Capsule = { x: S - 236 - 72, y: 132, w: 236, h: S - 264 };
  const stop = col.x - 44;
  const r = 56;
  const banner = `<path d="M ${S + 40} 196 H ${m + r} A ${r} ${r} 0 0 0 ${m} ${196 + r} V ${496 - r} A ${r} ${r} 0 0 0 ${m + r} 496 H ${S + 40} Z" fill="url(#sun)"/>`;

  const lines = [1, 0.8, 0.56]
    .map(
      (len, i) =>
        `<rect x="${m}" y="${584 + i * 104}" width="${(stop - m) * len}" height="60" rx="30" fill="${t.line}"/>`,
    )
    .join("");

  const page = `<rect width="${S}" height="${S}" fill="${t.field}"/>${banner}${lines}`;
  const cx = col.x + col.w / 2;

  const buttons = (["share", "book", "tabs"] as const)
    .map((g, i) => glyph(g, cx, col.y + col.h * ((i + 0.5) / 3), 112, t.glyph))
    .join("");

  const sun = `<linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SUN[0]}"/><stop offset="1" stop-color="${SUN[1]}"/></linearGradient>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${sun}</defs>${page}${glass(col, t, page)}${buttons}</svg>`;
};

// Embeds an icon in another SVG; each copy gets its own ids so filters and clips don't collide.
let n = 0;

const embed = (svg: string, x: number, y: number, size: number, outline: boolean) => {
  const id = `e${n++}`;

  const body = svg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")
    .replace(/id="(\w+)"/g, `id="${id}-$1"`)
    .replace(/url\(#(\w+)\)/g, `url(#${id}-$1)`);

  const rx = size * 0.2237;

  return (
    `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}"/></clipPath>` +
    `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}">${body}</svg></g>` +
    (outline
      ? `<rect x="${x + 0.5}" y="${y + 0.5}" width="${size - 1}" height="${size - 1}" rx="${rx}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="${Math.max(1, size / 180)}"/>`
      : "")
  );
};

// The wordmark: the app tile, then "span" in Geist SemiBold, the tile centered on the x-height.
const wordmark = (k: "light" | "dark") => {
  const size = 200;
  const text = word(semibold, "span", size, -30);
  const xh = xHeight(semibold, size);
  const tile = 176;
  const lead = tile + 52;
  const w = Math.ceil(lead + text.width);
  const pad = 40;

  const body =
    embed(icon(themes[k]), 0, -xh / 2 - tile / 2, tile, k === "light") +
    `<path transform="translate(${lead - text.x1} 0)" d="${text.d}" fill="${INK[k]}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2 * pad}" height="${tile + 2 * pad + 20}" viewBox="${-pad} ${-xh / 2 - tile / 2 - pad} ${w + 2 * pad} ${tile + 2 * pad + 20}">${body}</svg>`;
};

const f = (name: string) => path.join(out, name);

for (const k of ["light", "dark"] as const) {
  writeFileSync(f(`icon-${k}.svg`), icon(themes[k]));
  png(f(`icon-${k}.svg`), f(`icon-${k}-1024.png`));
  writeFileSync(f(`wordmark-${k}.svg`), wordmark(k));
  png(f(`wordmark-${k}.svg`), f(`wordmark-${k}.png`), 1200);
}

// iOS's tinted icon: a grayscale image the system tints.
execFileSync("magick", [f("icon-dark-1024.png"), "-colorspace", "gray", "-level", "8%,92%", f("icon-tinted-1024.png")]);

// App Store Connect rejects icons with an alpha channel.
for (const [from, to] of [
  ["light", "icon.png"],
  ["dark", "icon-dark.png"],
  ["tinted", "icon-tinted.png"],
] as const) {
  execFileSync("magick", [f(`icon-${from}-1024.png`), "-alpha", "off", path.join(appIcons, to)]);
}

console.log("logo: out/, App icon set");
