# Span · brand

**The idea in a sentence:** the icon is the Duo's front screen doing what Span does: the page's color runs to the edge under Safari's glass column, and its text stops beside it.

It starts from the picture on the app's setup screen (`App/BrimApp.swift`, `Preview`). Bassim picked it over an S monogram, a bridge, a hi-fi meter and the name alone: "have a logo more like what span actually does".

## Personality

- **Shows, doesn't tell.** Every asset is the real thing: Safari's column, real pages captured on a Duo, the real numbers (382 and 466 points).
- **Apple's where it's Apple's.** The glass, the column's buttons and the system font in the app stay iOS. The brand is one gradient and one typeface on top.
- **Few words.** A headline is two or three words. Facts live in the README.

## The name

- **Span** in sentences, on the App Store and in the app. The wordmark is lowercase **span**.
- Code and IDs keep the old name (`Brim` scheme, `BrimApp.swift`, bundle IDs), so installs and signing carry over.

## Color

| token      | light                 | dark      | use                                                                                                                                |
| ---------- | --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `--sun`    | `#FFB347` → `#FF4F8C` | same      | the page's color reaching the edge: the icon's banner, Span's bar in the store's 466 pt chart                                      |
| `--accent` | `#E8336B`             | `#F0457A` | the app's tint (`AccentColor`): buttons, the "On in Safari" check. The banner's pink, deepened so white text on it holds about 4:1 |
| `--page`   | `#FFFFFF`             | `#1C1C1E` | the icon's page; the store frames sit on `#F4F4F6`                                                                                 |
| `--ink`    | `#16161A`             | `#F2F1EE` | text, the wordmark                                                                                                                 |
| `--line`   | `#D9D9DE`             | `#3A3A3F` | the icon's text lines                                                                                                              |
| `--gray`   | `#8E8E93`             | `#8E8E93` | Safari's side of a comparison, units                                                                                               |

Rule: **the gradient only ever means the page's color reaching the edge.** Everything else is ink, page and iOS glass.

## Type: Geist

- **Wordmark:** Geist SemiBold, lowercase, tracked -30/1000, after the app tile, the tile centered on the x-height. Drawn from the font's outlines.
- **Store headlines:** Geist SemiBold, tracked -25/1000, flush left, sentence case with a period. Labels and units in Geist Medium.
- **In the app:** the system font. Geist is for the store, the wordmark and anything off the phone.
- Geist is OFL (`fonts/Geist-OFL.txt`).

## Logo

`logo/gen.ts` draws it (`bun logo/gen.ts`) into `logo/out/` and writes the app's icon set.

- **Icon:** `icon-light.svg`, `icon-dark.svg`, and 1024 PNGs for light, dark and tinted (grayscale, iOS tints it). The app's `AppIcon.appiconset` is these, alpha removed.
- **The drawing:** a white (or `#1C1C1E`) page; the banner starts on the page's margin with rounded corners and runs off the right edge; three text lines stop 44 units short of the column; Safari's column is a Liquid Glass capsule with share, reader and tabs drawn as SF Symbols draws them.
- **Wider than true:** the column is 236 of 1024, wider than Safari's real 84 of 466 points, so it and its buttons hold at 60pt. At 29pt the buttons are specks; the banner and column still read.
- **Wordmark:** `wordmark-light.svg` / `.png` on light, `wordmark-dark.svg` / `.png` on dark (transparent).
- **Not taken:** the same scene reduced to banner and glass only (reads as a plus sign small); the page's color filling the icon with the column standing in it (bright, but loses the text that stops, and nears the other Brim's icon). Three rivals (Fullbleed, Overspill, Brim) also draw a page beside a column, as flat blocks or outlines; this one is a real iOS screen with real glass in the setup screen's colors.

## Store screenshots

`store/gen.ts` builds them (`bun store/gen.ts`) from Duo simulator captures in `store/captures/` into `store/out/`; `store/upload.ts` puts them on the listing, replacing each size's set.

| folder       | size        | App Store Connect type                                                  |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `duo`        | 1398 × 2034 | `APP_IPHONE_DUO` (outer display; earns the "made for iPhone Duo" badge) |
| `iphone-6.9` | 1320 × 2868 | `APP_IPHONE_67`                                                         |
| `iphone-6.3` | 1206 × 2622 | `APP_IPHONE_61`                                                         |

- Six frames: the 382 and 466 pt comparison, then one headline over one capture each (cal.com, Amazon, GitHub, X, OpenStreetMap).
- Captures are the front screen as it is, never mocked. Safari's one-time "Adaptive Dark Mode" prompt covers the top of some captures; the Amazon frame starts below it.
- The screen sits in a window with the Duo's rounded corners and a soft shadow. Where it's taller than the frame, it runs off the bottom.

## Credits

The setup picture, and with it the mark, came from Span's own setup screen. Splay and DuoWide worked out much of how Safari behaves on this screen (see the README).
