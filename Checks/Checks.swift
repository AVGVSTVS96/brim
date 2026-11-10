import XCTest

// Opens pages in Safari on the front screen and keeps a screenshot of each, as it loads and after a sideways drag,
// which shouldn't move it. BRIM_URLS (comma-separated) picks the pages; scripts/check sets it.
@MainActor
final class Checks: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")

    // On a simulator Brim starts switched off, as on a phone; this turns it on in Settings.
    func testTurnOn() throws {
        let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        XCUIApplication().launch() // Safari lists an app's extension once the app has run
        settings.launch()
        for label in ["Apps", "Safari", "Extensions", "Brim"] {
            open(settings, label)
        }
        let allow = settings.switches.firstMatch
        XCTAssert(allow.waitForExistence(timeout: 5))
        if allow.value as? String == "0" { allow.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap() }
        attach(settings, "allowed")
        open(settings, "All Websites")
        settings.staticTexts["Allow"].firstMatch.tap()
        attach(settings, "settings")
    }

    private func open(_ app: XCUIApplication, _ label: String) {
        let item = app.staticTexts[label].firstMatch
        _ = item.waitForExistence(timeout: 5)
        for _ in 0..<8 where !item.isHittable {
            app.swipeUp()
        }
        item.tap()
    }

    func testPages() throws {
        let urls = (ProcessInfo.processInfo.environment["BRIM_URLS"] ?? "https://www.amazon.com").split(separator: ",")
        safari.terminate() // Safari loads an extension's new version when it starts
        safari.launch()
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

    private func attach(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
