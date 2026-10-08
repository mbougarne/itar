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

    func testSynchronousFakeHostGuard() {
        let guardLoop = ProbeDispatcher(ProbeConnection())
        XCTAssertTrue(guardLoop.invoke {
            guardLoop.observe("managed:B")
            XCTAssertFalse(guardLoop.invoke { XCTFail("recursive host entry") })
            guardLoop.invalidate(2)
            XCTAssertNotEqual(guardLoop.query(slot: 1, direction: 0).status, 0)
            guardLoop.observe("unmanaged:D")
        })
        XCTAssertEqual(guardLoop.observed, "unmanaged:D")
        XCTAssertNotEqual(guardLoop.query(slot: 1, direction: 0).status, 0)
        XCTAssertFalse(guardLoop.invoke {
            guardLoop.close()
            XCTAssertTrue(guardLoop.closed)
            XCTAssertEqual(guardLoop.connection.query(slot: 1, direction: 0).status, 5)
        })
        XCTAssertEqual(guardLoop.connection.query(slot: 1, direction: 0).status, 8)
    }
    func testOverflowRevokesWithoutSilentLoss() {
        let guardLoop = ProbeDispatcher(ProbeConnection())
        XCTAssertFalse(guardLoop.invoke { for _ in 0..<33 { guardLoop.observe("unknown") } })
        XCTAssertTrue(guardLoop.closed)
    }
    func testDisposalDuringUIKitCallback() {
        root.request(root.a)
        root.callbackAction = { [weak root] in root?.dispatcher.close() }
        root.request(root.b)
        XCTAssertTrue(root.dispatcher.closed)
        XCTAssertTrue(root.b.isFocused) // Host outcome survives revoked intent.
        root.request(root.a)
        XCTAssertTrue(root.b.isFocused)
    }

    func testSemanticsAndAccessibilityActivationStaySeparate() {
        root.request(root.a)
        XCTAssertEqual(root.b.accessibilityLabel, "B: destination")
        XCTAssertTrue(root.b.accessibilityTraits.contains(.button))
        XCTAssertTrue(root.b.accessibilityActivate())
        XCTAssertEqual(root.b.activations, 1)
        XCTAssertTrue(root.a.isFocused)
        root.b.isEnabled = false
        XCTAssertFalse(root.b.accessibilityActivate())
        root.b.isEnabled = true
        root.live.remove(2)
        XCTAssertFalse(root.b.accessibilityActivate())
    }
    func testBaseBorderRestoredOnBlurAndReuse() {
        root.request(root.a)
        root.a.baseBorder = .purple
        root.request(root.b)
        root.a.applyBorder()
        XCTAssertEqual(root.a.layer.borderWidth, 1)
        XCTAssertEqual(root.a.layer.borderColor, UIColor.purple.cgColor)
        root.a.resetForReuse()
        XCTAssertEqual(root.a.layer.borderWidth, 1)
    }

    func testNestedPresentationAndDisposedOpener() async {
        root.request(root.a)
        let modal = ProbePresentation.open(from: window.rootViewController!, opener: root)!
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertTrue(root.suspended)
        XCTAssertTrue(root.accessibilityElementsHidden)
        XCTAssertTrue(modal.view.window === window)
        XCTAssertNil(ProbePresentation.open(from: window.rootViewController!, opener: root))
        let nested = ProbePresentation.open(from: modal, opener: modal.probe)!
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertTrue(modal.probe.suspended)
        nested.closeProbe()
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertFalse(modal.probe.suspended)
        root.dispatcher.close()
        modal.closeProbe()
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertTrue(root.dispatcher.closed)
    }
    func testDismissalRestoresLiveOpener() async {
        root.request(root.a)
        let modal = ProbePresentation.open(from: window.rootViewController!, opener: root)!
        try? await Task.sleep(nanoseconds: 100_000_000)
        modal.closeProbe()
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertFalse(root.suspended)
        XCTAssertFalse(root.accessibilityElementsHidden)
        XCTAssertTrue(root.a.isFocused)
    }

}
