// On the iPhone Duo's front screen Safari keeps its buttons in a column along the right and lays pages out beside
// it: 382 points of the screen's 466 (594 of 678 on its side). Brim lays pages out the full width, so pictures,
// cards, grids and bars use the whole screen, and keeps what you read or tap clear of the buttons: running text
// wraps at the column, links and buttons there move in beside it, and fixed bars and pop-ups keep their contents
// beside it while their color runs on underneath. On its side with the camera on the left the column is on the
// left, and Brim does the same, mirrored.
const COLUMN = 84; // points Safari keeps for its buttons
const GAP = 6; // points between the buttons and what you read or tap
const SCREENS = { 382: 466, 594: 678 }; // the width Safari gives the page → the screen's

const CONTROLS =
  'a[href],button,input,label,select,textarea,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[onclick]';

const root = document.documentElement;

const style = document.createElement("style");

// The page is wider than the part Safari counts as shown, so a sideways drag would slide it under the column. Every
// box takes only drags up and down and pinches, as a page's own setting doesn't say otherwise (WebKit starts afresh in
// each box that scrolls, so the root alone isn't enough), except rows that scroll sideways and what's in them, which
// keep a sideways drag to themselves rather than pass it on to the page at their ends.
style.textContent = `:where(html[data-brim],html[data-brim] *){touch-action:pan-y pinch-zoom}
:where(html[data-brim] [data-brim-row],html[data-brim] [data-brim-row] *){touch-action:auto}
html[data-brim] [data-brim-row]{overscroll-behavior-x:contain}
html[data-brim]{overscroll-behavior-x:none!important}
html[data-brim]::-webkit-scrollbar:horizontal{display:none}`;

let tags = []; // the page's viewport tags
let phone = false; // the page is laid out for phones (device-width)
let full = 0; // the screen's width while Brim widens the page, else 0
let left = false; // Safari's column is on the left

const extra = (width) => `, width=${width}, height=device-height, initial-scale=1, minimum-scale=1`;
const EXTRA = new RegExp(extra("\\d+"), "g");

// What the page itself asked of a tag, and what Brim puts in it. Some pages (Amazon) write back what they read,
// Brim's settings included, which Brim takes off again rather than adding to.
const own = (tag) => tag.content.replace(EXTRA, "");
const want = (tag) => own(tag) + (full ? extra(full) : "");

// The screen's width when Safari has its column beside the page, else 0. The visible width is checked rather than
// the screen's, which Private Browsing reports made up, and scaled, so a pinch on another phone never reads as the
// Duo's.
function wide() {
  return SCREENS[Math.round(visualViewport.width * visualViewport.scale)] ?? 0;
}

// The viewport tag decides the layout's width before anything is laid out, and Brim's settings come last, so they
// win over the page's own.
function widen() {
  full = phone ? wide() : 0;
  left = screen.orientation.type === "landscape-primary"; // on its side with the camera on the left

  for (const tag of tags) if (tag.content !== want(tag)) tag.content = want(tag);

  root.toggleAttribute("data-brim", Boolean(full));

  if (!style.isConnected) root.append(style);

  later(0);
}

// Pages that set their viewport tag again from script get it widened again. Safari goes by the tag it read last, and
// some pages (Next.js) add a second one after their first, so every tag carries Brim's settings and the newest says
// whether the page is laid out for phones.
function adopt() {
  const found = [...document.querySelectorAll('meta[name="viewport"]')];

  if (found.length === tags.length && found.every((tag, i) => tag === tags[i] && tag.content === want(tag))) return;
  tags = found;
  phone = tags.length > 0 && /device-width/.test(own(tags.at(-1)));
  widen();
}

// Every change Brim makes is an inline style it can take back.
let changes = []; // [element, property, the page's own value]
let sliding = []; // rows that scroll sideways

function set(el, property, value, priority = "important") {
  changes.push([el, property, el.style.getPropertyValue(property)]);
  el.style.setProperty(property, value, priority);
}

function undo() {
  for (const el of sliding) el.removeAttribute("data-brim-row");
  sliding = [];

  for (const [el, property, value] of changes.toReversed())
    if (value) el.style.setProperty(property, value);
    else el.style.removeProperty(property);
  changes = [];
}

// The page is laid out the full width and shown unzoomed, the part beside the column counted as shown (see wide).
const fits = () => full && root.clientWidth === full && Math.abs(visualViewport.width + COLUMN - full) <= 2;

