import XCTest

@MainActor final class RemoteTests: XCTestCase {
    func testRNConsumerRemoteDirections() {
        let app = XCUIApplication()
        app.launchArguments = ["-RCT_jsLocation", "localhost:8104"]
        app.launch()
        let a = app.buttons["A"]
        let b = app.buttons["B"]
        guard a.waitForExistence(timeout: 60) else {
            XCTFail(app.debugDescription)
            return
        }
        for _ in 0..<6 where !a.hasFocus { XCUIRemote.shared.press(.down) }
        XCTAssertTrue(a.hasFocus, app.debugDescription)
        XCUIRemote.shared.press(.up)
        XCTAssertTrue(b.hasFocus, app.debugDescription)
        XCUIRemote.shared.press(.select)
        XCTAssertTrue(app.staticTexts["Last JS activation: B"].waitForExistence(timeout: 5))
        XCUIRemote.shared.press(.down)
        XCTAssertTrue(a.hasFocus, app.debugDescription)
        XCUIRemote.shared.press(.right)
        XCTAssertTrue(app.buttons["D"].hasFocus, app.debugDescription)
        XCUIRemote.shared.press(.up) // Empty space above D contains the guide to B.
        XCTAssertTrue(b.hasFocus, app.debugDescription)
    }
    func testScopedBoundaryAndBusyJavaScript() {
        let app = XCUIApplication()
        app.launchArguments = ["-RCT_jsLocation", "localhost:8104", "-itar-constrained", "YES"]
        app.launch()
        let a = app.buttons["A"]
        let b = app.buttons["B"]
        guard a.waitForExistence(timeout: 60) else { XCTFail(app.debugDescription); return }
        for _ in 0..<6 where !a.hasFocus { XCUIRemote.shared.press(.down) }
        XCTAssertTrue(a.hasFocus)
        XCUIRemote.shared.press(.right)
        XCTAssertTrue(a.hasFocus) // Directional boundary rejects unrelated D.
        XCUIRemote.shared.press(.up)
        XCTAssertTrue(b.hasFocus)
        XCUIRemote.shared.press(.up)
        XCTAssertTrue(app.buttons["Busy JS for 2 seconds"].hasFocus)
        XCUIRemote.shared.press(.select)
        XCUIRemote.shared.press(.down)
        XCTAssertTrue(b.hasFocus)
        XCUIRemote.shared.press(.down)
        XCTAssertTrue(a.hasFocus)
    }

}
