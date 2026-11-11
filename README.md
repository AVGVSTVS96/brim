# Span

A Safari extension that lays web pages out across the whole front screen of the iPhone Duo.

On the front screen, Safari keeps its buttons in a glass column on the right and lays pages out beside it: 382 points
of the screen's 466. Span lays them out the full 466, so pictures, cards, grids and colored bars use the whole screen,
and keeps everything you read or tap clear of the buttons.

## What it does

- **Full-width layout.** The page's viewport is set to the screen's width before the page is first laid out, so the
  site's own layout uses all of it. No zooming or scaling.
- **Text stays readable.** Lines of running text wrap at the column's edge instead of passing under the clock and the
  buttons.
- **Everything stays tappable.** Headers and rows with buttons end at the column's edge, so what's centered or
  right-aligned in them moves in with them, and their color carries on under the glass.
- **Pop-ups fit.** Fixed bars, cookie banners, sign-in sheets and dialogs (frames included) end at the column's edge,
  so their close and accept buttons stay reachable.
- **No sideways sliding.** The page only scrolls up and down; rows of cards still scroll sideways and can be brought
  out from under the column.
- **Private Browsing works.** Span checks the width Safari shows, not the screen size, which Private Browsing makes up.
- **Nothing to configure.** It changes nothing on other iPhones, the iPad, the Mac, or the Duo's unfolded screen.

## Install

1. Install Span on your iPhone Duo and open it.
2. Tap **Open Settings**, turn on **Allow Extension** and set **All Websites** to **Allow**.

To build it yourself, use Xcode 27 and [XcodeGen](https://github.com/yonaskolb/XcodeGen): set `DEVELOPMENT_TEAM` and
the bundle IDs in `project.yml` to yours, run `xcodegen generate`, and run the Brim scheme on your Duo.

## How it works

`Extension/Resources/content.js` runs at the start of every page. It rewrites the page's viewport tag to the screen's
width, then measures the page once and writes its changes in one go: padding on text blocks that would reach under
the column, a maximum width (plus a matching shadow, so the color continues) on bars and rows that hold buttons, and
`touch-action` so a sideways drag can't slide the page. It runs again when the page changes. Pages that aren't laid
out for phones (no `width=device-width`) are left alone.

## Scripts

They build on a Mac reached as `ssh mac`, with Xcode and the signing team.

- `scripts/phone [device]` builds and installs the app on an iPhone the Mac reaches.
- `scripts/hangar [--notes '<what changed>']` builds main for development and puts it in
  [hangar](https://github.com/AVGVSTVS96/hangar), which installs it on a tap from any network. Each build registers the
  URL scheme `com.shahidy.brim-<build>` (`App/Info.plist`), which tells hangar that build is installed.
- `scripts/check <device> Pages <url>…` opens pages in Safari on a Duo or a Duo simulator, drags each sideways, and
  copies screenshots to `shots/`.
- `scripts/release` archives a Release build and exports a signed, App Store–ready `Brim.ipa`; `scripts/release upload`
  sends it to App Store Connect.

The name shown on the Home Screen, in Settings and in Safari comes from `APP_NAME` in `project.yml`; the version from
`MARKETING_VERSION`, with a new build number on every build (`scripts/version`), since Safari only reloads an
extension's scripts when its version changes.

## Privacy

Span collects nothing and makes no network requests: [privacy](docs/privacy.md).

## Known limits

- On its side with the camera on the left, Safari puts the column on the left; Span leaves those pages as Safari lays
  them out.
- A drag that starts inside an embedded frame from another site can still slide the page.
- Fixed boxes are measured when the page loads and changes, so one a page animates in can sit under the column until
  the next pass, a quarter of a second later.

## Thanks

[Splay](https://github.com/aztechead/splay) and [DuoWide](https://github.com/hyungchulc/duowide) worked out much of
how Safari behaves on this screen.

## License

[MIT](LICENSE)