// Where an element sits on the screen, mirrored when the column is on the left, so everything below is worked out
// as if the column were on the right; the page sits where home puts it.
function box(el) {
  const r = el.getBoundingClientRect();
  const x = left ? full - COLUMN - r.right : r.left;

  return { left: x, right: x + r.width, width: r.width, height: r.height };
}

// The side of a box toward the column, as CSS names it.
const near = () => (left ? "left" : "right");

function arrange() {
  undo();

  if (!fits() || !document.body) return;
  home();
  const edge = full - COLUMN - GAP;
  // Everything is measured before anything is written, so the page is laid out once.
  const found = { bars: [], blocks: new Map(), controls: [], rows: [] };
  walk(document.body, edge, found, { inside: false, block: null });

  const bars = found.bars.map((el) => [el, box(el).left, getComputedStyle(el)]);

  for (const [el, padding] of found.blocks) if (!within(el, found.blocks)) set(el, `padding-${near()}`, `${padding}px`);

  for (const [el, from, css] of bars) fit(el, from, css, edge);

  // A bar held to the column's side (the right on a right-to-left page, the left on most when the column is there) or
  // centered moves toward the column as it narrows, still reaching under it. (One parked past the screen's edge, like
  // a closed side menu, doesn't, and stays out of sight.)
  const narrowed = bars.map(([el, from]) => [el, from, box(el)]);

  for (const [el, from, r] of narrowed) if (r.left > from + 0.5 && r.right > edge + 0.5) shift(el, r.right - edge);

  for (const el of found.rows) el.setAttribute("data-brim-row", "");
  sliding = found.rows;

  dodge(found.controls, edge);
  observer.takeRecords(); // Brim's own changes aren't the page's
  home();
}

// Safari counts only the part beside the column as shown, so it lets the page slide that far sideways. The page
// rests with its edge at the screen's: scrolled to its start when the column is on the right, and the column's
// width in when it's on the left, where Safari starts the page beside the column. A page that scrolls itself away
// (Google's results) or opens at its other edge (right-to-left pages) is put back, once no finger is on it (put
// back under a finger, a page that lets itself be dragged sideways shook) and nothing is being typed (Safari slides
// the page to keep the caret in sight).
let touches = 0;

function home() {
  let focused = document.activeElement;

  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;

  const typing = focused?.matches("input,textarea,[contenteditable]:not([contenteditable=false])");

  const rest = left ? COLUMN : 0;

  if (!touches && !typing && fits() && Math.abs(scrollX - rest) > 0.5)
    scrollBy({ left: rest - scrollX, top: 0, behavior: "instant" });
}

// One pass down the page. Fixed and sticky boxes reaching the column are bars, and keep their contents beside it;
// rows that scroll sideways bring their own items out from under it. Elsewhere each block holding text reaching
// past the edge stops its lines there, and controls reaching past it are moved in after.
function walk(el, edge, found, { inside, block }) {
  const css = getComputedStyle(el);

  if (css.display === "none") return;
  const r = box(el);
  const over = r.right - edge;

  // A frame lays out its own page, so it's fitted like a bar: a sign-in or consent dialog then fits beside the column.
  const bar =
    (/fixed|sticky/.test(css.position) || el.tagName === "IFRAME") && over > 0 && r.width > root.clientWidth * 0.6;

  if (bar) found.bars.push(el);

  if (/auto|scroll/.test(css.overflowX) && el.scrollWidth > el.clientWidth + 1) return void found.rows.push(el);

  const control =
    over > 0 && r.width < root.clientWidth * 0.4 && (el.matches(CONTROLS) || /fixed|sticky/.test(css.position));

  if (control) found.controls.push(el);

  // The block whose lines this element's text runs in: itself, or for inline text the block around it. Once a
  // block's lines stop at the edge, so do those of everything inside it. A bar, or a control that is a box of its own
  // rather than words in a line, moves in whole and keeps its lines (Chase's "Sign in", narrowed as well as moved,
  // broke into a letter or two a line).
  const holder = /^inline|^contents$/.test(css.display) ? block : el;
  const text = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.data.trim());
  const whole = bar || (control && css.display !== "inline");

  if (text && holder && !inside && !whole) {
    const sides = getComputedStyle(holder);
    const padding = parseFloat(sides.getPropertyValue(`padding-${near()}`));
    const by = box(holder).right - parseFloat(sides.getPropertyValue(`border-${near()}-width`)) - padding - edge;

    if (by > 0) found.blocks.set(holder, padding + by);
  }

  // Web components (Reddit's) lay out their own open shadow trees, with the page's elements placed in them.
  for (const child of [...(el.shadowRoot?.children ?? []), ...el.children])
    walk(child, edge, found, { inside: inside || whole || (text && Boolean(holder)), block: holder });
}

