#if ITAR_OCCO
import UIKit
import ItarEngineCore

// Compiled only in Cinema's instrumented development pod. The UI thread owns
// the sink and identifiers. A snapshot contains values, never a UIKit object.
enum ItarFocusTrace {
    static var receive: (([String: Any]) -> Void)? {
        didSet { presses.removeAll(keepingCapacity: true) }
    }
    private static var sequence: UInt64 = 0
    private struct SeenPress {
        weak var press: UIPress?
        let sequence: UInt64
    }
    private static var presses: [SeenPress] = []
    static func move(for press: UIPress) -> UInt64 {
        guard receive != nil else { return 0 }
        presses.removeAll { $0.press == nil }
        if let existing = presses.first(where: { $0.press === press }) { return existing.sequence }
        // A full table leaves new presses unlinked rather than conflating two presses.
        guard presses.count < 128, sequence < UInt64.max else { return 0 }
        sequence += 1
        presses.append(SeenPress(press: press, sequence: sequence))
        return sequence
    }
    static func finish(_ press: UIPress, move: UInt64) {
        // UIKit can reuse the same UIPress instance for the next physical key.
        // A delayed dispatch cleanup must never remove a newer move's mapping.
        presses.removeAll { $0.press === press && $0.sequence == move }
    }

    static func direction(for press: UIPress) -> String? {
        switch press.type {
        case .leftArrow: return "left"
        case .rightArrow: return "right"
        case .upArrow: return "up"
        case .downArrow: return "down"
        case .select: return "select"
        default: return nil
        }
    }
    static func direction(_ heading: UIFocusHeading) -> String? {
        switch heading {
        case .left: return "left"
        case .right: return "right"
        case .up: return "up"
        case .down: return "down"
        default: return nil
        }
    }

    static func destination(_ item: Any, on surface: ItarSurfaceHost) -> [String: Any] {
        let view = item as? UIView
        let element = item as? UIAccessibilityElement
        let traits = view?.accessibilityTraits ?? element?.accessibilityTraits ?? []
        let role: String
        switch item {
        case is UITextField, is UITextView: role = "text input"
        case is UIButton: role = "button"
        case is UILabel: role = "text"
        case is UIImageView: role = "image"
        case is UITableView: role = "list"
        case is UICollectionView: role = "grid"
        case let scroll as UIScrollView:
            role = scroll.contentSize.width > scroll.bounds.width && scroll.contentSize.height <= scroll.bounds.height
                ? "horizontal scroll view" : scroll.contentSize.height > scroll.bounds.height ? "vertical scroll view" : "container"
        default:
            if traits.contains(.button) { role = "button" }
            else if traits.contains(.adjustable) { role = "slider" }
            else if traits.contains(.image) { role = "image" }
            else if traits.contains(.staticText) { role = "text" }
            else { role = view == nil ? "unknown" : "view" }
        }
        var result: [String: Any] = ["role": role]
        guard let window = surface.window else { return result }
        let frame: CGRect
        if let view, view.window === window {
            frame = view.convert(view.bounds, to: window.screen.coordinateSpace)
        } else if let element {
            frame = element.accessibilityFrame
        } else { return result }
        let scale = window.screen.scale
        let edges = [floor(frame.minX * scale), floor(frame.minY * scale),
                     ceil(frame.maxX * scale), ceil(frame.maxY * scale)]
        if !frame.isEmpty && edges.allSatisfy({ $0.isFinite && $0 >= CGFloat(Int32.min) && $0 <= CGFloat(Int32.max) }) {
            result["bounds"] = ["left": Int(edges[0]), "top": Int(edges[1]), "right": Int(edges[2]), "bottom": Int(edges[3])]
        }
        return result
    }
}

extension ItarSurfaceHost {
    // Emit only an actually observed callback. Matching an old preference or
    // pending request is not sufficient evidence to correlate an observation.
    func traceVoiceOverNotification(_ notification: Notification) {
        let item = notification.userInfo?[UIAccessibility.focusedElementUserInfoKey]
        if let technology = notification.userInfo?[UIAccessibility.assistiveTechnologyUserInfoKey] as? String {
            guard technology == UIAccessibility.AssistiveTechnologyIdentifier.notificationVoiceOver.rawValue else { return }
        } else {
            // A process-wide notification without a technology can belong to another
            // reader. Accept only the exact element independently reported by VoiceOver.
            guard let item, let current = UIAccessibility.focusedElement(using: .notificationVoiceOver),
                  item as AnyObject === current as AnyObject else { return }
        }
        traceObservation(item, channel: "accessibility")
    }

    func traceObservation(_ item: Any?, channel: String) {
        guard let emit = ItarFocusTrace.receive, lifetime != 0 else { return }
        let kind = classify(item).kind
        var event: [String: Any] = ["kind": "observation", "surface": lifetime, "channel": channel]
        if kind == 0, let registration = (item as? ItarTargetHost)?.registration {
            event["target"] = registration.key; event["mount"] = registration.mount
            event["detail"] = "callback: managed"
        } else if let item {
            event["detail"] = "callback: unmanaged"
            event["nativeDestination"] = ItarFocusTrace.destination(item, on: self)
        } else {
            event["detail"] = "callback: unknown"
        }
        emit(event)
    }

    func traceEffect(_ effect: ItarEffect, kind: String, detail: String) {
        guard let emit = ItarFocusTrace.receive else { return }
        var event: [String: Any] = ["kind": kind, "surface": lifetime, "request": effect.token.request,
                                    "effect": effect.token.effect, "mount": effect.mount, "detail": detail]
        let registration = registrations.values.first {
            $0.node.slot == effect.target.slot && $0.node.generation == effect.target.generation &&
            (effect.mount == 0 || effect.mount == $0.mount)
        }
        event["target"] = registration?.key ?? collections.entry(effect.target)?.key
        emit(event)
    }
}
#endif
