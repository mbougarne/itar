import UIKit
import ItarEngineCore

final class AppleScopeRegistration {
    let key: String
    var parent = ""
    var node = ItarNode()
    weak var view: ItarScopeHost?
    init(_ key: String) { self.key = key }
}

@objc(ItarScopeHost)
public final class ItarScopeHost: UIView {
    weak var owner: ItarSurfaceHost?
    var scopeKey = ""
    var parentKey = ""
    var active = true
    var layout: Int32 = 0
    var boundary: Int32 = 0
    var trap = false
    var entryReady = true
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
            guard let scope = scopes[current], let view = scope.view, view.active else { return false }
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
            if registration.node.slot != 0 {
                mutations.append(EngineMutation(kind: 3, key: registration.key, expected: registration.node))
            }
            registrations.removeValue(forKey: registration.key)
        }
        for key in retired {
            guard let scope = scopes.removeValue(forKey: key) else { continue }
            scope.view?.owner = nil
            scope.view?.registeredKey = ""
            if scope.node.slot != 0 { mutations.append(EngineMutation(kind: 3, key: key, expected: scope.node)) }
        }
        if !mutations.isEmpty { dispatcher?.enqueue(.apply(mutations)) }
    }
}
