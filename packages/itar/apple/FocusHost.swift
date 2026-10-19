import UIKit
import ItarEngineCore

extension ItarSurfaceHost {
    func preferredEnvironments() -> [UIFocusEnvironment] {
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning,
              let target = preferred, let registration = target.registration,
              live(registration) === target else { return [] }
        return [target]
    }

    // UIKit continues to choose mounted directional destinations. Preferences
    // implement explicit engine effects only; no swipe/press interception or
    // cross-platform directional parity is claimed by this subset.
    func allowsFocus(_ context: UIFocusUpdateContext) -> Bool {
        guard scopeAllows(context) else { return false }
        if let next = context.nextFocusedView as? ItarTargetHost, next.owner === self {
            guard acceptsInput else { return false }
            if UIAccessibility.isVoiceOverRunning { return true }
            guard let registration = next.registration else { return false }
            return live(registration) === next
        }
        return true
    }

    func observedFocus(_ context: UIFocusUpdateContext) {
        let next = context.nextFocusedView
        // Callback destination is the host fact, independent of the preference.
        if let next { dispatcher?.enqueue(.focus(classify(next), 0, nil)) }
        else { observeCurrent() } // A nil UIView is not proof that no non-view focus item exists.
        if next === preferred { preferred = nil; preferredToken = nil }
        if UIAccessibility.isVoiceOverRunning { observeCurrent() }
    }

    func invoke(_ effect: ItarEffect) -> Int32 {
        if effect.token.kind == 2 {
            if let token = preferredToken, token.request == effect.cancels.request,
               token.effect == effect.cancels.effect, token.lifetime == effect.cancels.lifetime {
                preferred = nil
                preferredToken = nil
            }
            return 5 // UIKit exposes no cancellation acknowledgment for an issued focus update.
        }
        guard effect.token.kind == 1, effect.surface == lifetime, acceptsInput,
              !UIAccessibility.isVoiceOverRunning,
              let registration = registrations.values.first(where: {
                  $0.node.slot == effect.target.slot && $0.node.generation == effect.target.generation && $0.mount == effect.mount
              }), let target = live(registration), let system = UIFocusSystem.focusSystem(for: self) else { return 1 }
        preferred = target
        preferredToken = effect.token
        system.requestFocusUpdate(to: self)
        system.updateFocusIfNeeded()
        // A queried result is observation; returning from UIKit is acceptance.
        observeCurrent()
        return 0
    }
}
