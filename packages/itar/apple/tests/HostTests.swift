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
    func testTranslatedParentUsesVisualCoordinatesAndClipsAtViewport() throws {
        let viewport = UIView(frame: CGRect(x: 300, y: 80, width: 250, height: 80))
        viewport.clipsToBounds = true
        let panel = UIView(frame: viewport.bounds.offsetBy(dx: 700, dy: 0))
        panel.transform = CGAffineTransform(translationX: -700, y: 0)
        b.frame = panel.bounds
        panel.addSubview(b)
        viewport.addSubview(panel)
        root.addSubview(viewport)
        root.commitGeometry()
        let registration = try XCTUnwrap(b.registration)
        XCTAssertEqual(registration.bounds, viewport.frame)
        XCTAssertTrue(b.canBecomeFocused)
        panel.transform = CGAffineTransform(translationX: -699, y: 0)
        XCTAssertNil(root.measured(b))
        XCTAssertNil(root.live(registration))
    }

    func testParentMovementRestoresEligibilityWithoutTargetLayout() async throws {
        let panel = UIView(frame: CGRect(x: 800, y: 80, width: 250, height: 80))
        b.frame = panel.bounds
        panel.addSubview(b)
        root.addSubview(panel)
        root.commitGeometry()
        // Let the refresh posted by mounting finish before moving the parent.
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
        let registration = try XCTUnwrap(b.registration)
        XCTAssertFalse(b.canBecomeFocused)

        let expected = CGRect(x: 300, y: 80, width: 250, height: 80)
        func waitForVisibleBounds() async {
            let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                registration.bounds == expected && self.b.canBecomeFocused
            }, object: nil)
            await fulfillment(of: [ready], timeout: 3)
        }
        panel.center.x = expected.midX
        await waitForVisibleBounds()
        panel.transform = CGAffineTransform(scaleX: 1.2, y: 1.2)
        XCTAssertFalse(b.canBecomeFocused)
        let unavailable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            registration.bounds == nil
        }, object: nil)
        await fulfillment(of: [unavailable], timeout: 3)
        UIView.animate(withDuration: 0.1) { panel.transform = .identity }
        await waitForVisibleBounds()
        XCTAssertTrue(registration === b.registration)
    }
    func testAnimationCannotExposeTargetBeforePresentationArrives() async throws {
        let panel = UIView(frame: b.frame)
        b.frame = panel.bounds
        panel.addSubview(b)
        root.addSubview(panel)
        root.commitGeometry()
        let registration = try XCTUnwrap(b.registration)
        XCTAssertTrue(b.canBecomeFocused)

        // Pause the parent outside the surface with its model position already onscreen.
        panel.layer.speed = 0
        panel.layer.timeOffset = 2
        let slide = CABasicAnimation(keyPath: "transform.translation.x")
        slide.fromValue = 1000
        slide.toValue = 0
        slide.beginTime = 1
        slide.duration = 10
        panel.layer.add(slide, forKey: "slide")
        let inFlight = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (panel.layer.presentation()?.transform.m41 ?? 0) > self.root.bounds.width
        }, object: nil)
        await fulfillment(of: [inFlight], timeout: 3)
        XCTAssertNil(root.live(registration))
        root.commitGeometry()
        XCTAssertNil(registration.bounds)
        XCTAssertFalse(b.canBecomeFocused)

        panel.layer.removeAnimation(forKey: "slide")
        let settled = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            registration.bounds == panel.frame && self.b.canBecomeFocused
        }, object: nil)
        await fulfillment(of: [settled], timeout: 3)
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
    func rowEntryRails(policy: Int = 1, cold: Bool = false) async throws -> [[ItarTargetHost]] {
        for target in [a!, b!] { target.removeFromSuperview(); target.recycle() }
        let names = ["header", "rail"]
        var nodes: [[String: Any]] = [["key": "outer", "parent": "", "order": 0, "scope": true,
            "enabled": true, "layout": 2, "extent": 160, "rowEntry": policy]]
        for (index, name) in names.enumerated() {
            nodes.append(["key": name, "parent": "outer", "order": index, "scope": true, "enabled": true, "layout": 1, "extent": 150])
            for order in 0..<3 { nodes.append(["key": "\(name)-\(order)", "parent": name, "order": order,
                "scope": false, "enabled": name != "rail" || order != 0, "layout": 0, "extent": 0]) }
        }
        root.collectionData = String(data: try JSONSerialization.data(withJSONObject: ["dataset": "1", "nodes": nodes]), encoding: .utf8)!
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.root.collections.dataset == "1" }, object: nil)], timeout: 3)
        let outer = ItarScopeHost(frame: root.bounds)
        outer.collectionDataset = "1"
        outer.configure("outer", parent: "", active: true, layout: 2, boundary: 2, trap: false, entryReady: true, preferred: "")
        root.addSubview(outer)
        let vertical = UIScrollView(frame: outer.bounds)
        vertical.contentSize = CGSize(width: outer.bounds.width, height: 320)
        outer.addSubview(vertical)
        var result: [[ItarTargetHost]] = []
        for (index, name) in names.enumerated() {
            let row = ItarScopeHost(frame: CGRect(x: 0, y: index * 160, width: 450, height: 140))
            row.collectionDataset = "1"
            row.configure(name, parent: "outer", active: true, layout: 1, boundary: 2, trap: false, entryReady: true, preferred: "")
            let scroll = UIScrollView(frame: row.bounds)
            scroll.contentSize = CGSize(width: 1000, height: 140)
            row.addSubview(scroll); vertical.addSubview(row)
            result.append((0..<3).map { order in
                let cell = target("\(name)-\(order)", x: CGFloat(order * 150))
                cell.frame = CGRect(x: order * 150, y: 20, width: 100, height: 60)
                cell.scopeKey = name; cell.collectionDataset = "1"; cell.targetEnabled = name != "rail" || order != 0
                scroll.addSubview(cell)
                return cell
            })
            if cold && index == 1 { scroll.contentOffset.x = 300 }
        }
        root.commitGeometry()
        root.onCollectionRecord = { [weak self] record in
            guard let self, let text = record["payload"] as? String, let data = text.data(using: .utf8),
                  var value = try? JSONSerialization.jsonObject(with: data) as? [String: Any], value["state"] as? String == "prepare" else { return }
            value["lifetime"] = String(self.root.lifetime)
            guard let bytes = try? JSONSerialization.data(withJSONObject: value), let acknowledgement = String(data: bytes, encoding: .utf8) else { return }
            DispatchQueue.main.async { [weak self] in self?.root.prepareCollection(acknowledgement) }
        }
        root.focus("header-2")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in result[0][2].isFocused }, object: nil)], timeout: 3)
        return result
    }
    func testCooperativeFirstRowEntryConfirmsWithoutIntermediateGeometricFocus() async throws {
        let rows = try await rowEntryRails()
        var observations: [String] = []
        root.onFocusRecord = { observations.append($0["occurrenceKey"] as? String ?? "") }
        XCTAssertNil(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .right))
        XCTAssertEqual(root.allowCollectionEntry(from: rows[0][2], to: rows[1][1], heading: .down), true)
        // Supply UIKit's proposed destination to the production decision gate;
        // actual preferences, realization and focus confirmation remain native.
        XCTAssertEqual(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .down), false)
        XCTAssertTrue(rows[0][2].isFocused)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in rows[1][1].isFocused }, object: nil)], timeout: 3)
        XCTAssertFalse(observations.contains("rail-2"))
        root.focus("rail-2")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in rows[1][2].isFocused }, object: nil)], timeout: 3)
        observations.removeAll()
        XCTAssertEqual(root.allowCollectionEntry(from: rows[1][2], to: rows[0][2], heading: .up), false)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in rows[0][0].isFocused }, object: nil)], timeout: 3)
        XCTAssertFalse(observations.contains("header-2"))
    }
    func testCooperativeFirstEntryRevealsOffscreenItem() async throws {
        let rows = try await rowEntryRails(cold: true)
        XCTAssertFalse(rows[1][1].canBecomeFocused)
        var observations: [String] = []
        root.onFocusRecord = { observations.append($0["occurrenceKey"] as? String ?? "") }
        XCTAssertEqual(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .down), false)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in rows[1][1].isFocused }, object: nil)], timeout: 3)
        XCTAssertFalse(rows[1][2].isFocused)
        XCTAssertFalse(observations.contains("rail-2"))
    }
    func testCooperativeEntryKeepsDefaultPolicy() async throws {
        let rows = try await rowEntryRails(policy: 0)
        XCTAssertNil(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .down))
    }
    func testCooperativeEntryDiscardsQueuedWorkAfterRouteChanges() async throws {
        let rows = try await rowEntryRails()
        var requests = 0
        root.onRequestRecord = { if $0["status"] as? String == "started" { requests += 1 } }
        XCTAssertEqual(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .down), false)
        root.active = false
        let drained = expectation(description: "Deferred owner turn drained")
        DispatchQueue.main.async { drained.fulfill() }
        await fulfillment(of: [drained], timeout: 3)
        XCTAssertEqual(requests, 0)
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().active_request, 0)
    }
    func testRowPolicyRevisionRetainsExactFocusedHostUntilReactAcceptance() async throws {
        let rows = try await rowEntryRails(policy: 0)
        let source = rows[0][2], registration = try XCTUnwrap(source.registration)
        let data = try XCTUnwrap(root.collectionData.data(using: .utf8))
        var document = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        var nodes = try XCTUnwrap(document["nodes"] as? [[String: Any]])
        nodes[0]["rowEntry"] = 1; document["nodes"] = nodes; document["dataset"] = "2"
        root.collectionData = String(data: try JSONSerialization.data(withJSONObject: document), encoding: .utf8)!
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.root.collections.dataset == "2" }, object: nil)], timeout: 3)
        XCTAssertTrue(source.isFocused && source.registration === registration && source.canBecomeFocused)
        for scope in root.scopes.values { scope.view?.collectionDataset = "2" }
        for row in rows { row.forEach { $0.collectionDataset = "2" } }
        root.commitGeometry()
        XCTAssertTrue(source.isFocused && source.registration === registration && source.canBecomeFocused)
    }
    func testCooperativeEntryDiscardsQueuedWorkAfterDatasetReplacement() async throws {
        let rows = try await rowEntryRails()
        var requests = 0
        root.onRequestRecord = { if $0["status"] as? String == "started" { requests += 1 } }
        XCTAssertEqual(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .down), false)
        root.collectionData = root.collectionData.replacingOccurrences(of: "\"dataset\":\"1\"", with: "\"dataset\":\"2\"")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.root.collections.dataset == "2" }, object: nil)], timeout: 3)
        XCTAssertEqual(requests, 0)
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().active_request, 0)
    }
    func testCooperativeEntryDiscardsQueuedWorkAfterSourceRemoval() async throws {
        let rows = try await rowEntryRails()
        var requests = 0
        root.onRequestRecord = { if $0["status"] as? String == "started" { requests += 1 } }
        XCTAssertEqual(root.allowCollectionEntry(from: rows[0][2], to: rows[1][2], heading: .down), false)
        rows[0][2].removeFromSuperview()
        let drained = expectation(description: "Retired source turn drained")
        DispatchQueue.main.async { drained.fulfill() }
        await fulfillment(of: [drained], timeout: 3)
        XCTAssertEqual(requests, 0)
        XCTAssertEqual(try root.dispatcher?.connection.snapshot().active_request, 0)
    }
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
        for host in [a!, cold] {
            let label = UILabel(); label.text = "Presentation"
            host.presentationContent.addSubview(label); host.presentationContentChanged()
        }
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

    func testCatalogRevisionInvalidatesMoreThanInboxCapacityWithoutClosingSurface() async throws {
        let entries = (0..<40).map { index in
            "{\"key\":\"cell-\(index)\",\"parent\":\"rail\",\"order\":\(index),\"scope\":false,\"enabled\":true,\"layout\":0,\"extent\":0}"
        }.joined(separator: ",")
        func document(_ revision: Int) -> String {
            "{\"dataset\":\"\(revision)\",\"nodes\":[{\"key\":\"rail\",\"parent\":\"\",\"order\":0,\"scope\":true,\"enabled\":true,\"layout\":1,\"extent\":12},\(entries)]}"
        }
        root.collectionData = document(1)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.root.collections.dataset == "1"
        }, object: nil)], timeout: 3)
        let rail = ItarScopeHost(frame: root.bounds)
        rail.collectionDataset = "1"
        rail.configure("rail", parent: "", active: true, layout: 1, boundary: 2, trap: false, entryReady: true, preferred: "")
        root.addSubview(rail)
        let cells = (0..<40).map { index -> ItarTargetHost in
            let cell = target("cell-\(index)", x: CGFloat(index * 12))
            cell.frame = CGRect(x: index * 12, y: 0, width: 10, height: 10)
            cell.scopeKey = "rail"; cell.collectionDataset = "1"
            rail.addSubview(cell)
            return cell
        }
        root.commitGeometry()
        XCTAssertTrue(cells.allSatisfy { $0.canBecomeFocused })
        root.collectionData = document(2)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.root.collections.dataset == "2" || self.root.dispatcher?.closed == true
        }, object: nil)], timeout: 3)
        XCTAssertFalse(root.dispatcher?.closed ?? true, "A valid catalogue revision must not overflow the callback inbox")
        guard root.dispatcher?.closed == false else { return }
        XCTAssertTrue(cells.allSatisfy { $0.registration == nil && !$0.canBecomeFocused })
        rail.collectionDataset = "2"
        cells.forEach { $0.collectionDataset = "2" }
        root.commitGeometry()
        XCTAssertTrue(cells.allSatisfy { $0.canBecomeFocused })
        root.collectionData = "{\"dataset\":\"3\",\"nodes\":[]}"
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.root.collections.dataset == "3" || self.root.dispatcher?.closed == true
        }, object: nil)], timeout: 3)
        XCTAssertFalse(root.dispatcher?.closed ?? true)
        XCTAssertTrue(cells.allSatisfy { !$0.canBecomeFocused })
    }
}

