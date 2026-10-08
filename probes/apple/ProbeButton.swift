import UIKit

final class ProbeButton: UIButton {
    var baseBorder: UIColor = .darkGray { didSet { applyBorder() } }
    var focusBorder: UIColor = .systemOrange { didSet { applyBorder() } }
    var canActivate: () -> Bool = { false }
    var activation: ((String) -> Void)?
    private(set) var activations = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityTraits = .button
        isAccessibilityElement = true
        addTarget(self, action: #selector(selected), for: .primaryActionTriggered)
        applyBorder()
    }
    required init?(coder: NSCoder) { fatalError("Programmatic probe only") }
    func applyBorder() {
        layer.borderWidth = isFocused ? 5 : 1
        layer.borderColor = (isFocused ? focusBorder : baseBorder).cgColor
    }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        // Border only: UIKit retains its native scale/parallax and navigation bounds.
        if UIAccessibility.isReduceMotionEnabled { applyBorder() }
        else { coordinator.addCoordinatedAnimations({ self.applyBorder() }, completion: nil) }
    }
    @discardableResult func activate(_ origin: String) -> Bool {
        guard isEnabled, !isHidden, window != nil, canActivate() else { return false }
        activations += 1
        activation?(origin)
        return true
    }
    @objc private func selected() { _ = activate("primary-action") }
    override func accessibilityActivate() -> Bool { activate("accessibility") }
    func resetForReuse() { layer.borderColor = baseBorder.cgColor; layer.borderWidth = 1 }
}
