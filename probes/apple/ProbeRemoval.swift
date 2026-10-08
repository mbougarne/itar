import UIKit

enum ProbeRemoval: CaseIterable { case remove, hide, disable, clip, reuse, replace, all }

extension ProbeRoot {
    // Prevention candidate: one synchronous transfer, zero retained views/timers.
    // If UIKit does not confirm B before return, leave A intact and report failure.
    @discardableResult func disappear(_ action: ProbeRemoval, transferFirst: Bool = false) -> Bool {
        guard !dispatcher.closed, !dispatcher.active else { return false }
        snapshot("before-removal \(action)")
        if transferFirst {
            request(b)
            guard b.isFocused else {
                record("prevention unconfirmed; removal cancelled")
                return false
            }
        }
        live.remove(1) // Native authority is revoked before any host mutation.
        dispatcher.invalidate(1)
        switch action {
        case .remove: a.removeFromSuperview()
        case .hide: a.isHidden = true
        case .disable: a.isEnabled = false
        case .clip:
            clipsToBounds = true
            a.frame.origin.x = -a.frame.width - 10
        case .reuse, .replace:
            a.removeFromSuperview()
            let generation = connection.generation + 1
            dispatcher.close()
            dispatcher = ProbeDispatcher(ProbeConnection(generation: generation))
            a.setTitle("A: replacement", for: .normal)
            a.accessibilityLabel = "A: replacement"
            addSubview(a)
            live = [1, 2]
        case .all:
            live.remove(2)
            dispatcher.invalidate(2)
            a.removeFromSuperview()
            b.removeFromSuperview()
        }
        setNeedsFocusUpdate()
        updateFocusIfNeeded()
        snapshot("after-removal")
        DispatchQueue.main.async { [weak self] in self?.snapshot("after-layout") }
        return true
    }
}
