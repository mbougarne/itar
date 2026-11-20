import UIKit
import ItarEngineCore

final class AppleRegistration {
    let key: String
    var node = ItarNode()
    var mount: UInt64 = 0
    weak var target: ItarTargetHost?
    var available = false
    var bounds: CGRect?
    var scopeKey = ""
    init(_ key: String) { self.key = key }
}

@objc(ItarSurfaceHost)
public final class ItarSurfaceHost: UIView {
    private static var nextLifetime: UInt64 = 0
    private(set) var dispatcher: EngineDispatcher?
    var registrations: [String: AppleRegistration] = [:]
    var scopes: [String: AppleScopeRegistration] = [:]
    private var mountSequence: UInt64 = 0
    private var epoch: UInt64 = 1
    private var invalidatedEpoch: UInt64 = 0
    private var posted = false
    private var refreshing = false
    private var observers: [NSObjectProtocol] = []
    private var geometryObservers: [ObjectIdentifier: [NSKeyValueObservation]] = [:]
    private var movingViews = Set<UIView>()
    private var motionCheck: DispatchWorkItem?
    private var lastBounds = CGRect.null
    lazy var collections = AppleCollections(self)
    private lazy var collectionInput = CollectionInput(self)
    @objc public var collectionData = "" { didSet { if oldValue != collectionData { collections.configure(collectionData) } } }
    @objc public var onCollectionRecord: ((NSDictionary) -> Void)?
    @objc public func prepareCollection(_ payload: String) { collections.acknowledge(payload) }
    var preferredToken: ItarToken?
    var entryWork: DispatchWorkItem?
    weak var preferred: ItarTargetHost?
    var covered = false
    var presentation: ApplePresentation?
    var eventSequence: UInt64 = 0
    var commandRequests: [UInt64: String] = [:]
    @objc public var providerId = "" {
        didSet {
            guard oldValue != providerId else { return }
            if !oldValue.isEmpty {
                shutdown()
                if window != nil { start(); geometryChanged() }
            } else if dispatcher?.closed == false { surfaceRecord("ready") }
        }
    }
    @objc public var onSurfaceRecord: ((NSDictionary) -> Void)?
    @objc public var active = true { didSet { if oldValue != active { activityChanged() } } }
    @objc public var onFocusRecord: ((NSDictionary) -> Void)?
    @objc public var onRequestRecord: ((NSDictionary) -> Void)?
    var acceptsInput: Bool { active && !covered && dispatcher?.closed == false && window != nil }
    var lifetime: UInt64 { dispatcher?.connection.lifetime ?? 0 }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        isAccessibilityElement = false
        addGestureRecognizer(collectionInput)
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
        collectionInput.isEnabled = true
        let owner = EngineDispatcher(connection)
        dispatcher = owner
        owner.catalogued = { [weak self] in self?.collections.accept($0, status: $1) }
        owner.invoke = { [weak self] in self?.invoke($0) ?? 1 }
        owner.notify = { [weak self] in self?.deliver($0) }
        owner.requested = { [weak self] in self?.requestRecord($0) }
        owner.commandBegan = { [weak self] in self?.beganCommand($0, result: $1) }
        owner.commandRequest = { [weak self] command in self?.commandRequests.first { $0.value == command }?.key }
        owner.reconciled = { [weak self] active in
            guard let self else { return }
            self.collections.reconcile(active)
            for request in Array(self.commandRequests.keys) where request != active {
                self.requestRecord(ItarRequestResult(call: ITAR_OK, code: 9, request: request))
            }
        }
        owner.failed = { [weak self] in
            self?.collections.close()
            self?.surfaceRecord("disposed")
            self?.preferred = nil
            self?.preferredToken = nil
            self?.registrations.values.forEach { $0.available = false; $0.target?.restoreBaseStyle() }
        }
        surfaceRecord("ready")
        collections.configure(collectionData)
    }

    @objc public func shutdown() {
        entryWork?.cancel(); entryWork = nil
        if dispatcher?.closed == false { surfaceRecord("disposed") }
        collections.close()
        collectionInput.isEnabled = false
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
        scopes.values.forEach { $0.view?.owner = nil; $0.view?.registeredKey = "" }
        scopes.removeAll()
        commandRequests.removeAll()
        geometryObservers.removeAll()
        motionCheck?.cancel()
        motionCheck = nil
        movingViews.removeAll()
    }

    func beginCollectionDirection(_ direction: Int32) {
        guard acceptsInput, let dispatcher, !dispatcher.pumping else { return }
        commitGeometry()
        let now = dispatcher.clock()
        guard now <= UInt64.max - 3000 else { shutdown(); return }
        dispatcher.enqueue(.direction(direction, now, now + 3000))
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
        if let target = context.nextFocusedView as? ItarTargetHost, target.owner === self,
           let registration = target.registration {
            let dataset = collections.dataset, mount = registration.mount
            coordinator.addCoordinatedAnimations({}, completion: { [weak self, weak target] in
                guard let self, let target, target.registration === registration, registration.mount == mount else { return }
                self.collections.align(target, dataset: dataset)
            })
        }
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

    func descendants() -> (targets: [ItarTargetHost], scopes: [ItarScopeHost])? {
        var output: [ItarTargetHost] = []
        var groups: [ItarScopeHost] = []
        var pending = subviews
        var visited = 0
        while let view = pending.popLast() {
            visited += 1
            guard visited <= 4096, pending.count <= 4096 else { return nil }
            if let root = view as? ItarSurfaceHost, root !== self { continue }
            if let target = view as? ItarTargetHost {
                guard output.count + groups.count < 256 else { return nil }
                output.append(target)
                continue
            }
            if let scope = view as? ItarScopeHost {
                guard output.count + groups.count < 256 else { return nil }
                groups.append(scope)
            }
            let children = view.subviews
            guard pending.count + children.count <= 4096 else { return nil }
            pending.append(contentsOf: children)
        }
        return (output, groups)
    }

    func geometryChanged() {
        guard !refreshing, let dispatcher, !dispatcher.closed else { return }
        // A single layout pass can move many ancestors before the next commit.
        if invalidatedEpoch != epoch {
            invalidatedEpoch = epoch
            var invalidations: [(ItarNode, UInt64, Int32, UInt64)] = []
            for registration in registrations.values where registration.available {
                registration.available = false
                invalidations.append((registration.node, registration.mount, 1, epoch))
            }
            if !invalidations.isEmpty { dispatcher.enqueue(.invalidations(invalidations)) }
            preferred = nil
        }
        guard !posted else { return }
        posted = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.posted = false
            self.commitGeometry()
        }
    }

    // UIKit converts planar translations into surface coordinates. Other transforms
    // and partially clipped rectangles cannot be published as navigation bounds.
    func measured(_ target: ItarTargetHost) -> CGRect? {
        guard target.window === window, window != nil, target.targetEnabled,
              !target.label.isEmpty, !target.occurrenceKey.isEmpty else { return nil }
        var ancestor: UIView? = target
        while let view = ancestor {
            let transform = view.layer.transform
            guard !view.isHidden, view.alpha > 0.01, transform.m41.isFinite, transform.m42.isFinite,
                  CATransform3DEqualToTransform(transform, CATransform3DMakeTranslation(transform.m41, transform.m42, 0)),
                  (view === target || CATransform3DIsIdentity(view.layer.sublayerTransform)) else { return nil }
            if geometryIsMoving(view.layer) {
                if acceptsInput {
                    movingViews.insert(view)
                    scheduleMotionCheck()
                }
                return nil
            }
            // RN TV can leave painting unclipped. The scroll viewport still
            // bounds focus eligibility, independently of that drawing setting.
            if (view.clipsToBounds || view is UIScrollView) &&
                !view.bounds.contains(target.convert(target.bounds, to: view)) { return nil }
            if view === self { break }
            ancestor = view.superview
        }
        guard ancestor === self else { return nil }
        let rect = target.convert(target.bounds, to: self)
        guard rect.origin.x.isFinite, rect.origin.y.isFinite, rect.width.isFinite, rect.height.isFinite,
              rect.width > 0, rect.height > 0, bounds.contains(rect) else { return nil }
        return rect
    }

    // UIKit writes the destination to the model layer when an animation starts.
    // A focus request must wait until the rendered geometry reaches that position.
    private func geometryIsMoving(_ layer: CALayer) -> Bool {
        guard layer.animationKeys()?.isEmpty == false else { return false }
        guard let drawn = layer.presentation() else { return true }
        return drawn.position != layer.position || drawn.bounds != layer.bounds ||
            drawn.anchorPoint != layer.anchorPoint ||
            !CATransform3DEqualToTransform(drawn.transform, layer.transform) ||
            !CATransform3DEqualToTransform(drawn.sublayerTransform, layer.sublayerTransform)
    }

    // Finishing an animation does not write the model a second time. Check only
    // views with outstanding motion and stop as soon as their geometry settles.
    private func scheduleMotionCheck() {
        guard motionCheck == nil else { return }
        let check = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.motionCheck = nil
            guard self.acceptsInput, let window = self.window else { self.movingViews.removeAll(); return }
            let count = self.movingViews.count
            self.movingViews = self.movingViews.filter { $0.window === window && self.geometryIsMoving($0.layer) }
            if self.movingViews.count != count { self.geometryChanged() }
            if !self.movingViews.isEmpty { self.scheduleMotionCheck() }
        }
        motionCheck = check
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0 / 30, execute: check)
    }

    func live(_ registration: AppleRegistration) -> ItarTargetHost? {
        guard acceptsInput, registration.available, registration.node.slot != 0,
              registrations[registration.key] === registration, let target = registration.target,
              target.registration === registration, target.owner === self,
              scopeActive(registration.scopeKey),
              target.occurrenceKey == registration.key,
              collections.accepts(registration.key, dataset: target.collectionDataset, scope: false),
              collections.entry(registration.key)?.enabled != false,
              let bounds = registration.bounds, measured(target) == bounds else { return nil }
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
        guard let content = descendants() else { shutdown(); return }
        for view in content.scopes {
            guard collections.accepts(view.scopeKey, dataset: view.collectionDataset, scope: true) else { continue }
            if let entry = collections.entry(view.scopeKey), entry.parent != view.parentKey { continue }
            if !view.parentKey.isEmpty {
                guard let parent = content.scopes.first(where: { $0.scopeKey == view.parentKey }),
                      (parent.collectionDataset.isEmpty || parent.collectionDataset == view.collectionDataset),
                      collections.accepts(parent.scopeKey, dataset: parent.collectionDataset, scope: true) else { continue }
            }
            if view.owner !== self { view.owner?.dropScope(view); view.owner = self }
            guard !view.scopeKey.isEmpty else { shutdown(); return }
            let scope = scopes[view.scopeKey] ?? AppleScopeRegistration(view.scopeKey)
            if let existing = scope.view, existing !== view, existing.window != nil { shutdown(); return }
            if scope.node.slot == 0, collections.entry(scope.key) != nil {
                scope.node = (try? dispatcher.connection.find(scope.key)) ?? ItarNode()
            }
            scope.view = view
            scopes[view.scopeKey] = scope
            var record = ItarRecord()
            record.order = collections.entry(scope.key)?.order ?? 0
            record.scope = 1; record.active = view.active ? 1 : 0; record.enabled = 1
            record.entry_ready = view.entryReady ? 1 : 0
            record.restore_on_entry = view.restoreOnEntry ? 1 : 0
            record.layout = view.layout; record.boundary = view.boundary; record.trap = view.trap ? 1 : 0
            mutations.append(EngineMutation(kind: scope.node.slot == 0 ? 0 : 1, key: scope.key,
                parent: view.parentKey, expected: scope.node, record: record,
                preferred: scope.preferred == view.preferred || (scope.preferred == nil && view.preferred.isEmpty) ? nil : view.preferred))
        }
        var geometryViews: [ObjectIdentifier: UIView] = [:]
        for target in content.targets {
            var ancestor: UIView? = target
            while let view = ancestor, geometryViews[ObjectIdentifier(view)] == nil {
                geometryViews[ObjectIdentifier(view)] = view
                if view === self { break }
                ancestor = view.superview
            }
            if let old = target.logicalOwner, old !== self || target.logicalLifetime != lifetime { old.drop(target) }
            if target.owner !== self { target.owner?.detach(target); target.owner = self }
            if let old = target.registration, old.key != target.occurrenceKey { drop(target) }
            guard !target.occurrenceKey.isEmpty, target.occurrenceKey.utf8.count <= 512, !target.label.isEmpty else { continue }
            guard collections.accepts(target.occurrenceKey, dataset: target.collectionDataset, scope: false) else {
                target.isAccessibilityElement = false; detach(target); continue
            }
            if let entry = collections.entry(target.occurrenceKey), entry.parent != target.scopeKey {
                target.isAccessibilityElement = false; detach(target); continue
            }
            if !target.scopeKey.isEmpty {
                guard let parent = scopes[target.scopeKey]?.view, parent.owner === self,
                      parent.window === window, parent.nearestSurface() === self,
                      (parent.collectionDataset.isEmpty || parent.collectionDataset == target.collectionDataset),
                      collections.accepts(parent.scopeKey, dataset: parent.collectionDataset, scope: true) else {
                    target.isAccessibilityElement = false; detach(target); continue
                }
            }
            let registration = registrations[target.occurrenceKey] ?? AppleRegistration(target.occurrenceKey)
            if registration.node.slot == 0, collections.entry(target.occurrenceKey) != nil {
                registration.node = (try? dispatcher.connection.find(target.occurrenceKey)) ?? ItarNode()
            }
            if let existing = registration.target, existing !== target { shutdown(); return }
            if registration.target == nil {
                guard mountSequence < UInt64.max else { shutdown(); return }
                mountSequence += 1
                registration.mount = mountSequence
            }
            registration.target = target
            registration.scopeKey = target.scopeKey
            registrations[registration.key] = registration
            target.registration = registration
            var record = ItarRecord()
            record.order = collections.entry(target.occurrenceKey)?.order ?? target.order
            record.active = acceptsInput ? 1 : 0
            record.enabled = target.targetEnabled && (collections.entry(target.occurrenceKey)?.enabled ?? true) ? 1 : 0
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
                                             parent: target.scopeKey, expected: registration.node, record: record))
        }
        geometryObservers = geometryObservers.filter { geometryViews[$0.key] != nil }
        for (id, view) in geometryViews where geometryObservers[id] == nil {
            geometryObservers[id] = observeGeometry(of: view)
        }
        if !mutations.isEmpty { dispatcher.enqueue(.apply(mutations)) }
        guard !dispatcher.closed else { return }
        for scope in scopes.values {
            guard let node = try? dispatcher.connection.find(scope.key) else { shutdown(); return }
            scope.node = node
            scope.parent = scope.view?.parentKey ?? ""
            scope.preferred = scope.view?.preferred
            scope.view?.registeredKey = scope.key
        }
        for registration in registrations.values {
            guard let target = registration.target else { continue }
            guard let node = try? dispatcher.connection.find(registration.key) else { shutdown(); return }
            registration.node = node
            registration.available = node.slot != 0 && measured(target) != nil && acceptsInput && scopeActive(registration.scopeKey)
            target.logicalOwner = self
            target.logicalKey = registration.key
            target.logicalNode = node
            target.logicalMount = registration.mount
            target.logicalLifetime = lifetime
            target.isAccessibilityElement = !target.label.isEmpty
            target.applyFocusStyle()
        }
        observeCurrent()
        DispatchQueue.main.async { [weak self] in self?.collections.advance() }
    }

    // Moving a container does not lay out a child whose local bounds stayed the
    // same. Observe each shared ancestor once and use the usual batched refresh.
    private func observeGeometry(of view: UIView) -> [NSKeyValueObservation] {
        func observe<Value>(_ path: KeyPath<CALayer, Value>, equal: @escaping (Value, Value) -> Bool) -> NSKeyValueObservation {
            view.layer.observe(path, options: [.old, .new]) { [weak self] _, change in
                guard let old = change.oldValue, let new = change.newValue, !equal(old, new) else { return }
                self?.geometryChanged()
            }
        }
        var observations = [
            observe(\.position, equal: ==), observe(\.bounds, equal: ==), observe(\.anchorPoint, equal: ==),
            observe(\.transform, equal: CATransform3DEqualToTransform),
            observe(\.sublayerTransform, equal: CATransform3DEqualToTransform),
            observe(\.isHidden, equal: ==), observe(\.masksToBounds, equal: ==),
            observe(\.opacity, equal: { ($0 > 0.01) == ($1 > 0.01) })
        ]
        if let scroll = view as? UIScrollView {
            observations.append(scroll.observe(\.contentOffset, options: [.old, .new]) { [weak self] _, change in
                if change.oldValue != change.newValue { self?.geometryChanged() }
            })
        }
        return observations
    }

    func detach(_ target: ItarTargetHost) {
        guard let loss = detachMount(target) else { return }
        dispatcher?.enqueue(.invalidate(loss.node, loss.mount, 0, 0))
    }

    // Invalidate the native mapping immediately; callers may report several
    // losses in one bounded inbox event while a catalogue callback is active.
    func detachMount(_ target: ItarTargetHost) -> (node: ItarNode, mount: UInt64)? {
        guard let registration = target.registration, registration.target === target,
              registrations[registration.key] === registration, target.owner === self else { return nil }
        registration.available = false
        registration.target = nil
        if preferred === target { preferred = nil; preferredToken = nil }
        target.restoreBaseStyle()
        target.registration = nil
        target.owner = nil
        return (registration.node, registration.mount)
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
        if node.slot != 0 && collections.entry(key) == nil {
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
        guard now <= UInt64.max - 3000 else { shutdown(); return }
        dispatcher.enqueue(.request(key, 0, now, now + 3000))
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
        emitRequest(result, command: commandRequests[result.request] ?? "")
    }
    func deliver(_ value: ItarNotification) {
        let registration = registrations.values.first {
            $0.node.slot == value.focus.node.slot && $0.node.generation == value.focus.node.generation && $0.mount == value.focus.mount
        }
        if value.confirmed_request != 0 { pendingRequest = 0 }
        let kinds = ["managed", "unmanaged", "absent", "unknown"]
        if let record = stamp(["lifetime": String(lifetime), "request": String(value.confirmed_request),
            "occurrenceKey": registration?.key ?? "", "mount": String(value.focus.mount),
            "kind": kinds.indices.contains(Int(value.focus.kind)) ? kinds[Int(value.focus.kind)] : "unknown",
            "channel": value.channel == 0 ? "input" : "accessibility"]) { onFocusRecord?(record) }
    }
}
