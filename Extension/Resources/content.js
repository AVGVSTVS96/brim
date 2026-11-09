// On the iPhone Duo's front screen Safari lays a page out beside its button column, and the space under the
// column shows only the page's base color. Brim leaves the layout as Safari made it, so nothing anyone reads
// or taps ever sits under the buttons, and paints what touches the column's edge on into it: a bar's color
// runs on under the glass, a picture continues as its own mirror image.
const COLUMN = 84; // points Safari keeps for its buttons
const NARROW = [382, 594]; // the page's width beside the column on the front screen, upright and on its side
const root = document.documentElement;

const sheet = document.createElement("style");
let rules = new Map(); // element → { id, text: the CSS painting it on, shadow: its own box-shadow }
let next = 0;

// The column is on the right, except on its side with the camera to the left (landscape-primary).
function side() {
  const width = Math.round(innerWidth * visualViewport.scale);

  if (!NARROW.some((w) => Math.abs(width - w) < 2)) return null;

  return screen.orientation.type === "landscape-primary" ? "left" : "right";
}

function painted(style) {
  const color = style.backgroundColor;

  return color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color) ? color : null;
}

// What an element touching the edge should paint under the column: its color, or a mirror of itself for
// pictures, video and short blocks drawn with an image. null when it paints nothing there.
function look(el, style, facing, shadow) {
  if (/^(IMG|VIDEO|CANVAS|PICTURE|svg)$/.test(el.tagName)) return `-webkit-box-reflect: ${facing}`;

  if (style.backgroundImage !== "none" && el.getBoundingClientRect().height < innerHeight)
    return `-webkit-box-reflect: ${facing}`;
  const color = painted(style);

  if (!color) return null;

  return `box-shadow: ${shadow === "none" ? "" : `${shadow}, `}${facing === "right" ? COLUMN : -COLUMN}px 0 0 ${color}`;
}

// Everything at the column's edge is found by asking the page what sits there, down the visible height,
// so only what's on screen is ever measured.
function scan() {
  const facing = side();

  if (!facing) return clear();

  if (!sheet.isConnected) root.append(sheet);
  const width = root.clientWidth;
  const x = facing === "right" ? width - 1 : 0;
  const seen = new Set();

  for (let y = 0; y < innerHeight; y += 12) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === root || el === document.body || seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      const touches = facing === "right" ? r.right >= width - 0.5 : r.left <= 0.5;
      const had = rules.get(el);
      const style = getComputedStyle(el);
      // The page's own shadow, read before Brim added one to it.
      const shadow = had?.shadow ?? style.boxShadow;
      const want = touches ? look(el, style, facing, shadow) : null;

      if (had?.text === want) continue;

      if (had) el.removeAttribute("data-brim");

      if (!want) {
        rules.delete(el);
        continue;
      }

      const id = had?.id ?? ++next;
      el.setAttribute("data-brim", id);
      rules.set(el, { id, text: want, shadow });
    }
  }

  write();
}

function write() {
  const css = [];

  for (const { id, text } of rules.values()) css.push(`[data-brim="${id}"]{${text.replace(/;?$/, " !important;")}}`);
  const text = css.join("\n");

  if (sheet.textContent !== text) sheet.textContent = text;
}

function clear() {
  for (const el of rules.keys()) el.removeAttribute("data-brim");
  rules = new Map();
  sheet.remove();
}

// At most one scan a frame, a little after the page stops changing or moving.
let queued = 0;

function soon(delay = 80) {
  if (queued) return;
  queued = setTimeout(() => requestAnimationFrame(() => ((queued = 0), scan())), delay);
}

new MutationObserver(() => soon()).observe(root, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "style"],
});

addEventListener("scroll", () => soon(), { passive: true });

addEventListener("resize", () => (clear(), soon(0)));

screen.orientation.addEventListener("change", () => (clear(), soon(0)));

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => (clear(), soon(0)));

addEventListener("DOMContentLoaded", () => soon(0));

addEventListener("load", () => soon(0));
