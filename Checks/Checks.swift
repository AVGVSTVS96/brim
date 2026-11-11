import XCTest

// Opens pages in Safari on the front screen and keeps a screenshot of each, as it loads and after a sideways drag,
// which shouldn't move it. BRIM_URLS (comma-separated) picks the pages; scripts/check sets it.
@MainActor
final class Checks: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")

    // On a simulator Brim starts switched off, as on a phone; this turns it on in Settings.
    func testAllow() throws {
        let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        XCUIApplication().launch() // Safari lists an app's extension once the app has run
        settings.launch()
        for label in ["Apps", "Safari", "Extensions", ProcessInfo.processInfo.environment["BRIM_NAME"] ?? "Span"] {
            open(settings, label)
        }
        // On the Duo's front screen Settings keeps its sidebar, with Airplane Mode's switch, beside the page.
        let allow = settings.switches.matching(NSPredicate(format: "label CONTAINS 'Allow'")).firstMatch
        XCTAssert(allow.waitForExistence(timeout: 5))
        attach(settings, "found")
        if allow.value as? String == "0" { allow.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap() }
        attach(settings, "allowed")
        open(settings, "All Websites")
        settings.staticTexts["Allow"].firstMatch.tap()
        attach(settings, "settings")
    }

    // Lists load as they scroll, and on the Duo's front screen the sidebar and the page scroll apart, so each is tried.
    private func open(_ app: XCUIApplication, _ label: String) {
        let item = app.staticTexts[label].firstMatch
        _ = item.waitForExistence(timeout: 5)
        for _ in 0..<30 where !(item.exists && item.isHittable) {
            for list in app.collectionViews.allElementsBoundByIndex + app.tables.allElementsBoundByIndex
            where list.isHittable && !(item.exists && item.isHittable) {
                list.swipeUp()
            }
        }
        item.tap()
    }

    func testPages() throws {
        let urls = (ProcessInfo.processInfo.environment["BRIM_URLS"] ?? "https://www.amazon.com").split(separator: ",")
        safari.terminate() // Safari loads an extension's new version when it starts
        if let split { splitView(split) } else { safari.launch() }
        for (index, url) in urls.enumerated() {
            safari.open(URL(string: String(url))!)
            sleep(8)
            let name = "\(index)-\(URL(string: String(url))!.host() ?? "page")"
            attach(safari, name)
            let page = safari.webViews.firstMatch
            if page.exists {
                let from = page.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.6))
                from.press(forDuration: 0.05, thenDragTo: page.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.6)))
                sleep(2)
                attach(safari, "\(name)-dragged")
            }
        }
    }

    // BRIM_SPLIT (left or right) puts Safari on that side of the open Duo's screen in Split View, beside Messages:
    // the app whose Home Screen menu opens Split View takes the left, and the one tapped after it the right. The Duo
    // has to be open and upright already.
    let split = ProcessInfo.processInfo.environment["BRIM_SPLIT"].flatMap { $0.isEmpty ? nil : $0 }

    private func splitView(_ side: String) {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let (first, second) = side == "left" ? ("Safari", "Messages") : ("Messages", "Safari")
        XCUIApplication(bundleIdentifier: "com.apple.MobileSMS").terminate() // ends the last run's pair
        XCUIDevice.shared.press(.home)
        XCUIDevice.shared.press(.home)
        sleep(1)
        springboard.icons[first].press(forDuration: 1)
        springboard.buttons["Open in Split View"].tap()
        sleep(2)
        springboard.icons[second].tap()
        sleep(3)
        // Safari's offer of dark mode for every site covers the page's top.
        let notNow = safari.buttons["Not Now"]
        if notNow.exists { notNow.tap() }
    }

    private func attach(_ app: XCUIApplication, _ name: String) {
        // The open Duo's screen isn't the main one.
        let screen = split == nil ? XCUIScreen.main : XCUIScreen.screens.last { $0 != XCUIScreen.main } ?? XCUIScreen.main
        let shot = XCTAttachment(screenshot: screen.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