extension AdapterHostTests {
    func testLeadingAlignmentUsesConfirmedHostAndRejectsStalePolicy() async throws {
        let rows = try await rowEntryRails(policy: 0)
        let target = rows[0][2]
        let scroll = try XCTUnwrap(target.superview as? UIScrollView)
        var document = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(root.collectionData.utf8)) as? [String: Any])
        var nodes = try XCTUnwrap(document["nodes"] as? [[String: Any]])
        nodes[1]["horizontalAlignment"] = "leading"; document["nodes"] = nodes; document["dataset"] = "2"
        root.collectionData = String(data: try JSONSerialization.data(withJSONObject: document), encoding: .utf8)!
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.root.collections.dataset == "2" }, object: nil)], timeout: 3)
        root.collections.align(target, dataset: "2")
        XCTAssertTrue(target.isFocused)
        XCTAssertEqual(scroll.contentOffset.x, 300, accuracy: 1)
        scroll.contentOffset.x = 0
        root.collections.align(target, dataset: "1")
        XCTAssertEqual(scroll.contentOffset.x, 0)
        scroll.semanticContentAttribute = .forceRightToLeft
        target.frame.origin.x = 600
        root.collections.align(target, dataset: "2")
        XCTAssertEqual(scroll.contentOffset.x, 250, accuracy: 1) // Target right700 minus viewport450.
        root.active = false
        scroll.contentOffset.x = 20
        root.collections.align(target, dataset: "2")
        XCTAssertEqual(scroll.contentOffset.x, 20)
    }
}

