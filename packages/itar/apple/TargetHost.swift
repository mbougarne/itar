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
    @objc public var collectionDataset = "" { didSet { if oldValue != collectionDataset { semanticsChanged() } } }
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
    @objc public var cornerRadius: CGFloat = 6 { didSet { applyFocusStyle() } }
    private let focusFill = CAShapeLayer()
    @objc public var focusBackgroundColor: UIColor? { didSet { applyFocusStyle() } }
    private let cardOutline = CAShapeLayer()
    @objc public var displayLabel = "" { didSet { setTitle(displayLabel, for: .normal) } }
    @objc public var labelPlacement = "center" { didSet { contentVerticalAlignment = labelPlacement.hasPrefix("bottom") ? .bottom : .center; contentHorizontalAlignment = labelPlacement == "bottom" ? .leading : .center } }
    @objc public var labelSize: CGFloat = 14 { didSet { titleLabel?.font = UIFontMetrics.default.scaledFont(for: .systemFont(ofSize: labelSize > 0 ? labelSize : 14, weight: .semibold)) } }
    @objc public var outlineInsetBottom: CGFloat = 0 { didSet { applyFocusStyle() } }
    @objc public var label = "" {
        didSet {
            accessibilityLabel = label
            isAccessibilityElement = !label.isEmpty
            if oldValue != label { setTitle(displayLabel.isEmpty ? label : displayLabel, for: .normal); semanticsChanged() }
        }
    }
    @objc public var order: Int32 = 0 { didSet { if oldValue != order { semanticsChanged() } } }
    @objc public var targetEnabled = true {
        didSet {
            isEnabled = targetEnabled
            updateTraits()
            if oldValue != targetEnabled { semanticsChanged() }
        }
    }
    @objc public var baseColor: UIColor? { didSet { applyFocusStyle() } }
    @objc public var focusColor: UIColor? { didSet { applyFocusStyle() } }
    @objc public var adjustable = false { didSet { updateTraits() } }
    private func updateTraits() {
        accessibilityTraits = adjustable ? [.adjustable] : [.button]
        if !targetEnabled { accessibilityTraits.insert(.notEnabled) }
    }
    @objc public var onAdjust: ((NSDictionary) -> Void)?
    @discardableResult func adjust(_ delta: Int, source: String = "input") -> Bool {
        guard adjustable, targetEnabled, let owner, owner.acceptsInput,
              let registration, owner.live(registration) === self,
              sequence < UInt64.max, delta == -1 || delta == 1 else { return false }
        if source == "input" {
            guard isFocused, !UIAccessibility.isVoiceOverRunning,
                  (UIFocusSystem.focusSystem(for: self)?.focusedItem as? UIView) === self else { return false }
        }
        sequence += 1
        onAdjust?(["lifetime": String(owner.lifetime), "provider": owner.providerId,
                   "registration": registrationId, "occurrenceKey": registration.key,
                   "mount": String(registration.mount), "sequence": String(sequence), "source": source, "delta": String(delta)])
        return true
    }
    public override func accessibilityIncrement() { _ = adjust(1, source: "accessibility") }
    public override func accessibilityDecrement() { _ = adjust(-1, source: "accessibility") }
    public override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.count == 1, let type = presses.first?.type,
           (type == .leftArrow || type == .rightArrow), adjust(type == .leftArrow ? -1 : 1) { return }
        super.pressesBegan(presses, with: event)
    }
    @objc public var onActivate: ((NSDictionary) -> Void)?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        layer.insertSublayer(focusFill, at: 0)
        layer.addSublayer(cardOutline)
        cardOutline.fillColor = UIColor.clear.cgColor
        isAccessibilityElement = false
        accessibilityTraits = .button
        titleLabel?.adjustsFontForContentSizeCategory = true
        addTarget(self, action: #selector(selected), for: .primaryActionTriggered)
        applyFocusStyle()
    }
    public required init?(coder: NSCoder) { fatalError("Use the native component") }
    public override var canBecomeFocused: Bool {
        guard let owner, let registration else { return false }
        return owner.live(registration) === self || owner.collections.retained(registration)
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
        applyFocusStyle()
        if let owner { owner.targetLayoutChanged(self) } else { nearestSurface()?.geometryChanged() }
    }
    public override var isHidden: Bool { didSet { if oldValue != isHidden { semanticsChanged() } } }
    public override var alpha: CGFloat { didSet { if oldValue != alpha { semanticsChanged() } } }

    func applyFocusStyle() {
        let focused = isFocused && window != nil && owner?.dispatcher?.closed == false && registration?.target === self
        let radius = cornerRadius.isFinite ? max(0, cornerRadius) : 6
        layer.cornerRadius = radius
        clipsToBounds = true
        focusFill.path = UIBezierPath(roundedRect: bounds, cornerRadius: radius).cgPath
        focusFill.fillColor = (focusBackgroundColor ?? .clear).cgColor
        focusFill.isHidden = !focused
        let card = outlineInsetBottom > 0
        cardOutline.isHidden = !card || !focused
        cardOutline.path = UIBezierPath(roundedRect: CGRect(x: 2, y: 2, width: max(0, bounds.width - 4), height: max(0, bounds.height - outlineInsetBottom - 4)), cornerRadius: radius).cgPath
        cardOutline.lineWidth = 4
        cardOutline.strokeColor = (focusColor ?? .cyan).cgColor
        layer.borderWidth = card ? 0 : focused ? 5 : 1
        layer.borderColor = (focused ? focusColor ?? .systemOrange : baseColor ?? .darkGray).cgColor
    }
    func restoreBaseStyle() {
        focusFill.isHidden = true
        cardOutline.isHidden = true
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
        onAdjust = nil
    }
    func clearLogicalIdentity() {
        logicalOwner = nil
        logicalKey = nil
        logicalNode = ItarNode()
        logicalMount = 0
        logicalLifetime = 0
    }
}
