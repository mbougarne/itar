import XCTest
import UIKit
@testable import ItarProbeHost

@MainActor final class HostTests: XCTestCase {
    var window: UIWindow!
    var root: ProbeRoot!
    var previous: UIViewController?
    override func setUp() {
        super.setUp()
        window = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }.first { $0.isKeyWindow }
        XCTAssertNotNil(window)
        previous = window.rootViewController
        let controller = UIViewController()
        root = ProbeRoot(frame: CGRect(x: 100, y: 100, width: 700, height: 300))
        controller.view.addSubview(root)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        window.layoutIfNeeded()
    }
    override func tearDown() {
        window.rootViewController = previous
        root = nil
        window = nil
        super.tearDown()
    }
    func testPreferencesConfirmActualFocus() {
        root.request(root.a)
        XCTAssertTrue(root.a.isFocused)
        root.request(root.b)
        XCTAssertTrue(root.b.isFocused)
        XCTAssertTrue(root.events.contains { $0.contains("callback") && $0.contains("managed:B") })
        XCTAssertFalse(root.overflow)
    }
    func testGuideAndBoundaryConfiguration() {
        XCTAssertTrue(root.guide.preferredFocusEnvironments.first === root.b)
        root.constrained = true
        root.request(root.d) // Programmatic request remains host-owned.
        XCTAssertTrue(root.d.isFocused)
    }
}
