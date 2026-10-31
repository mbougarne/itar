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
    func testRetiredViewCannotEraseReplacement() throws {
        let old = a!
        let original = try XCTUnwrap(old.registration)
        let mount = original.mount
        old.removeFromSuperview()
        let replacement = target("a", x: 0)
        root.addSubview(replacement)
        root.commitGeometry()
        XCTAssertGreaterThan(replacement.registration?.mount ?? 0, mount)
        old.recycle()
        XCTAssertNotNil(root.registrations["a"])
        XCTAssertTrue(replacement.canBecomeFocused)
        replacement.removeFromSuperview()
        replacement.recycle()
        XCTAssertNil(root.registrations["a"])
        XCTAssertEqual(try root.dispatcher?.connection.find("a").slot, 0)
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
    func testScopePreferenceWithoutHistoryFromAnotherScope() async throws {
        let scope = ItarScopeHost(frame: root.bounds)
        scope.configure("sidebar", parent: "", active: true, layout: 1, boundary: 0, trap: false, entryReady: true, preferred: "b")
        root.addSubview(scope)
        scope.addSubview(b)
        b.scopeKey = "sidebar"
        root.commitGeometry()
        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        var confirmed = false
        root.onRequestRecord = {
            if $0["command"] as? String == "first" && $0["status"] as? String == "confirmed" { confirmed = true }
        }
        root.restoreScopeRequest("sidebar", command: "first")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused && confirmed }, object: nil)], timeout: 3)
    }
    func testUnreadyScopePreventsDefaultButAllowsExplicitFocus() async throws {
        let scope = ItarScopeHost(frame: root.bounds)
        scope.configure("waiting", parent: "", active: true, layout: 1, boundary: 2, trap: false, entryReady: false, preferred: "")
        root.addSubview(scope)
        scope.addSubview(b)
        b.scopeKey = "waiting"
        root.commitGeometry()
        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        XCTAssertFalse(b.canBecomeFocused)
        XCTAssertFalse(scope.accessibilityElementsHidden)
        var observations: [String] = []
        root.onFocusRecord = { observations.append($0["occurrenceKey"] as? String ?? "") }
        a.removeFromSuperview()
        let system = try XCTUnwrap(UIFocusSystem.focusSystem(for: root))
        system.requestFocusUpdate(to: root)
        system.updateFocusIfNeeded()
        XCTAssertFalse(b.isFocused)
        XCTAssertFalse(observations.contains("b"))
        root.focus("b")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused }, object: nil)], timeout: 3)
        XCTAssertTrue(b.canBecomeFocused) // Closing entry preserves confirmed focus.
        scope.configure("waiting", parent: "", active: true, layout: 1, boundary: 2, trap: false, entryReady: true, preferred: "")
        root.commitGeometry()
        XCTAssertTrue(b.isFocused)
    }
    func testCommittedScopeActivityAndNativeHistory() async throws {
        let scope = ItarScopeHost(frame: root.bounds)
        scope.configure("rail", parent: "", active: true, layout: 1, boundary: 0, trap: false, entryReady: true, preferred: "")
        root.addSubview(scope)
        scope.addSubview(a)
        scope.addSubview(b)
        a.scopeKey = "rail"; b.scopeKey = "rail"
        root.commitGeometry()
        root.focus("b")
        let focused = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused }, object: nil)
        await fulfillment(of: [focused], timeout: 3)
        scope.configure("rail", parent: "", active: false, layout: 1, boundary: 0, trap: false, entryReady: true, preferred: "")
        root.commitGeometry()
        XCTAssertFalse(b.canBecomeFocused)
        XCTAssertTrue(scope.accessibilityElementsHidden)
        scope.configure("rail", parent: "", active: true, layout: 1, boundary: 0, trap: false, entryReady: true, preferred: "")
        root.commitGeometry()
        var statuses: [String] = []
        root.onRequestRecord = { if $0["command"] as? String == "restore" { statuses.append($0["status"] as? String ?? "") } }
        root.restoreScopeRequest("rail", command: "restore")
        let restored = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused && statuses.contains("confirmed") }, object: nil)
        await fulfillment(of: [restored], timeout: 3)
        scope.removeFromSuperview()
        scope.recycle()
        XCTAssertEqual(try root.dispatcher?.connection.find("b").slot, 0)
        XCTAssertFalse(b.accessibilityActivate())
    }
    func testDirectionalScopeEntryUsesHistoryAndCancelsStaleHandoff() async throws {
        let scope = ItarScopeHost(frame: root.bounds)
        scope.configure("menu", parent: "", active: true, layout: 2, boundary: 2, trap: false, entryReady: true, preferred: "b")
        scope.restoreOnEntry = true
        root.addSubview(scope); scope.addSubview(a); scope.addSubview(b)
        a.scopeKey = "menu"; b.scopeKey = "menu"
        a.frame = CGRect(x: 0, y: 0, width: 200, height: 80)
        b.frame = CGRect(x: 0, y: 150, width: 200, height: 80)
        let outside = target("outside", x: 450)
        root.addSubview(outside); root.commitGeometry()
        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        root.focus("outside")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in outside.isFocused }, object: nil)], timeout: 3)
        var observations: [String] = []
        root.onFocusRecord = { observations.append($0["occurrenceKey"] as? String ?? "") }
        XCTAssertTrue(root.redirectScopeEntry(from: outside, to: b))
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        XCTAssertFalse(observations.contains("b"))
        root.focus("outside")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in outside.isFocused }, object: nil)], timeout: 3)
        XCTAssertTrue(root.redirectScopeEntry(from: outside, to: b))
        root.focus("b") // A newer explicit command invalidates the queued entry.
        let turn = expectation(description: "next owner turn")
        DispatchQueue.main.async { turn.fulfill() }
        await fulfillment(of: [turn], timeout: 3)
        XCTAssertTrue(b.isFocused)
    }
}

