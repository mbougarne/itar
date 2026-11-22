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
    #if ITAR_OCCO
    func testOccoAssignsANewMoveWhenUIKitReusesThePress() throws {
        final class RemotePress: UIPress {
            var current: UIPress.Phase = .began
            override var phase: UIPress.Phase { current }
            override var type: UIPress.PressType { .downArrow }
        }
        var windowMoves: [UInt64] = []
        let record: ([String: Any]) -> Void = { event in
            if let move = event["move"] as? UInt64 { windowMoves.append(move) }
        }
        ItarFocusTrace.receive = record
        defer { ItarFocusTrace.receive = nil }
        let press = RemotePress()
        var previous: UInt64 = 0
        for end in [UIPress.Phase.ended, .cancelled, .ended] {
            press.current = .began
            let surfaceFirst = ItarFocusTrace.move(for: press)
            XCTAssertGreaterThan(surfaceFirst, previous)
            ItarOccoWindow.forward([press], recording: record) {
                XCTAssertEqual(ItarFocusTrace.move(for: press), surfaceFirst)
            }
            press.current = end
            ItarOccoWindow.forward([press], recording: record) {
                XCTAssertEqual(ItarFocusTrace.move(for: press), surfaceFirst, "keep the ID during UIKit's terminal dispatch")
            }
            XCTAssertEqual(Array(windowMoves.suffix(2)), [surfaceFirst, surfaceFirst])
            previous = surfaceFirst
        }
    }

    func testOccoKeepsFocusChannelsAndRecycledMountsSeparate() throws {
        var events: [[String: Any]] = []
        ItarFocusTrace.receive = { events.append($0) }
        defer { ItarFocusTrace.receive = nil }
        let original = try XCTUnwrap(a.registration?.mount)
        root.traceObservation(a, channel: "input")
        let foreign = UIButton(frame: CGRect(x: 20, y: 20, width: 90, height: 40))
        root.addSubview(foreign)
        root.traceObservation(foreign, channel: "accessibility")
        a.removeFromSuperview()
        root.addSubview(a)
        root.commitGeometry()
        root.traceObservation(a, channel: "input")

        let callbacks = events.filter { ($0["detail"] as? String)?.hasPrefix("callback:") == true }
        let input = callbacks.filter { $0["channel"] as? String == "input" && $0["target"] as? String == "a" }
        XCTAssertEqual(input.first?["mount"] as? UInt64, original)
        XCTAssertGreaterThan(try XCTUnwrap(input.last?["mount"] as? UInt64), original)
        XCTAssertTrue(input.allSatisfy { $0["request"] == nil })
        let voice = try XCTUnwrap(callbacks.first { $0["channel"] as? String == "accessibility" })
        let native = try XCTUnwrap(voice["nativeDestination"] as? [String: Any])
        XCTAssertEqual(native["role"] as? String, "button")
        XCTAssertNotNil(native["bounds"] as? [String: Int])
        XCTAssertNil(voice["target"])
        XCTAssertNil(voice["mount"])
    }
    #endif

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
    func testDiscreteArrowUsesFreshGeometryForMountedHostDestinations() async throws {
        final class RightPress: UIPress {
            override var type: UIPress.PressType { .rightArrow }
            override var phase: UIPress.Phase { .began }
        }
        let sibling = target("sibling", x: 400)
        root.addSubview(sibling)
        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        root.commitGeometry()
        XCTAssertTrue(b.canBecomeFocused)
        XCTAssertTrue(sibling.canBecomeFocused)

        sibling.center.x += root.bounds.width
        let recognizer = try XCTUnwrap(root.gestureRecognizers?.compactMap { $0 as? CollectionInput }.first)
        XCTAssertFalse(recognizer.gestureRecognizer(recognizer, shouldReceive: RightPress()), "UIKit owns the mounted arrow")
        XCTAssertTrue(b.canBecomeFocused, "An unrelated layout change must not swallow this arrow")
        XCTAssertFalse(sibling.canBecomeFocused, "The moved target must stay unavailable offscreen")
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
    func testFocusedPrimaryActionSurvivesUnrelatedPendingLayout() async throws {
        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        root.commitGeometry()
        let mount = try XCTUnwrap(a.registration).mount
        var records: [NSDictionary] = []
        a.onActivate = { records.append($0) }
        b.onActivate = { records.append($0) }

        b.center.x += 10
        a.sendActions(for: .primaryActionTriggered)
        XCTAssertEqual(records.count, 1, "One Select should activate the focused mount while its sibling moves")
        XCTAssertEqual(records.first?["source"] as? String, "input")
        XCTAssertEqual(records.first?["mount"] as? String, String(mount))

        b.sendActions(for: .primaryActionTriggered)
        a.targetEnabled = false
        a.sendActions(for: .primaryActionTriggered)
        a.removeFromSuperview()
        a.sendActions(for: .primaryActionTriggered)
        XCTAssertEqual(records.count, 1, "Unfocused, disabled and detached controls cannot activate")
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
    func testCurrentBaseStyleOnBlurAndReuse() async throws {
        b.baseColor = .red
        b.focusColor = .blue
        XCTAssertEqual(b.layer.borderWidth, 0)
        XCTAssertEqual(b.currentTitleColor, .red)

        root.focus("b")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.b.isFocused }, object: nil)], timeout: 3)
        XCTAssertEqual(b.layer.borderWidth, 5)
        XCTAssertEqual(b.layer.borderColor, UIColor.blue.cgColor)
        b.baseColor = .green
        XCTAssertEqual(b.currentTitleColor, .blue)

        root.focus("a")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.a.isFocused }, object: nil)], timeout: 3)
        XCTAssertEqual(b.layer.borderWidth, 0)
        XCTAssertEqual(b.currentTitleColor, .green)

        b.outlineInsetBottom = 16
        b.recycle()
        XCTAssertEqual(b.layer.borderWidth, 0)
        XCTAssertNil(b.layer.borderColor)
        XCTAssertEqual(b.currentTitleColor, .green)
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
    func publishRowRevision(_ revision: Int, change: (inout [[String: Any]]) -> Void) async throws {
        var document = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(root.collectionData.utf8)) as? [String: Any])
        var nodes = try XCTUnwrap(document["nodes"] as? [[String: Any]])
        change(&nodes)
        document["dataset"] = String(revision); document["nodes"] = nodes
        root.collectionData = String(decoding: try JSONSerialization.data(withJSONObject: document), as: UTF8.self)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.root.collections.dataset == String(revision)
        }, object: nil)], timeout: 3)
        root.commitGeometry()
    }
    func testPaginationRetainsCompatibleMountsAcrossFabricCommits() async throws {
        let rows = try await rowEntryRails(policy: 0), source = rows[0][2]
        let scroll = try XCTUnwrap(source.superview as? UIScrollView)
        scroll.contentOffset.x = 150; root.commitGeometry()
        let mount = try XCTUnwrap(source.registration?.mount)
        let outer = try XCTUnwrap(root.scopes["outer"]?.view), row = try XCTUnwrap(root.scopes["header"]?.view)
        let append: (inout [[String: Any]]) -> Void = { nodes in
            let index = nodes.filter { $0["parent"] as? String == "header" }.count
            nodes.append(["key": "header-\(index)", "parent": "header", "order": index,
                          "scope": false, "enabled": true, "layout": 0, "extent": 0])
        }
        try await publishRowRevision(2, change: append)
        XCTAssertTrue(source.isFocused && source.canBecomeFocused)
        XCTAssertEqual(source.registration?.mount, mount)
        XCTAssertNotNil(rows[0][1].registration, "The visible sibling still has the same declaration and native view")
        let replacement = target("header-2", x: 300)
        replacement.scopeKey = "header"; replacement.collectionDataset = "1"
        XCTAssertFalse(root.collections.accepts(replacement))
        let replacementRow = ItarScopeHost(frame: row.frame)
        replacementRow.scopeKey = "header"; replacementRow.collectionDataset = "1"
        XCTAssertFalse(root.collections.accepts(replacementRow))
        row.collectionDataset = "2"; root.commitGeometry()
        XCTAssertEqual(source.registration?.mount, mount, "Fabric can update the parent first")
        try await publishRowRevision(3, change: append)
        source.collectionDataset = "3"; root.commitGeometry()
        XCTAssertEqual(source.registration?.mount, mount, "A second append can arrive before Fabric finishes the first")
        row.collectionDataset = "3"; outer.collectionDataset = "3"; root.commitGeometry()
        XCTAssertTrue(source.isFocused && source.canBecomeFocused)
        XCTAssertEqual(source.registration?.mount, mount)
        XCTAssertEqual(scroll.contentOffset.x, 150, accuracy: 1)
        source.removeFromSuperview(); source.collectionDataset = "1"; scroll.addSubview(source); root.commitGeometry()
        XCTAssertNil(source.registration, "Recycling invalidates the older mount's authority")
        source.collectionDataset = "3"; root.commitGeometry()
        XCTAssertGreaterThan(try XCTUnwrap(source.registration?.mount), mount)
    }
    func testAppendingAPageKeepsVisibleCardsAvailableFromAnExternalFilter() async throws {
        let rows = try await rowEntryRails(policy: 0), card = rows[0][0]
        let filter = target("filter", x: 480)
        filter.frame = CGRect(x: 460, y: 0, width: 100, height: 60)
        root.addSubview(filter); root.commitGeometry(); root.focus("filter")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in filter.isFocused }, object: nil)], timeout: 2)
        let scroll = try XCTUnwrap(card.superview as? UIScrollView)
        scroll.contentOffset = .zero; root.commitGeometry()
        XCTAssertTrue(card.canBecomeFocused, "The grid's first card is already fully visible before the append")
        let old = try XCTUnwrap(card.registration?.mount)
        try await publishRowRevision(2) { nodes in
            nodes.append(["key": "header-3", "parent": "header", "order": 3, "scope": false, "enabled": true, "layout": 0, "extent": 0])
            let first = nodes.firstIndex { $0["key"] as? String == "rail-1" }!
            nodes[first]["enabled"] = false
        }
        XCTAssertTrue(filter.isFocused && card.canBecomeFocused)
        XCTAssertEqual(card.registration?.mount, old)
        XCTAssertNil(rows[1][1].registration, "A changed declaration must wait for Fabric")
        root.focus(card.occurrenceKey) // Enter before Fabric applies the new dataset.
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in card.isFocused }, object: nil)], timeout: 2)
        XCTAssertEqual(card.registration?.mount, old)
        card.collectionDataset = "2"; root.commitGeometry()
        card.collectionDataset = "1"; root.commitGeometry()
        XCTAssertNil(card.registration, "An older declaration cannot be reapplied after this view committed")
    }
    func testChangedOrRemovedCatalogueDeclarationRejectsTheOldMount() async throws {
        let rows = try await rowEntryRails(policy: 0), source = rows[0][2]
        try await publishRowRevision(2) { nodes in
            let index = nodes.firstIndex { $0["key"] as? String == "header" }!
            nodes[index]["extent"] = 160
        }
        XCTAssertNil(source.registration, "Changing ancestor layout invalidates the old mount")
        for scope in root.scopes.values { scope.view?.collectionDataset = "2" }
        for row in rows { row.forEach { $0.collectionDataset = "2" } }
        root.commitGeometry(); root.focus("header-2")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in source.isFocused }, object: nil)], timeout: 3)
        try await publishRowRevision(3) { nodes in
            let index = nodes.firstIndex { $0["key"] as? String == "header-2" }!
            nodes[index]["enabled"] = false
        }
        XCTAssertNil(source.registration); XCTAssertFalse(source.canBecomeFocused)
        for scope in root.scopes.values { scope.view?.collectionDataset = "3" }
        for row in rows { row.forEach { $0.collectionDataset = "3" } }
        let removed = rows[0][1]
        root.commitGeometry(); root.focus("header-1")
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in removed.isFocused }, object: nil)], timeout: 3)
        try await publishRowRevision(4) { $0.removeAll { node in
            node["key"] as? String == "header-1" || node["key"] as? String == "header-2"
        } }
        XCTAssertNil(root.registrations["header-1"]); XCTAssertNil(removed.registration)
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
        cold.removeFromSuperview(); root.commitGeometry()
        var observations: [String] = []
        root.onFocusRecord = { observations.append($0["occurrenceKey"] as? String ?? "") }
        root.onCollectionRecord = { [weak self] record in
            guard let self, let text = record["payload"] as? String, let data = text.data(using: .utf8),
                  var value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  value["state"] as? String == "prepare" else { return }
            scroll.addSubview(cold); self.root.commitGeometry()
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
        let (scroll, cold) = try await virtualCollection()
        cold.removeFromSuperview(); root.commitGeometry() // A missing cell needs a React preparation.
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
    func testMountedNestedRevealConfirmsWithoutReactPreparation() async throws {
        let rows = try await rowEntryRails(policy: 0), card = rows[1][2]
        let inner = try XCTUnwrap(card.superview as? UIScrollView)
        let outer = try XCTUnwrap(inner.superview?.superview as? UIScrollView)
        outer.frame.size.height = 150; inner.contentOffset.x = 450
        root.commitGeometry()
        let mount = try XCTUnwrap(card.registration?.mount)
        XCTAssertFalse(card.canBecomeFocused)
        var windowEvents = 0
        root.onCollectionRecord = { _ in windowEvents += 1 } // No React renderer available.
        let observed = expectation(description: "UIKit focused the existing mount")
        let start = ProcessInfo.processInfo.systemUptime
        root.onFocusRecord = { record in
            if record["occurrenceKey"] as? String == card.occurrenceKey, record["kind"] as? String == "managed" {
                let milliseconds = (ProcessInfo.processInfo.systemUptime - start) * 1000
                XCTContext.runActivity(named: "Native mounted reveal observed in \(milliseconds) ms") { _ in }
                observed.fulfill()
            }
        }
        root.focus(card.occurrenceKey)
        await fulfillment(of: [observed], timeout: 2)
        XCTAssertTrue(card.isFocused)
        XCTAssertEqual(windowEvents, 0)
        XCTAssertEqual(card.registration?.mount, mount)
        XCTAssertGreaterThan(outer.contentOffset.y, 0); XCTAssertLessThan(inner.contentOffset.x, 450)
        XCTAssertNotNil(root.measured(card)); XCTAssertEqual(try root.dispatcher?.connection.snapshot().active_request, 0)
    }
    func testCancelledMountedRevealDoesNotScrollOrStealFocus() async throws {
        let (scroll, cold) = try await virtualCollection()
        var windowEvents = 0; root.onCollectionRecord = { _ in windowEvents += 1 }
        root.focus(cold.occurrenceKey); root.cancelPending()
        let drained = expectation(description: "Native reveal owner turn")
        DispatchQueue.main.async { drained.fulfill() }
        await fulfillment(of: [drained], timeout: 2)
        XCTAssertEqual(windowEvents, 0); XCTAssertEqual(scroll.contentOffset.x, 0)
        XCTAssertTrue(a.isFocused); XCTAssertFalse(cold.isFocused)
    }
    func testRecycledDestinationCannotAuthorizeQueuedMountedScroll() async throws {
        let (scroll, card) = try await virtualCollection()
        let oldMount = try XCTUnwrap(card.registration?.mount)
        root.focus(card.occurrenceKey)
        card.removeFromSuperview(); scroll.addSubview(card); root.commitGeometry()
        XCTAssertGreaterThan(try XCTUnwrap(card.registration?.mount), oldMount)
        let drained = expectation(description: "Old mounted reveal discarded")
        DispatchQueue.main.async { drained.fulfill() }
        await fulfillment(of: [drained], timeout: 2)
        XCTAssertEqual(scroll.contentOffset.x, 0); XCTAssertTrue(a.isFocused)
        XCTAssertFalse(card.isFocused)
    }
    func testRecyclingAPageBeforeItsCollectionUnmountsKeepsTheNextCatalogueUsable() async throws {
        func scope(_ key: String, _ parent: String) -> ItarScopeHost {
            let view = ItarScopeHost(frame: root.bounds)
            view.configure(key, parent: parent, active: true, layout: 1, boundary: 2, trap: false,
                           entryReady: true, preferred: "")
            return view
        }
        func publish(_ dataset: Int, parent: String) async throws {
            root.collectionData = """
            {"dataset":"\(dataset)","nodes":[
              {"key":"route-row","parent":"\(parent)","order":0,"scope":true,"enabled":true,"layout":1,"extent":100},
              {"key":"route-card","parent":"route-row","order":0,"scope":false,"enabled":true,"layout":0,"extent":0}]}
            """
            await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                self.root.collections.dataset == String(dataset) || self.root.dispatcher?.closed == true
            }, object: nil)], timeout: 3)
            XCTAssertFalse(root.dispatcher?.closed ?? true)
        }
        let page = scope("home-route", ""), list = scope("route-row", "home-route")
        root.addSubview(page); root.commitGeometry()
        try await publish(1, parent: "home-route")
        let card = target("route-card", x: 0)
        card.scopeKey = "route-row"; card.collectionDataset = "1"; list.collectionDataset = "1"
        list.addSubview(card); page.addSubview(list); root.commitGeometry()
        let firstMount = try XCTUnwrap(card.registration?.mount)
        page.removeFromSuperview()
        page.recycle() // Fabric can recycle this host before it delivers collectionData.
        let dispatcher = try XCTUnwrap(root.dispatcher)
        XCTAssertFalse(dispatcher.closed)
        guard !dispatcher.closed else { return }
        XCTAssertEqual(try dispatcher.connection.find("home-route").slot, 0)

        let next = scope("next-route", "")
        root.addSubview(next); root.commitGeometry()
        try await publish(2, parent: "next-route")
        let newList = scope("route-row", "next-route")
        newList.collectionDataset = "2"; card.collectionDataset = "2"
        newList.addSubview(card); next.addSubview(newList); root.commitGeometry()
        list.recycle() // A delayed callback from the retired view cannot take the new owner.
        XCTAssertTrue(root.scopes["route-row"]?.view === newList)
        XCTAssertGreaterThan(try XCTUnwrap(card.registration?.mount), firstMount)
        XCTAssertTrue(card.canBecomeFocused)
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
    func testVisibleVerticalGridMoveKeepsViewportWhileEntryAndClippedTargetsCanScroll() async throws {
        let rows = try await rowEntryRails(policy: 0)
        let previous = rows[0][2], next = rows[1][2]
        let row = try XCTUnwrap(root.scopes["rail"]?.view)
        let viewport = try XCTUnwrap(row.superview as? UIScrollView)
        viewport.contentSize.height = 1000
        var confirmed: UIFocusUpdateContext?
        let observer = NotificationCenter.default.addObserver(forName: UIFocusSystem.didUpdateNotification, object: nil, queue: nil) { note in
            let context = note.userInfo?[UIFocusSystem.focusUpdateContextUserInfoKey] as? UIFocusUpdateContext
            if context?.nextFocusedView === next { confirmed = context }
        }
        defer { NotificationCenter.default.removeObserver(observer) }
        root.focus(next.occurrenceKey)
        let update = try XCTUnwrap(confirmed)
        XCTAssertTrue(update.previouslyFocusedView === previous)
        func confirm(from source: ItarTargetHost?, heading: UIFocusHeading) {
            root.collections.confirming(next, from: source, heading: heading)
            root.collections.finishFocusUpdate(update)
        }
        XCTAssertNotNil(root.measured(next))
        confirm(from: nil, heading: .down)
        XCTAssertTrue(viewport.isScrollEnabled, "Grid entry keeps the host reveal")
        confirm(from: previous, heading: .right)
        XCTAssertTrue(viewport.isScrollEnabled, "A horizontal arrow does not claim the outer vertical viewport")
        confirm(from: previous, heading: .down)
        XCTAssertFalse(viewport.isScrollEnabled, "UIKit must leave the fully visible next row in place")
        await Task.yield()
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in viewport.isScrollEnabled }, object: nil)], timeout: 2)
        row.frame.origin.y = viewport.bounds.maxY - next.frame.minY - next.frame.height + 1
        XCTAssertNil(root.measured(next))
        confirm(from: previous, heading: .down)
        XCTAssertTrue(viewport.isScrollEnabled, "Even a partially clipped card needs its host reveal")
    }
    func testPinnedCardStaysAtItsRenderedAnchorThroughoutFocusUpdate() async throws {
        let rows = try await rowEntryRails(policy: 0), first = rows[0][0], second = rows[0][1]
        let scroll = try XCTUnwrap(first.superview as? UIScrollView)
        try await publishRowRevision(2) { nodes in
            let index = nodes.firstIndex { $0["key"] as? String == "header" }!
            nodes[index]["horizontalAlignment"] = "pinned"
        }
        for scope in root.scopes.values { scope.view?.collectionDataset = "2" }
        for row in rows { row.forEach { $0.collectionDataset = "2" } }
        root.commitGeometry(); root.focus(first.occurrenceKey)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in first.isFocused }, object: nil)], timeout: 3)
        root.focus(second.occurrenceKey)
        XCTAssertTrue(second.isFocused)
        var frames: [CGFloat] = []
        for _ in 0..<40 {
            try await Task.sleep(nanoseconds: 16_000_000)
            if let layer = scroll.layer.presentation() { frames.append(layer.bounds.minX) }
        }
        let aligned = try XCTUnwrap(frames.firstIndex(where: { abs($0 - 150) < 1 }))
        XCTAssertTrue(frames[aligned...].allSatisfy { abs($0 - 150) < 1 }, "Rendered offsets: \(frames)")
        XCTAssertTrue(second.isFocused); XCTAssertTrue(scroll.isScrollEnabled)
        scroll.isScrollEnabled = false
        let third = rows[0][2]; root.focus(third.occurrenceKey)
        await fulfillment(of: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in third.isFocused }, object: nil)], timeout: 3)
        XCTAssertFalse(scroll.isScrollEnabled, "A viewport disabled by its owner must stay disabled")
    }
    func testPinnedAlignmentKeepsAnAlreadyAlignedCardEligible() async throws {
        let rows = try await rowEntryRails(policy: 0), target = rows[0][2]
        let scroll = try XCTUnwrap(target.superview as? UIScrollView)
        try await publishRowRevision(2) { nodes in
            let index = nodes.firstIndex { $0["key"] as? String == "header" }!
            nodes[index]["horizontalAlignment"] = "pinned"
        }
        root.collections.align(target, dataset: "2"); root.commitGeometry()
        XCTAssertTrue(target.isFocused && target.canBecomeFocused)
        XCTAssertEqual(scroll.contentOffset.x, 300, accuracy: 1)
        root.collections.align(target, dataset: "2") // The focus animation completion repeats the initial placement.
        XCTAssertTrue(target.canBecomeFocused)
    }
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
