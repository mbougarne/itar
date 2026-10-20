import UIKit

// Discrete remote arrows are claimed only for unrealized collection moves.
// Ready destinations, other controls and accessibility retain UIKit ownership.
final class CollectionInput: UITapGestureRecognizer, UIGestureRecognizerDelegate {
    private weak var root: ItarSurfaceHost?
    private var direction: Int32?
    init(_ root: ItarSurfaceHost) {
        self.root = root
        super.init(target: nil, action: nil)
        delegate = self
        allowedPressTypes = [UIPress.PressType.leftArrow, .rightArrow, .upArrow, .downArrow].map { NSNumber(value: $0.rawValue) }
        cancelsTouchesInView = true
        addTarget(self, action: #selector(received))
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive press: UIPress) -> Bool {
        direction = root?.collectionDirection([press])
        return direction != nil
    }
    @objc private func received() {
        guard state == .ended, let direction else { return }
        root?.beginCollectionDirection(direction)
        root?.dispatcher?.enqueue(.releaseInput)
    }
}