extension AdapterHostTests {
    func virtualCollection() async throws -> (UIScrollView, ItarTargetHost) {
        a.removeFromSuperview()
        a.recycle() // The catalog, rather than a physical cell, now owns logical A.
        var catalogued = false
        root.onCollectionRecord = { record in
            guard let text = record["payload"] as? String, let data = text.data(using: .utf8),
                  let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            if value["state"] as? String == "catalog" { catalogued = true }
        }
        root.collectionData = """
        {"dataset":"1","nodes":[
          {"key":"list","parent":"","order":0,"scope":true,"enabled":true,"layout":1,"extent":400},
          {"key":"a","parent":"list","order":0,"scope":false,"enabled":true,"layout":0,"extent":0},
          {"key":"cold","parent":"list","order":1,"scope":false,"enabled":true,"layout":0,"extent":0}]}
        """
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in catalogued }, object: nil)], timeout: 3)
        XCTAssertTrue(catalogued)
        let scope = ItarScopeHost(frame: CGRect(x: 0, y: 180, width: 300, height: 100))
        scope.collectionDataset = "1"
        scope.configure("list", parent: "", active: true, layout: 1, boundary: 2, trap: false, entryReady: true, preferred: "")
        let scroll = UIScrollView(frame: scope.bounds)
        scroll.clipsToBounds = false // Match the TV renderer's independent painting policy.
        scroll.contentSize = CGSize(width: 1000, height: 100)
        scope.addSubview(scroll)
        a.frame = CGRect(x: 0, y: 0, width: 250, height: 80)
        a.scopeKey = "list"; a.collectionDataset = "1"
        scroll.addSubview(a)
        let cold = target("cold", x: 400)
        cold.frame.origin.y = 0
        cold.scopeKey = "list"; cold.collectionDataset = "1"
        scroll.addSubview(cold)
        root.addSubview(scope)
        root.commitGeometry()
        XCTAssertFalse(cold.canBecomeFocused)
        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        return (scroll, cold)
    }
    func testCollectionRevealScrollsBeforeConfirmedFocus() async throws {
        let (scroll, cold) = try await virtualCollection()
        var observations: [String] = []
        root.onFocusRecord = { observations.append($0["occurrenceKey"] as? String ?? "") }
        root.onCollectionRecord = { [weak self] record in
            guard let self, let text = record["payload"] as? String, let data = text.data(using: .utf8),
                  var value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  value["state"] as? String == "prepare" else { return }
            value["lifetime"] = String(self.root.lifetime)
            guard let bytes = try? JSONSerialization.data(withJSONObject: value),
                  let acknowledgement = String(data: bytes, encoding: .utf8) else { return }
            DispatchQueue.main.async { [weak self] in self?.root.prepareCollection(acknowledgement) }
        }
        root.focus("cold")
        XCTAssertTrue(a.isFocused)
        XCTAssertFalse(cold.isFocused)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in cold.isFocused }, object: nil)], timeout: 3)
        XCTAssertGreaterThan(scroll.contentOffset.x, 0)
        XCTAssertTrue(scroll.bounds.contains(cold.frame)) // UIKit can center its confirmed focus item.
        XCTAssertTrue(cold.isFocused)
        XCTAssertFalse(observations.contains("b"))
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().active_request, 0)
    }
    func testCancelledPreparationCannotScroll() async throws {
        let (scroll, _) = try await virtualCollection()
        var preparation: [String: Any]?
        root.onCollectionRecord = { record in
            guard let text = record["payload"] as? String, let data = text.data(using: .utf8),
                  var value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  value["state"] as? String == "prepare" else { return }
            value["lifetime"] = record["lifetime"]
            preparation = value
        }
        root.focus("cold")
        let old = try XCTUnwrap(preparation)
        root.cancelPending()
        let bytes = try JSONSerialization.data(withJSONObject: old)
        root.prepareCollection(try XCTUnwrap(String(data: bytes, encoding: .utf8)))
        XCTAssertEqual(scroll.contentOffset.x, 0)
        XCTAssertTrue(a.isFocused)
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().active_request, 0)
    }
    func testCatalogRetirementPrunesDetachedCellsAndScope() async throws {
        let (scroll, cold) = try await virtualCollection()
        let scope = try XCTUnwrap(scroll.superview as? ItarScopeHost)
        a.removeFromSuperview(); cold.removeFromSuperview()
        XCTAssertNotNil(root.registrations["a"])
        XCTAssertNil(root.registrations["a"]?.target)
        root.collectionData = "{\"dataset\":\"2\",\"nodes\":[]}"
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.root.collections.dataset == "2"
        }, object: nil)], timeout: 3)
        root.commitGeometry()
        XCTAssertNil(root.registrations["a"])
        XCTAssertNil(root.registrations["cold"])
        XCTAssertNil(root.scopes["list"])
        XCTAssertNil(scope.owner)
        XCTAssertTrue(scope.accessibilityElementsHidden)
        XCTAssertEqual(try root.dispatcher?.connection.find("list").slot, 0)
        XCTAssertFalse(root.dispatcher?.closed ?? true)
    }
}
