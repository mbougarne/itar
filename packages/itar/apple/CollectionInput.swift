import UIKit

// Discrete remote arrows are claimed only for unrealized collection moves.
// Ready destinations, other controls and accessibility retain UIKit ownership.
final class CollectionInput: UITapGestureRecognizer, UIGestureRecognizerDelegate {
    private weak var root: ItarSurfaceHost?
    private var direction: Int32?
    #if ITAR_OCCO
    private var move: UInt64 = 0
    #endif
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
        #if ITAR_OCCO
        move = ItarFocusTrace.move(for: press)
        if let emit = ItarFocusTrace.receive, let root, let name = ItarFocusTrace.direction(for: press) {
            var event: [String: Any] = ["kind": "input", "surface": root.lifetime, "move": move,
                                        "direction": name, "detail": "surface down"]
            // Seeing a key with VoiceOver on does not identify who handled it.
            if direction != nil { event["owner"] = "engine" }
            else if !UIAccessibility.isVoiceOverRunning { event["owner"] = "host" }
            emit(event)
        }
        #endif
        return direction != nil
    }
    @objc private func received() {
        guard state == .ended, let direction else { return }
        #if ITAR_OCCO
        root?.beginCollectionDirection(direction, move: move)
        #else
        root?.beginCollectionDirection(direction)
        #endif
        root?.dispatcher?.enqueue(.releaseInput)
    }
}
