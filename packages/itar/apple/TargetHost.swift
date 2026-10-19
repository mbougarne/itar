import UIKit
import ItarEngineCore

@objc(ItarTargetHost)
public final class ItarTargetHost: UIButton {
    weak var owner: ItarSurfaceHost?
    var registration: AppleRegistration?
    weak var logicalOwner: ItarSurfaceHost?
    var logicalKey: String?
    var logicalNode = ItarNode()
    var logicalMount: UInt64 = 0
    var logicalLifetime: UInt64 = 0
    private var sequence: UInt64 = 0
    @objc public var scopeKey = "" { didSet { if oldValue != scopeKey { semanticsChanged() } } }
    @objc public var registrationId = ""
    @objc public var occurrenceKey = "" {
        didSet {
            if oldValue != occurrenceKey {
                (logicalOwner ?? owner)?.drop(self)
                nearestSurface()?.geometryChanged()
            }
        }
    }
    @objc public var label = "" {
        didSet {
            accessibilityLabel = label
            isAccessibilityElement = !label.isEmpty
            if oldValue != label { setTitle(label, for: .normal); semanticsChanged() }
        }
    }
    @objc public var order: Int32 = 0 { didSet { if oldValue != order { semanticsChanged() } } }
    @objc public var targetEnabled = true {
        didSet {
            isEnabled = targetEnabled
            accessibilityTraits = targetEnabled ? [.button] : [.button, .notEnabled]
            if oldValue != targetEnabled { semanticsChanged() }
        }
    }
    @objc public var baseColor: UIColor? { didSet { applyFocusStyle() } }
    @objc public var focusColor: UIColor? { didSet { applyFocusStyle() } }
    @objc public var onActivate: ((NSDictionary) -> Void)?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        isAccessibilityElement = false
        accessibilityTraits = .button
        addTarget(self, action: #selector(selected), for: .primaryActionTriggered)
        applyFocusStyle()
    }
    public required init?(coder: NSCoder) { fatalError("Use the native component") }
    public override var canBecomeFocused: Bool {
        guard let owner, let registration else { return false }
        return owner.live(registration) === self
    }
    func nearestSurface() -> ItarSurfaceHost? {
        var view = superview
        while let ancestor = view {
            if let owner = ancestor as? ItarSurfaceHost { return owner }
            view = ancestor.superview
        }
        return nil
    }
    func semanticsChanged() { (owner ?? nearestSurface())?.geometryChanged() }
    public override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { owner?.detach(self) }
        else { nearestSurface()?.geometryChanged() }
    }
    public override func didMoveToSuperview() {
        super.didMoveToSuperview()
        if owner !== nearestSurface() { owner?.detach(self) }
        nearestSurface()?.geometryChanged()
    }
    public override func layoutSubviews() {
        super.layoutSubviews()
        if let owner { owner.targetLayoutChanged(self) } else { nearestSurface()?.geometryChanged() }
    }
    public override var isHidden: Bool { didSet { if oldValue != isHidden { semanticsChanged() } } }
    public override var alpha: CGFloat { didSet { if oldValue != alpha { semanticsChanged() } } }

    func applyFocusStyle() {
        let focused = isFocused && window != nil && owner?.dispatcher?.closed == false && registration?.target === self
        layer.borderWidth = focused ? 5 : 1
        layer.borderColor = (focused ? focusColor ?? .systemOrange : baseColor ?? .darkGray).cgColor
    }
    func restoreBaseStyle() {
        layer.borderWidth = 1
        layer.borderColor = (baseColor ?? .darkGray).cgColor
    }
    public override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        // Border only: layout bounds and UIKit's own scale/parallax are unchanged.
        if UIAccessibility.isReduceMotionEnabled { applyFocusStyle() }
        else { coordinator.addCoordinatedAnimations({ self.applyFocusStyle() }, completion: nil) }
    }
    @discardableResult func activate(_ source: String) -> Bool {
        guard let owner, let registration, owner.live(registration) === self,
              !label.isEmpty, targetEnabled, sequence < UInt64.max else { return false }
        if source == "input" {
            guard isFocused, (UIFocusSystem.focusSystem(for: self)?.focusedItem as? UIView) === self else { return false }
        }
        sequence += 1
        onActivate?(["lifetime": String(owner.lifetime), "provider": owner.providerId,
                     "registration": registrationId, "occurrenceKey": registration.key,
                     "mount": String(registration.mount), "sequence": String(sequence), "source": source])
        return true
    }
    @objc private func selected() { _ = activate("input") }
    public override func accessibilityActivate() -> Bool { activate("accessibility") }
    @objc public func recycle() {
        (logicalOwner ?? owner)?.drop(self)
        clearLogicalIdentity()
        restoreBaseStyle()
        onActivate = nil
    }
    func clearLogicalIdentity() {
        logicalOwner = nil
        logicalKey = nil
        logicalNode = ItarNode()
        logicalMount = 0
        logicalLifetime = 0
    }
}
