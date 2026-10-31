import UIKit
import ItarEngineCore

final class AppleScopeRegistration {
    let key: String
    var parent = ""
    var node = ItarNode()
    var preferred: String?
    weak var view: ItarScopeHost?
    init(_ key: String) { self.key = key }
}

@objc(ItarScopeHost)
public final class ItarScopeHost: UIView {
    weak var owner: ItarSurfaceHost?
    var scopeKey = ""
    @objc public var collectionDataset = "" { didSet { if oldValue != collectionDataset { nearestSurface()?.geometryChanged() } } }
    var parentKey = ""
    var active = true
    var layout: Int32 = 0
    var boundary: Int32 = 0
    var trap = false
    var entryReady = true
    @objc public var restoreOnEntry = false { didSet { if oldValue != restoreOnEntry { nearestSurface()?.geometryChanged() } } }
    var preferred = ""
    var registeredKey = ""
    @objc public func configure(_ key: String, parent: String, active: Bool, layout: Int32,
                                boundary: Int32, trap: Bool, entryReady: Bool, preferred: String) {
        let changed = scopeKey != key || parentKey != parent || self.active != active || self.layout != layout ||
            self.boundary != boundary || self.trap != trap || self.entryReady != entryReady || self.preferred != preferred
        if scopeKey != key { owner?.dropScope(self) }
        scopeKey = key
        parentKey = parent
        self.active = active
        self.layout = layout
        self.boundary = boundary
        self.trap = trap
        self.entryReady = entryReady
        self.preferred = preferred
        isAccessibilityElement = false
        accessibilityElementsHidden = !active
        if changed { nearestSurface()?.geometryChanged() }
    }
    func nearestSurface() -> ItarSurfaceHost? {
        var view = superview
        while let ancestor = view {
            if let root = ancestor as? ItarSurfaceHost { return root }
            view = ancestor.superview
        }
        return nil
    }
    public override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil { nearestSurface()?.geometryChanged() }
    }
    @objc public func recycle() { owner?.dropScope(self); owner = nil }
}

extension ItarSurfaceHost {
    // Reject UIKit's geometric entry before it highlights an unrelated menu item.
    // The next owner turn uses C++ history; never call UIKit recursively here.
    func redirectScopeEntry(from previous: ItarTargetHost, to next: ItarTargetHost) -> Bool {
        guard previous.owner === self, next.owner === self, previous.isFocused,
              !UIAccessibility.isVoiceOverRunning, let origin = previous.registration,
              live(origin) === previous, let dispatcher, !dispatcher.closed else { return false }
        var current = next.scopeKey
        for _ in 0...256 {
            if current.isEmpty || insideScope(previous.scopeKey, ancestor: current) { return false }
            guard let scope = scopes[current]?.view else { return false }
            if scope.restoreOnEntry && scope.entryReady && scopeActive(current) {
                entryWork?.cancel()
                let sequence = eventSequence, mount = origin.mount, now = dispatcher.clock(), destination = current
                guard now <= UInt64.max - 3000 else { return false }
                let work = DispatchWorkItem { [weak self, weak previous, weak scope] in
                    guard let self, let previous, let scope, self.eventSequence == sequence,
                          previous.isFocused, previous.registration?.mount == mount,
                          self.live(origin) === previous, scope.owner === self, scope.scopeKey == destination,
                          scope.restoreOnEntry, scope.entryReady, self.scopeActive(scope.scopeKey),
                          self.acceptsInput, !UIAccessibility.isVoiceOverRunning else { return }
                    self.entryWork = nil
                    self.commitGeometry()
                    let receivedAt = dispatcher.clock()
                    guard self.eventSequence == sequence, previous.isFocused, receivedAt < now + 3000 else { return }
                    dispatcher.enqueue(.restoreScope(destination, receivedAt, now + 3000))
                }
                entryWork = work
                DispatchQueue.main.async(execute: work)
                return true
            }
            current = scope.parentKey
        }
        return false
    }
    func scopeAllows(_ context: UIFocusUpdateContext) -> Bool {
        guard context.focusHeading != [], !UIAccessibility.isVoiceOverRunning,
              let previous = context.previouslyFocusedView as? ItarTargetHost, previous.owner === self,
              let registration = previous.registration, live(registration) != nil else { return true }
        let next = context.nextFocusedView as? ItarTargetHost
        var current = registration.scopeKey
        for _ in 0...256 {
            if current.isEmpty { return true }
            guard let scope = scopes[current]?.view else { return false }
            if scope.trap && !(next?.owner === self && insideScope(next?.scopeKey ?? "", ancestor: current)) { return false }
            current = scope.parentKey
        }
        return false
    }
    func scopeActive(_ key: String) -> Bool {
        var current = key
        for _ in 0...256 {
            if current.isEmpty { return true }
            guard let scope = scopes[current], let view = scope.view, view.active,
                  view.owner === self, window != nil, view.window === window, view.nearestSurface() === self,
                  collections.accepts(current, dataset: view.collectionDataset, scope: true) else { return false }
            current = view.parentKey
        }
        return false
    }
    func insideScope(_ key: String, ancestor: String) -> Bool {
        var current = key
        for _ in 0...256 {
            if current == ancestor { return true }
            if current.isEmpty { return false }
            guard let parent = scopes[current]?.view?.parentKey else { return false }
            current = parent
        }
        return false
    }
    func dropScope(_ view: ItarScopeHost) {
        let key = view.registeredKey.isEmpty ? view.scopeKey : view.registeredKey
        guard scopes[key]?.view === view else { return }
        func wasInside(_ child: String) -> Bool {
            var current = child
            for _ in 0...256 {
                if current == key { return true }
                if current.isEmpty { return false }
                guard let parent = scopes[current]?.parent else { return false }
                current = parent
            }
            return false
        }
        let retired = Set(scopes.keys.filter(wasInside))
        var mutations: [EngineMutation] = []
        for registration in Array(registrations.values) where retired.contains(registration.scopeKey) {
            if let target = registration.target { detach(target); target.clearLogicalIdentity() }
            if view.collectionDataset.isEmpty && registration.node.slot != 0 && collections.entry(registration.key) == nil {
                mutations.append(EngineMutation(kind: 3, key: registration.key, expected: registration.node))
            }
            registrations.removeValue(forKey: registration.key)
        }
        for key in retired {
            guard let scope = scopes.removeValue(forKey: key) else { continue }
            scope.view?.owner = nil
            scope.view?.registeredKey = ""
            if view.collectionDataset.isEmpty && scope.node.slot != 0 && collections.entry(key) == nil { mutations.append(EngineMutation(kind: 3, key: key, expected: scope.node)) }
        }
        if !mutations.isEmpty { dispatcher?.enqueue(.apply(mutations)) }
    }
}