extension AdapterHostTests {
    func testPresentationContentKeepsSingleFocusAndActivationOwner() async throws {
        let image = UIView(frame: b.bounds); image.backgroundColor = .blue
        b.presentationContent.addSubview(image); b.presentationContentChanged(); b.setNeedsLayout(); b.layoutIfNeeded()
        root.commitGeometry()
        let original = try XCTUnwrap(b.registration)
        root.focus("b")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused }, object: nil)], timeout: 3)
        XCTAssertEqual(b.presentationContent.frame, b.bounds)
        XCTAssertNil(b.title(for: .normal))
        XCTAssertFalse(b.presentationContent.isUserInteractionEnabled)
        XCTAssertTrue(b.presentationContent.accessibilityElementsHidden)
        XCTAssertTrue(b.isAccessibilityElement)
        XCTAssertEqual(b.accessibilityLabel, "Button b")
        XCTAssertEqual(b.layer.borderWidth, 5)
        var activations = 0
        b.onActivate = { _ in activations += 1 }
        XCTAssertTrue(b.accessibilityActivate()); XCTAssertEqual(activations, 1)
        b.frame.size.width = 280; b.setNeedsLayout(); b.layoutIfNeeded(); root.commitGeometry()
        XCTAssertEqual(b.presentationContent.frame, b.bounds)
        XCTAssertTrue(b.registration === original)
        image.removeFromSuperview(); b.presentationContentChanged()
        XCTAssertEqual(b.title(for: .normal), "Button b")
        b.presentationContent.addSubview(image); b.recycle()
        XCTAssertTrue(b.presentationContent.subviews.isEmpty)
        XCTAssertNil(b.registration)
        XCTAssertFalse(b.accessibilityActivate())
    }
}
