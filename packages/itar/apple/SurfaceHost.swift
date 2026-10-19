import UIKit
import ItarEngineCore

final class AppleRegistration {
    let key: String
    var node = ItarNode()
    var mount: UInt64 = 0
    weak var target: ItarTargetHost?
    var available = false
    var bounds: CGRect?
    init(_ key: String) { self.key = key }
}

@objc(ItarSurfaceHost)
public final class ItarSurfaceHost: UIView {
    private static var nextLifetime: UInt64 = 0
    private(set) var dispatcher: EngineDispatcher?
    var registrations: [String: AppleRegistration] = [:]
    private var mountSequence: UInt64 = 0
    private var epoch: UInt64 = 1
    private var posted = false
    private var refreshing = false
    private var observers: [NSObjectProtocol] = []
    private var scrollObservers: [ObjectIdentifier: NSKeyValueObservation] = [:]
    private var lastBounds = CGRect.null
    var preferredToken: ItarToken?
    weak var preferred: ItarTargetHost?
    var covered = false
    var presentation: ApplePresentation?
    @objc public var active = true { didSet { if oldValue != active { activityChanged() } } }
    @objc public var onFocusRecord: ((NSDictionary) -> Void)?
    @objc public var onRequestRecord: ((NSDictionary) -> Void)?
    var acceptsInput: Bool { active && !covered && dispatcher?.closed == false && window != nil }
    var lifetime: UInt64 { dispatcher?.connection.lifetime ?? 0 }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        isAccessibilityElement = false
        for name in [UIAccessibility.voiceOverStatusDidChangeNotification,
                     UIAccessibility.elementFocusedNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) {
                [weak self] _ in self?.readerChanged()
            })
        }
    }
    public required init?(coder: NSCoder) { fatalError("Use the native component") }
    deinit { observers.forEach(NotificationCenter.default.removeObserver) }

    public override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil {
            if !covered { shutdown() }
            return
        }
        if dispatcher == nil || dispatcher?.closed == true { start() }
        geometryChanged()
    }

    private func start() {
        guard Self.nextLifetime < UInt64.max else { return }
        Self.nextLifetime += 1
        guard let connection = try? EngineConnection(surface: Self.nextLifetime, lifetime: Self.nextLifetime) else { return }
        let owner = EngineDispatcher(connection)
        dispatcher = owner
        owner.invoke = { [weak self] in self?.invoke($0) ?? 1 }
        owner.notify = { [weak self] in self?.deliver($0) }
        owner.requested = { [weak self] in self?.requestRecord($0) }
        owner.failed = { [weak self] in
            self?.preferred = nil
            self?.preferredToken = nil
            self?.registrations.values.forEach { $0.available = false; $0.target?.restoreBaseStyle() }
        }
    }

    @objc public func shutdown() {
        preferred = nil
        preferredToken = nil
        dispatcher?.close()
        presentation?.close()
        presentation = nil
        for registration in registrations.values {
            registration.available = false
            registration.target?.restoreBaseStyle()
            registration.target?.owner = nil
            registration.target?.registration = nil
            registration.target?.clearLogicalIdentity()
        }
        registrations.removeAll()
        scrollObservers.removeAll()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        if lastBounds != bounds { lastBounds = bounds; geometryChanged() }
    }
    func targetLayoutChanged(_ target: ItarTargetHost) {
        if target.registration?.bounds != measured(target) { geometryChanged() }
    }
    public override var preferredFocusEnvironments: [UIFocusEnvironment] { preferredEnvironments() }
    public override func shouldUpdateFocus(in context: UIFocusUpdateContext) -> Bool {
        allowsFocus(context) && super.shouldUpdateFocus(in: context)
    }
    public override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        observedFocus(context)
    }
    func activityChanged() {
        accessibilityElementsHidden = !active || covered
        if !acceptsInput {
            preferred = nil
            preferredToken = nil
            if let snapshot = try? dispatcher?.connection.snapshot(), snapshot.deadline != 0 {
                // Request identity is kept by the dispatcher, not inferred from a deadline.
                cancelPending()
            }
        }
        geometryChanged()
    }

    func descendants() -> [ItarTargetHost]? {
        var output: [ItarTargetHost] = []
        var pending = subviews
        var visited = 0
        while let view = pending.popLast() {
            visited += 1
            guard visited <= 4096, pending.count <= 4096 else { return nil }
            if let root = view as? ItarSurfaceHost, root !== self { continue }
            if let target = view as? ItarTargetHost {
                guard output.count < 256 else { return nil }
                output.append(target)
                continue
            }
            let children = view.subviews
            guard pending.count + children.count <= 4096 else { return nil }
            pending.append(contentsOf: children)
        }
        return output
    }

    func geometryChanged() {
        guard !refreshing, let dispatcher, !dispatcher.closed else { return }
        // Invalidate native resolution first; the core fact follows the ordered inbox.
        for registration in registrations.values where registration.available {
            registration.available = false
            dispatcher.enqueue(.invalidate(registration.node, registration.mount, 1, epoch))
        }
        preferred = nil
        guard !posted else { return }
        posted = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.posted = false
            self.commitGeometry()
        }
    }

    // Navigation bounds are in this surface's coordinates. Unsupported transforms
    // or partial clipping make geometry unavailable instead of retaining old bounds.
    func measured(_ target: ItarTargetHost) -> CGRect? {
        guard target.window === window, window != nil, target.targetEnabled,
              !target.label.isEmpty, !target.occurrenceKey.isEmpty else { return nil }
        var ancestor: UIView? = target
        while let view = ancestor {
            guard !view.isHidden, view.alpha > 0.01, view.transform.isIdentity,
                  CATransform3DIsIdentity(view.layer.transform) else { return nil }
            if view.clipsToBounds && !view.bounds.contains(target.convert(target.bounds, to: view)) { return nil }
            if view === self { break }
            ancestor = view.superview
        }
        guard ancestor === self else { return nil }
        let rect = target.convert(target.bounds, to: self)
        guard rect.origin.x.isFinite, rect.origin.y.isFinite, rect.width.isFinite, rect.height.isFinite,
              rect.width > 0, rect.height > 0, bounds.contains(rect) else { return nil }
        return rect
    }

    func live(_ registration: AppleRegistration) -> ItarTargetHost? {
        guard acceptsInput, registration.available, registration.node.slot != 0,
              registrations[registration.key] === registration, let target = registration.target,
              target.registration === registration, target.owner === self,
              target.occurrenceKey == registration.key, measured(target) != nil else { return nil }
        return target
    }

    func commitGeometry() {
        guard let dispatcher, !dispatcher.closed, window != nil else { return }
        guard !dispatcher.pumping else { geometryChanged(); return }
        guard epoch < UInt64.max else { shutdown(); return }
        epoch += 1
        refreshing = true
        defer { refreshing = false }
        var mutations: [EngineMutation] = []
        guard let targets = descendants() else { shutdown(); return }
        var scrolls: [ObjectIdentifier: UIScrollView] = [:]
        for target in targets {
            var ancestor = target.superview
            while let view = ancestor {
                if let scroll = view as? UIScrollView { scrolls[ObjectIdentifier(scroll)] = scroll }
                if view === self { break }
                ancestor = view.superview
            }
            if let old = target.logicalOwner, old !== self || target.logicalLifetime != lifetime { old.drop(target) }
            if target.owner !== self { target.owner?.detach(target); target.owner = self }
            if let old = target.registration, old.key != target.occurrenceKey { drop(target) }
            guard !target.occurrenceKey.isEmpty, target.occurrenceKey.utf8.count <= 512, !target.label.isEmpty else { continue }
            let registration = registrations[target.occurrenceKey] ?? AppleRegistration(target.occurrenceKey)
            if let existing = registration.target, existing !== target { shutdown(); return }
            if registration.target == nil {
                guard mountSequence < UInt64.max else { shutdown(); return }
                mountSequence += 1
                registration.mount = mountSequence
            }
            registration.target = target
            registrations[registration.key] = registration
            target.registration = registration
            var record = ItarRecord()
            record.order = target.order
            record.active = acceptsInput ? 1 : 0
            record.enabled = target.targetEnabled ? 1 : 0
            record.mounted = 1
            record.entry_ready = 1
            record.mount = registration.mount
            if let rect = measured(target) {
                registration.bounds = rect
                record.geometry = ItarGeometry(surface: lifetime, mount: registration.mount, layout: epoch,
                    bounds: ItarRect(x: Double(rect.minX), y: Double(rect.minY),
                                     width: Double(rect.width), height: Double(rect.height)), state: 2)
            } else { registration.bounds = nil }
            mutations.append(EngineMutation(kind: registration.node.slot == 0 ? 0 : 1, key: registration.key,
                                             expected: registration.node, record: record))
        }
        scrollObservers = scrollObservers.filter { scrolls[$0.key] != nil }
        for (id, scroll) in scrolls where scrollObservers[id] == nil {
            scrollObservers[id] = scroll.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
                self?.geometryChanged()
            }
        }
        if !mutations.isEmpty { dispatcher.enqueue(.apply(mutations)) }
        guard !dispatcher.closed else { return }
        for registration in registrations.values {
            guard let target = registration.target else { continue }
            guard let node = try? dispatcher.connection.find(registration.key) else { shutdown(); return }
            registration.node = node
            registration.available = node.slot != 0 && measured(target) != nil && acceptsInput
            target.logicalOwner = self
            target.logicalKey = registration.key
            target.logicalNode = node
            target.logicalMount = registration.mount
            target.logicalLifetime = lifetime
            target.applyFocusStyle()
        }
        observeCurrent()
    }

    func detach(_ target: ItarTargetHost) {
        guard let registration = target.registration, registration.target === target,
              registrations[registration.key] === registration, target.owner === self else { return }
        registration.available = false
        registration.target = nil
        if preferred === target { preferred = nil; preferredToken = nil }
        dispatcher?.enqueue(.invalidate(registration.node, registration.mount, 0, 0))
        target.restoreBaseStyle()
        target.registration = nil
        target.owner = nil
    }

    func drop(_ target: ItarTargetHost) {
        guard target.logicalOwner === self || target.owner === self else { return }
        let key = target.logicalKey ?? target.registration?.key
        let node = target.logicalKey == nil ? target.registration?.node : target.logicalNode
        let mount = target.logicalKey == nil ? target.registration?.mount : target.logicalMount
        let validLifetime = target.logicalKey == nil || target.logicalLifetime == lifetime
        detach(target)
        target.clearLogicalIdentity()
        guard validLifetime, let key, let node, let mount, let registration = registrations[key],
              registration.node.slot == node.slot, registration.node.generation == node.generation,
              registration.mount == mount else { return }
        registrations.removeValue(forKey: key)
        if node.slot != 0 {
            dispatcher?.enqueue(.apply([EngineMutation(kind: 3, key: key, expected: node)]))
        }
    }

    func classify(_ value: Any?) -> ItarFocus {
        guard let value else { return ItarFocus(kind: 2, node: ItarNode(), mount: 0) }
        if let target = value as? ItarTargetHost, let registration = target.registration,
           registrations[registration.key] === registration, registration.target === target,
           registration.node.slot != 0, target.window != nil, target.owner === self {
            return ItarFocus(kind: 0, node: registration.node, mount: registration.mount)
        }
        return ItarFocus(kind: 1, node: ItarNode(), mount: 0)
    }

    func observeCurrent() {
        guard window != nil, let system = UIFocusSystem.focusSystem(for: self) else {
            dispatcher?.enqueue(.focus(ItarFocus(kind: 3, node: ItarNode(), mount: 0), 0, nil))
            return
        }
        dispatcher?.enqueue(.focus(classify(system.focusedItem), 0, nil))
        if UIAccessibility.isVoiceOverRunning {
            dispatcher?.enqueue(.focus(classify(UIAccessibility.focusedElement(using: .notificationVoiceOver)), 1, nil))
        } else {
            dispatcher?.enqueue(.focus(ItarFocus(kind: 3, node: ItarNode(), mount: 0), 1, nil))
        }
    }

    func readerChanged() {
        if UIAccessibility.isVoiceOverRunning { cancelPending(); preferred = nil; preferredToken = nil }
        observeCurrent()
    }
    var pendingRequest: UInt64 = 0
    func cancelPending() {
        if pendingRequest != 0 { dispatcher?.enqueue(.cancel(pendingRequest)); pendingRequest = 0 }
    }
    @objc public func focus(_ key: String) {
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning else { rejectCommand(3); return }
        if dispatcher?.pumping != true { commitGeometry() }
        guard acceptsInput, let dispatcher else { return }
        let now = dispatcher.clock()
        guard now <= UInt64.max - 500 else { shutdown(); return }
        dispatcher.enqueue(.request(key, 0, now, now + 500))
    }
    @objc public func cancel(_ lifetime: String, request: String) {
        guard UInt64(lifetime) == self.lifetime else { rejectCommand(4); return }
        guard let id = UInt64(request), id != 0 else { rejectCommand(5); return }
        dispatcher?.enqueue(.cancel(id))
    }
    @objc public func rejectCommand(_ code: Int32 = 5) {
        guard dispatcher?.closed == false else { return }
        requestRecord(ItarRequestResult(call: ITAR_OK, code: code, request: 0))
    }
    func requestRecord(_ result: ItarRequestResult) {
        if result.code == ITAR_REQUEST_STARTED { pendingRequest = result.request }
        if (try? dispatcher?.connection.snapshot().deadline) == 0 { pendingRequest = 0 }
        let names = ["started", "joined", "busy", "unavailable", "stale", "invalid", "cancelled", "unchanged",
                     "confirmed", "reconciled", "expired", "backward_time", "exhausted", "resync", "disposed", "issued", "waiting"]
        let status = names.indices.contains(Int(result.code)) ? names[Int(result.code)] : "invalid"
        onRequestRecord?(["lifetime": String(lifetime), "request": String(result.request), "status": status])
    }
    func deliver(_ value: ItarNotification) {
        let registration = registrations.values.first {
            $0.node.slot == value.focus.node.slot && $0.node.generation == value.focus.node.generation && $0.mount == value.focus.mount
        }
        if value.confirmed_request != 0 { pendingRequest = 0 }
        let kinds = ["managed", "unmanaged", "absent", "unknown"]
        onFocusRecord?(["lifetime": String(lifetime), "request": String(value.confirmed_request),
            "occurrenceKey": registration?.key ?? "", "mount": String(value.focus.mount),
            "kind": kinds.indices.contains(Int(value.focus.kind)) ? kinds[Int(value.focus.kind)] : "unknown",
            "channel": value.channel == 0 ? "input" : "accessibility"])
    }
}
