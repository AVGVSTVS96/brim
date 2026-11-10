// On the iPhone Duo's front screen Safari keeps its buttons in a column along the right and lays pages out beside
// it: 382 points of the screen's 466 (594 of 678 on its side). Brim lays pages out the full width, so pictures,
// cards, grids and bars use the whole screen, and keeps what you read or tap clear of the buttons: running text
// wraps at the column, links and buttons there move in beside it, and fixed bars and pop-ups keep their contents
// beside it while their color runs on underneath.
const COLUMN = 84; // points Safari keeps for its buttons
const GAP = 6; // points between the buttons and what you read or tap
const SCREENS = { 382: 466, 594: 678 }; // the width Safari gives the page → the screen's

const CONTROLS =
  'a[href],button,input,label,select,textarea,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[onclick]';

const root = document.documentElement;

const style = document.createElement("style");

// The page is wider than the part Safari counts as shown, so a sideways drag would slide it under the column. Every
// box takes only drags up and down and pinches, as a page's own setting doesn't say otherwise (WebKit starts afresh in
// each box that scrolls, so the root alone isn't enough), except rows that scroll sideways and what's in them.
style.textContent = `:where(html[data-brim],html[data-brim] *){touch-action:pan-y pinch-zoom}
:where(html[data-brim] [data-brim-row],html[data-brim] [data-brim-row] *){touch-action:auto}
html[data-brim]{overscroll-behavior-x:none!important}
html[data-brim]::-webkit-scrollbar:horizontal{display:none}`;

let meta; // the page's viewport tag
let own = ""; // what the page itself asked of it
let wrote = ""; // what Brim last put in it
let full = 0; // the screen's width while Brim widens the page, else 0

// The screen's width when Safari has its column on the right, else 0. On its side with the camera on the left
// (landscape-primary) the column is on the left, and Brim leaves the page as Safari lays it out.
// The visible width is checked rather than the screen's, which Private Browsing reports made up.
function wide() {
  if (screen.orientation.type === "landscape-primary") return 0;

  return SCREENS[Math.round(visualViewport.width * visualViewport.scale)] ?? 0;
}

// The viewport tag decides the layout's width before anything is laid out, and Brim's settings come last, so they
// win over the page's own. Only pages laid out for phones (device-width) are widened.
function widen() {
  full = meta ? wide() : 0;

  if (meta) {
    wrote = full ? `${own}, width=${full}, height=device-height, initial-scale=1, minimum-scale=1` : own;

    if (meta.content !== wrote) meta.content = wrote;
  }

  root.toggleAttribute("data-brim", Boolean(full));

  if (!style.isConnected) root.append(style);

  later(0);
}

// Pages that set their viewport tag again from script (Next.js and others do) get it widened again.
function adopt() {
  const found = document.querySelector('meta[name="viewport"]');

  if (!found || (found === meta && found.content === wrote)) return;
  own = found.content;
  meta = /device-width/.test(own) ? found : undefined;
  widen();
}

// Every change Brim makes is an inline style it can take back.
let changes = []; // [element, property, the page's own value]
let sliding = []; // rows that scroll sideways

function set(el, property, value) {
  changes.push([el, property, el.style.getPropertyValue(property)]);
  el.style.setProperty(property, value, "important");
}

function undo() {
  for (const el of sliding) el.removeAttribute("data-brim-row");
  sliding = [];

  for (const [el, property, value] of changes.toReversed())
    if (value) el.style.setProperty(property, value);
    else el.style.removeProperty(property);
  changes = [];
}

function arrange() {
  undo();

  // Only a page Safari has laid out the full width is arranged for it.
  if (!full || Math.abs(root.clientWidth * visualViewport.scale - full) > 2) return;
  const edge = root.clientWidth - (COLUMN + GAP) / visualViewport.scale;
  // Everything is measured before anything is written, so the page is laid out once.
  const found = { bars: [], blocks: new Map(), controls: [], rows: [] };
  walk(document.body, edge, found, { inside: false, block: null });

  const bars = found.bars.map((el) => [el, el.getBoundingClientRect().left, getComputedStyle(el)]);

  for (const [el, padding] of found.blocks) if (!within(el, found.blocks)) set(el, "padding-right", `${padding}px`);

  for (const [el, left, css] of bars) fit(el, left, css, edge);

  for (const el of found.rows) el.setAttribute("data-brim-row", "");
  sliding = found.rows;

  dodge(found.controls, edge);
  observer.takeRecords(); // Brim's own changes aren't the page's
}

