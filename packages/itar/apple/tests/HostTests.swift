import XCTest
import UIKit
@testable import ItarEngineNative

@MainActor final class AdapterTestController: UIViewController {
    var appeared = false
    override var preferredFocusEnvironments: [UIFocusEnvironment] { view.subviews }
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); appeared = true }
}

@MainActor final class AdapterHostTests: XCTestCase {
    var window: UIWindow!
    var previous: UIViewController?
    var root: ItarSurfaceHost!
    var a: ItarTargetHost!
    var b: ItarTargetHost!
    override func setUp() async throws {
        try await super.setUp()
        window = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }.first { $0.isKeyWindow }
        XCTAssertNotNil(window)
        previous = window.rootViewController
        let controller = AdapterTestController()
        root = ItarSurfaceHost(frame: CGRect(x: 80, y: 80, width: 700, height: 300))
        a = target("a", x: 0)
        b = target("b", x: 300)
        root.addSubview(a)
        root.addSubview(b)
        controller.view.addSubview(root)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        window.layoutIfNeeded()
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in controller.appeared }, object: nil)
        await fulfillment(of: [ready], timeout: 3)
        root.commitGeometry()
    }
    override func tearDown() {
        root.shutdown()
        window.rootViewController = previous
        root = nil; a = nil; b = nil; window = nil
        super.tearDown()
    }
    func target(_ key: String, x: CGFloat) -> ItarTargetHost {
        let target = ItarTargetHost(frame: CGRect(x: x, y: 80, width: 250, height: 80))
        target.occurrenceKey = key
        target.label = "Button \(key)"
        return target
    }
    func testActualFocusAndNotification() async throws {
        var records: [NSDictionary] = []
        root.onFocusRecord = { records.append($0) }
        root.focus("b")
        let focused = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused }, object: nil)
        await fulfillment(of: [focused], timeout: 3)
        XCTAssertTrue(b.isFocused)
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().input.node.slot, b.registration?.node.slot)
        XCTAssertTrue(records.contains { $0["occurrenceKey"] as? String == "b" && $0["kind"] as? String == "managed" })
    }
    func testReuseInvalidatesOldGeneration() throws {
        let old = try XCTUnwrap(a.registration)
        let node = old.node
        let mount = old.mount
        a.removeFromSuperview()
        XCTAssertNil(root.live(old))
        root.addSubview(a)
        root.commitGeometry()
        XCTAssertEqual(a.registration?.node.slot, node.slot)
        XCTAssertGreaterThan(a.registration?.mount ?? 0, mount)
        XCTAssertNotEqual(try root.dispatcher?.connection.invalidate(node, mount: mount, kind: 0), 0)
    }
    func testInvalidGeometryAndSemanticsBeforeEligibility() {
        XCTAssertEqual(a.accessibilityLabel, "Button a")
        XCTAssertTrue(a.accessibilityTraits.contains(.button))
        a.transform = CGAffineTransform(scaleX: 2, y: 2)
        root.geometryChanged()
        root.commitGeometry()
        XCTAssertFalse(a.canBecomeFocused)
        a.transform = .identity
        a.targetEnabled = false
        root.commitGeometry()
        XCTAssertTrue(a.accessibilityTraits.contains(.notEnabled))
        XCTAssertFalse(a.canBecomeFocused)
        XCTAssertFalse(a.accessibilityActivate())
    }
    func testSemanticActivationDoesNotTransferInputFocus() throws {
        root.focus("a")
        let before = try root.dispatcher?.connection.snapshot().input
        var records: [NSDictionary] = []
        b.onActivate = { records.append($0) }
        XCTAssertTrue(b.accessibilityActivate())
        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?["source"] as? String, "accessibility")
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().input.node.slot, before?.node.slot)
        b.removeFromSuperview()
        XCTAssertFalse(b.accessibilityActivate())
    }
    func testCurrentBaseStyleOnBlurAndReuse() {
        root.focus("a")
        a.baseColor = .red
        a.focusColor = .blue
        a.restoreBaseStyle()
        XCTAssertEqual(a.layer.borderColor, UIColor.red.cgColor)
        a.baseColor = .green
        a.recycle()
        XCTAssertEqual(a.layer.borderColor, UIColor.green.cgColor)
        XCTAssertEqual(a.layer.borderWidth, 1)
    }
    func testOwnedPresentationCoversAndRestoresSameWindow() async throws {
        root.focus("a")
        root.showDialog()
        let modal = try XCTUnwrap(root.presentation)
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in modal.viewIfLoaded?.window != nil }, object: nil)
        await fulfillment(of: [ready], timeout: 3)
        XCTAssertTrue(root.covered)
        XCTAssertTrue(root.accessibilityElementsHidden)
        XCTAssertTrue(modal.view.window === window)
        XCTAssertFalse(root.acceptsInput)
        root.dismissDialog()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.root.presentation == nil }, object: nil)
        await fulfillment(of: [dismissed], timeout: 3)
        XCTAssertFalse(root.covered)
        XCTAssertFalse(root.accessibilityElementsHidden)
    }
    func testNestedPresentationAndDisabledOpenerState() async throws {
        b.targetEnabled = false
        root.commitGeometry()
        root.focus("a")
        root.showDialog()
        let first = try XCTUnwrap(root.presentation)
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in first.viewIfLoaded?.window != nil }, object: nil)
        await fulfillment(of: [ready], timeout: 3)
        first.root.showDialog()
        let child = try XCTUnwrap(first.root.presentation)
        let nested = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in child.viewIfLoaded?.window != nil }, object: nil)
        await fulfillment(of: [nested], timeout: 3)
        root.dismissDialog()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.root.presentation == nil }, object: nil)
        await fulfillment(of: [dismissed], timeout: 3)
        XCTAssertFalse(b.targetEnabled)
        XCTAssertFalse(b.isEnabled)
    }
    func testCoveredAndDisposedOpenersDoNotRegainAuthority() {
        root.covered = true
        root.showDialog()
        XCTAssertNil(root.presentation)
        root.covered = false
        let modal = ApplePresentation(opener: root)
        root.shutdown()
        modal.restore()
        XCTAssertTrue(root.dispatcher?.closed == true)
        XCTAssertFalse(a.canBecomeFocused)
    }
    func testScrollClippingInvalidatesGeometry() {
        b.removeFromSuperview()
        let scroll = UIScrollView(frame: CGRect(x: 300, y: 80, width: 250, height: 80))
        scroll.contentSize = CGSize(width: 600, height: 80)
        scroll.clipsToBounds = true
        b.frame = CGRect(x: 0, y: 0, width: 250, height: 80)
        scroll.addSubview(b)
        root.addSubview(scroll)
        root.commitGeometry()
        XCTAssertTrue(b.canBecomeFocused)
        scroll.contentOffset = CGPoint(x: 50, y: 0)
        XCTAssertFalse(b.canBecomeFocused)
        root.commitGeometry()
        XCTAssertNil(b.registration?.bounds)
        XCTAssertEqual(root.classify(UIButton()).kind, 1)
        XCTAssertEqual(root.classify(nil).kind, 2)
    }
}
