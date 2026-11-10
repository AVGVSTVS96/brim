// App Store screenshots: a few words over a real Duo capture, in every size the listing takes.
// `bun store/gen.ts` writes brand/store/out/<size>/NN-<name>.png.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { INK, SUN, font, png, word } from "../lib.ts";

const here = import.meta.dirname;
const semibold = font("Geist-SemiBold.ttf");
const medium = font("Geist-Medium.ttf");

// Captures from the Duo simulator's front screen: 466 × 678 points at 3x.
const CW = 1398;
const CH = 2034;

// Display types App Store Connect takes for an iPhone app, and their sizes.
const sizes = {
  duo: { w: 1398, h: 2034, type: "APP_IPHONE_DUO" },
  "iphone-6.9": { w: 1320, h: 2868, type: "APP_IPHONE_67" },
  "iphone-6.3": { w: 1206, h: 2622, type: "APP_IPHONE_61" },
} as const;

interface Capture {
  readonly file: string;
  // Rows to skip at the top: some captures carry Safari's own one-time prompt there.
  readonly top?: number;
}

type Shot =
  | { readonly name: string; readonly title: string; readonly capture: Capture }
  | { readonly name: string; readonly title: string; readonly pair: readonly [Capture, Capture] };

const shots: Shot[] = [
  { name: "whole-screen", title: "The whole screen.", pair: [{ file: "cal-safari.png" }, { file: "cal.png" }] },
  { name: "edge-to-edge", title: "Edge to edge.", capture: { file: "cal.png" } },
  { name: "hard-sites", title: "Hard sites too.", capture: { file: "amazon.png", top: 474 } },
  { name: "text", title: "Text stays clear.", capture: { file: "github.png" } },
  { name: "pop-ups", title: "Pop-ups fit.", capture: { file: "x.png" } },
  { name: "maps", title: "Maps go wide.", capture: { file: "openstreetmap.png" } },
];

const data = (file: string) =>
  `data:image/png;base64,${readFileSync(path.join(here, "captures", file)).toString("base64")}`;

const PAGE = "#F4F4F6";
const GRAY = "#8E8E93";

let n = 0;

// A capture in a window with the Duo's rounded corners, scaled to width w.
const screen = (c: Capture, x: number, y: number, w: number) => {
  const id = `w${n++}`;
  const top = c.top ?? 0;
  const s = w / CW;
  const h = (CH - top) * s;
  const r = w * 0.07;

  return {
    h,
    svg:
      `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
      `<filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${w * 0.02}" stdDeviation="${w * 0.03}" flood-color="#000" flood-opacity="0.12"/></filter></defs>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#000" filter="url(#${id}s)"/>` +
      `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 ${top} ${CW} ${CH - top}" preserveAspectRatio="none"><image href="${data(c.file)}" width="${CW}" height="${CH}"/></svg></g>` +
      `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${r}" fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>`,
  };
};

const text = (f: typeof semibold, s: string, size: number, x: number, y: number, fill: string, tracking = 0) => {
  const t = word(f, s, size, tracking);

  return { svg: `<path transform="translate(${x - t.x1} ${y})" d="${t.d}" fill="${fill}"/>`, width: t.width };
};

const frame = (W: number, H: number, shot: Shot) => {
  const m = Math.round(W * 0.075);
  const size = W * 0.068;
  const gap = W * 0.07;
  const inner = W - 2 * m;
  let body: string;
  let height: number;
  const headline = (y: number) => text(semibold, shot.title, size, m, y, INK.light, -25).svg;

  if ("pair" in shot) {
    // Safari and Span side by side, each over a bar as wide as the page it lays out: 382 or 466 points.
    const between = W * 0.045;
    const w = (inner - between) / 2;
    const label = W * 0.034;
    const big = W * 0.1;
    const bar = W * 0.016;

    const parts = (x: number, y: number, c: Capture, name: string, points: number, fill: string, ink: string) => {
      const l = text(medium, name, label, x, y + label * 0.75, GRAY);
      const numY = y + label * 0.75 + big * 0.95;
      const num = text(semibold, String(points), big, x, numY, ink, -30);
      const unit = text(medium, " pt", label, x + num.width + label * 0.3, numY, GRAY);
      const barY = numY + big * 0.32;
      const win = screen(c, x, barY + bar + big * 0.32, w);

      return {
        svg:
          l.svg +
          num.svg +
          unit.svg +
          `<rect x="${x}" y="${barY}" width="${(w * points) / 466}" height="${bar}" rx="${bar / 2}" fill="${fill}"/>` +
          win.svg,
        h: barY + bar + big * 0.32 + win.h - y,
      };
    };

    const block = (top: number) => {
      const y = top + gap;
      const a = parts(m, y, shot.pair[0], "Safari", 382, "#C7C7CC", GRAY);
      const b = parts(m + w + between, y, shot.pair[1], "Span", 466, "url(#sun)", INK.light);

      return { svg: a.svg + b.svg, h: gap + a.h };
    };

    height = size + block(0).h;
    const top = height < H - 2 * m ? (H - height) / 2 : m * 1.6;
    n = 0;
    body = headline(top + size * 0.75) + block(top + size * 0.75).svg;
  } else {
    const probe = screen(shot.capture, 0, 0, inner);
    height = size + gap + probe.h;
    // Center the headline and screen when they fit; otherwise the screen runs off the bottom.
    const top = height < H - 2 * m ? (H - height) / 2 : m * 1.6;
    body = headline(top + size * 0.75) + screen(shot.capture, m, top + size * 0.75 + gap, inner).svg;
  }

  const sun = `<linearGradient id="sun" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${SUN[0]}"/><stop offset="1" stop-color="${SUN[1]}"/></linearGradient>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${sun}</defs><rect width="${W}" height="${H}" fill="${PAGE}"/>${body}</svg>`;
};

const tmp = path.join(here, ".tmp.svg");

for (const [dir, { w, h }] of Object.entries(sizes)) {
  const out = path.join(here, "out", dir);
  mkdirSync(out, { recursive: true });
  shots.forEach((shot, i) => {
    writeFileSync(tmp, frame(w, h, shot));
    const file = path.join(out, `${String(i + 1).padStart(2, "0")}-${shot.name}.png`);
    png(tmp, file);
    // App Store Connect rejects screenshots with an alpha channel.
    execFileSync("magick", [file, "-background", PAGE, "-alpha", "remove", "-alpha", "off", file]);
  });
  console.log(dir);
}

rmSync(tmp);

writeFileSync(path.join(here, "out", "sizes.json"), JSON.stringify(sizes, null, 2) + "\n");
