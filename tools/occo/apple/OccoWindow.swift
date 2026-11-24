#if ITAR_OCCO
import UIKit

/// Observes only the remote events that UIKit delivers to Cinema.
public final class ItarOccoWindow: UIWindow {
    public override func sendEvent(_ event: UIEvent) {
        guard let record = ItarFocusTrace.receive, let event = event as? UIPressesEvent else {
            super.sendEvent(event)
            return
        }
        Self.forward(event.allPresses, recording: record) { super.sendEvent(event) }
    }

    static func forward(_ presses: Set<UIPress>, recording record: ([String: Any]) -> Void, dispatch: () -> Void) {
        var finished: [(UIPress, UInt64)] = []
        for press in presses {
            guard let direction = ItarFocusTrace.direction(for: press) else { continue }
            let detail: String
            switch press.phase {
            case .began: detail = "window down"
            case .ended: detail = "window up"
            case .cancelled: detail = "window cancelled"
            default: continue
            }
            let move = ItarFocusTrace.move(for: press)
            if press.phase == .ended || press.phase == .cancelled { finished.append((press, move)) }
            record(["kind": "input", "direction": direction, "detail": detail, "move": move])
        }

        // Responders can see the down before this window, or handle the up
        // inside UIKit dispatch. Both boundaries must refer to the same move.
        dispatch()
        for (press, move) in finished { ItarFocusTrace.finish(press, move: move) }
    }
}
#endif
