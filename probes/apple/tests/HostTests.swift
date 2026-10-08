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
    func testRemovalKeepsUnmanagedDistinct() {
        root.request(root.a)
        XCTAssertTrue(root.a.isFocused)
        XCTAssertTrue(root.disappear(.all))
        root.request(root.d)
        XCTAssertTrue(root.d.isFocused)
        XCTAssertEqual(root.alias(root.d), "unmanaged:D")
        XCTAssertEqual(root.alias(nil), "absent")
        XCTAssertTrue(root.live.isEmpty)
    }
    func testPreRemovalTransferAndFreshGeneration() {
        root.request(root.a)
        XCTAssertTrue(root.disappear(.reuse, transferFirst: true))
        XCTAssertTrue(root.b.isFocused)
        XCTAssertEqual(root.connection.generation, 2)
        XCTAssertEqual(root.connection.query(slot: 1, direction: 0).slot, 2)
        XCTAssertFalse(root.events.contains { $0.contains("->unmanaged:D") })
    }

}