// One pass down the page. Fixed and sticky boxes reaching the column are bars, and keep their contents beside it;
// rows that scroll sideways bring their own items out from under it. Elsewhere each block holding text reaching
// past the edge stops its lines there, and controls reaching past it are moved in after.
function walk(el, edge, found, { inside, block }) {
  const css = getComputedStyle(el);

  if (css.display === "none") return;
  const r = el.getBoundingClientRect();
  const over = r.right - edge;

  // A frame lays out its own page, so it's fitted like a bar: a sign-in or consent dialog then fits beside the column.
  const bar =
    (/fixed|sticky/.test(css.position) || el.tagName === "IFRAME") && over > 0 && r.width > root.clientWidth * 0.6;

  if (bar) found.bars.push(el);

  if (/auto|scroll/.test(css.overflowX) && el.scrollWidth > el.clientWidth + 1) return void found.rows.push(el);

  if (over > 0 && r.width < root.clientWidth * 0.4 && (el.matches(CONTROLS) || /fixed|sticky/.test(css.position)))
    found.controls.push(el);

  // The block whose lines this element's text runs in: itself, or for inline text the block around it. Once a
  // block's lines stop at the edge, so do those of everything inside it.
  const holder = /^inline|^contents$/.test(css.display) ? block : el;
  const text = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.data.trim());

  if (text && holder && !inside && !bar) {
    const box = getComputedStyle(holder);

    const by =
      holder.getBoundingClientRect().right - parseFloat(box.borderRightWidth) - parseFloat(box.paddingRight) - edge;

    if (by > 0) found.blocks.set(holder, parseFloat(box.paddingRight) + by);
  }

  for (const child of el.children)
    walk(child, edge, found, { inside: inside || bar || (text && Boolean(holder)), block: holder });
}

function within(el, boxes) {
  for (let e = el.parentElement; e; e = e.parentElement) if (boxes.has(e)) return true;

  return false;
}

// A bar, or a row of controls, ends at the column's edge, so what it holds (centered, right-aligned or positioned
// in it) moves in with it, and its color carries on to the screen's edge underneath the column.
function fit(el, left, css, edge) {
  set(el, "box-sizing", "border-box");
  set(el, "max-width", `${edge - left}px`);

  if (css.position === "static") set(el, "position", "relative");
  const fill = color(css);

  if (fill)
    set(
      el,
      "box-shadow",
      `${css.boxShadow === "none" ? "" : `${css.boxShadow},`}${root.clientWidth - edge}px 0 0 ${fill}`,
    );
}

function color(css) {
  const value = css.backgroundColor;

  return value === "transparent" || /rgba\(.*,\s*0\)$/.test(value) ? null : value;
}

// Controls still reaching under the column move in: the row each sits in ends at the edge (see fit), and one in no
// row, or that its row doesn't bring in, moves with the small group around it.
function dodge(controls, edge) {
  const over = controls.filter((el) => el.getBoundingClientRect().right > edge + 0.5);
  const rows = new Map();

  for (const el of over) {
    const row = rowOf(el);

    if (row && !rows.has(row)) rows.set(row, [row.getBoundingClientRect().left, getComputedStyle(row)]);
  }

  for (const [row, [left, css]] of rows) fit(row, left, css, edge);

  const moved = new Set();

  for (const el of over) {
    const by = el.getBoundingClientRect().right - edge;
    const group = groupOf(el);

    if (by > 0.5 && !moved.has(group)) shift(group, by);
    moved.add(group);
  }
}

function shift(el, by) {
  set(el, "translate", `${(parseFloat(el.style.translate) || 0) - by}px`);
}

// The nearest bar-like box around a control: most of the page wide, a single line or two tall.
function rowOf(el) {
  for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
    const r = e.getBoundingClientRect();

    if (r.height > 200) return null;

    if (r.width >= root.clientWidth * 0.6) return e;
  }

  return null;
}

// The largest box around a control that is still a small group: under half the page wide, one row tall.
function groupOf(el) {
  let group = el;

  for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
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

screen.orientation.addEventListener("change", widen);

addEventListener("load", () => later(0));
