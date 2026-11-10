import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { type Font, type Path, parse } from "opentype.js";

// The banner from the setup screen: orange to pink, top left to bottom right.
export const SUN = ["#FFB347", "#FF4F8C"] as const;
export const INK = { light: "#16161A", dark: "#F2F1EE" } as const;

export const font = (file: string) =>
  parse(new Uint8Array(readFileSync(path.join(import.meta.dirname, "fonts", file))).buffer);

// opentype.js's own toPathData prints NaN for some coordinates, so the path is written here.
const n2 = (v: number) => String(Math.round(v * 100) / 100);

const pathData = (p: Path) =>
  p.commands
    .map((c) =>
      c.type === "Z"
        ? "Z"
        : c.type === "Q"
          ? `Q${n2(c.x1)} ${n2(c.y1)} ${n2(c.x)} ${n2(c.y)}`
          : c.type === "C"
            ? `C${n2(c.x1)} ${n2(c.y1)} ${n2(c.x2)} ${n2(c.y2)} ${n2(c.x)} ${n2(c.y)}`
            : `${c.type}${n2(c.x)} ${n2(c.y)}`,
    )
    .join("");

// Text as outlines, so renders don't depend on installed fonts. Baseline at y = 0.
export const word = (f: Font, text: string, size: number, trackingPerMille = 0) => {
  const scale = size / f.unitsPerEm;
  let pen = 0;
  let d = "";
  let x1 = Infinity;
  let x2 = -Infinity;

  for (const [i, glyph] of [...text].map((c) => f.charToGlyph(c)).entries()) {
    const p = glyph.getPath(pen, 0, size);

    if (p.commands.length) {
      const box = p.getBoundingBox();
      x1 = Math.min(x1, box.x1);
      x2 = Math.max(x2, box.x2);
    }

    d += pathData(p);
    pen += (glyph.advanceWidth ?? 0) * scale + (i < text.length - 1 ? (trackingPerMille / 1000) * size : 0);
  }

  return { d, x1, width: x2 - x1, advance: pen };
};

export const xHeight = (f: Font, size: number) => (f.tables.os2.sxHeight / f.unitsPerEm) * size;

export const png = (svgFile: string, pngFile: string, width?: number) =>
  execFileSync("rsvg-convert", [...(width ? ["-w", String(width)] : []), "-o", pngFile, svgFile]);
