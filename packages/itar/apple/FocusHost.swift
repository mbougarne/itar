import UIKit
import ItarEngineCore

extension ItarSurfaceHost {
    func preferredEnvironments() -> [UIFocusEnvironment] {
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning,
              let target = preferred, let registration = target.registration,
              live(registration) === target else { return [] }
        return [target]
    }

    // UIKit chooses mounted destinations. Only cold collection arrow requests
    // use scoped press ownership; swipe/momentum parity requires separate evidence.
    func allowsFocus(_ context: UIFocusUpdateContext) -> Bool {
        // Swipes propose a UIKit focus update; adjustment keeps the same target.
        if !UIAccessibility.isVoiceOverRunning, let source = context.previouslyFocusedView as? ItarTargetHost,
           source.owner === self, source.adjustable,
           (context.focusHeading == .left || context.focusHeading == .right),
           source.adjust(context.focusHeading == .left ? -1 : 1) { return false }
        guard scopeAllows(context) else { return false }
        if let previous = context.previouslyFocusedView as? ItarTargetHost,
           let next = context.nextFocusedView as? ItarTargetHost, context.focusHeading != [] {
            if let allowed = allowCollectionEntry(from: previous, to: next, heading: context.focusHeading) {
                if !allowed { return false }
            } else if redirectScopeEntry(from: previous, to: next) { return false }
        }
        if context.focusHeading != [], !UIAccessibility.isVoiceOverRunning,
           pendingRequest != 0,
           let source = context.previouslyFocusedView as? ItarTargetHost,
           let registration = source.registration, collections.entry(registration.key) != nil,
           live(registration) === source || collections.retained(registration), context.nextFocusedView !== preferred {
            return context.nextFocusedView === source
        }
        if let next = context.nextFocusedView as? ItarTargetHost, next.owner === self {
            guard acceptsInput else { return false }
            if UIAccessibility.isVoiceOverRunning { return true }
            guard let registration = next.registration else { return false }
            return live(registration) === next && next.allowsHostEntry
        }
        return true
    }

    func observedFocus(_ context: UIFocusUpdateContext) {
        entryWork?.cancel(); entryWork = nil
        let next = context.nextFocusedView
        // Callback destination is the host fact, independent of the preference.
        if let next { dispatcher?.enqueue(.focus(classify(next), 0, nil)) }
        else { observeCurrent() } // A nil UIView is not proof that no non-view focus item exists.
        if next === preferred { preferred = nil; preferredToken = nil }
        if UIAccessibility.isVoiceOverRunning { observeCurrent() }
    }

    func invoke(_ effect: ItarEffect) -> Int32 {
        if effect.token.kind == 0 { return collections.invoke(effect) }
        if effect.token.kind == 2 {
            if collections.cancel(effect) { return 3 }
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