// The box around an element, across the edge of a shadow tree.
const up = (el) => el.parentElement ?? el.parentNode?.host;

function within(el, boxes) {
  for (let e = up(el); e; e = up(e)) if (boxes.has(e)) return true;

  return false;
}

// A bar, or a row of controls, ends at the column's edge, so what it holds (centered, right-aligned or positioned
// in it) moves in with it, and its color carries on to the screen's edge underneath the column.
function fit(el, from, css, edge) {
  set(el, "box-sizing", "border-box");
  set(el, "max-width", `${edge - from}px`);

  if (css.position === "static") set(el, "position", "relative");
  const fill = color(css);
  const reach = root.clientWidth - edge;

  if (fill)
    set(
      el,
      "box-shadow",
      `${css.boxShadow === "none" ? "" : `${css.boxShadow},`}${left ? -reach : reach}px 0 0 ${fill}`,
    );
}

function color(css) {
  const value = css.backgroundColor;

  return value === "transparent" || /rgba\(.*,\s*0\)$/.test(value) ? null : value;
}

// Controls still reaching under the column move in: the row each sits in ends at the edge (see fit), and one in no
// row, or that its row doesn't bring in, moves with the small group around it.
function dodge(controls, edge) {
  const over = controls.filter((el) => box(el).right > edge + 0.5);
  const rows = new Map();

  for (const el of over) {
    const row = rowOf(el);

    if (row && !rows.has(row)) rows.set(row, [box(row).left, getComputedStyle(row)]);
  }

  for (const [row, [from, css]] of rows) fit(row, from, css, edge);

  const moved = new Set();

  for (const el of over) {
    const by = box(el).right - edge;
    const group = groupOf(el);

    if (by > 0.5 && !moved.has(group)) shift(group, by);
    moved.add(group);
  }
}

// Moves an element away from the column on top of its own translate (Tailwind centers dialogs and icons with it), and
// below the page's animations of it, which play as the page made them.
function shift(el, by) {
  const translate = getComputedStyle(el).translate;
  const [x, ...rest] = translate === "none" ? ["0px"] : translate.match(/calc\((?:[^()]|\([^()]*\))*\)|\S+/g);

  set(el, "translate", [`calc(${x} ${left ? "+" : "-"} ${by}px)`, ...rest].join(" "), "");
}

// The nearest bar-like box around a control: most of the page wide, a single line or two tall.
function rowOf(el) {
  for (let e = up(el); e && e !== document.body; e = up(e)) {
    const r = e.getBoundingClientRect();

    if (r.height > 200) return null;

    if (r.width >= root.clientWidth * 0.6) return e;
  }

  return null;
}

// The largest box around a control that is still a small group: under half the page wide, one row tall.
function groupOf(el) {
  let group = el;

  for (let e = up(el); e && e !== document.body; e = up(e)) {
    const r = e.getBoundingClientRect();

    if (r.width > root.clientWidth * 0.5 || r.height > 120) break;
    group = e;
  }

  return group;
}

// A pass runs a moment after the page stops changing, and again as late content arrives.
let timer = 0;

function later(delay = 250) {
  clearTimeout(timer);
  timer = setTimeout(() => requestAnimationFrame(arrange), delay);
}

const observer = new MutationObserver(() => {
  adopt();

  if (full) later();
});

observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["content", "class"] });

adopt();

addEventListener("resize", widen);

// Safari can settle the width it shows only after a page has started, once Brim has looked.
visualViewport.addEventListener("resize", () => phone && wide() !== full && widen());

visualViewport.addEventListener("scroll", home);

for (const type of ["touchstart", "touchend", "touchcancel"])
  addEventListener(
    type,
    (event) => {
      touches = event.touches.length;
      home();
    },
    { capture: true, passive: true },
  );

screen.orientation.addEventListener("change", widen);

addEventListener("load", () => later(0));
