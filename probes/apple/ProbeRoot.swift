import UIKit
import React

final class ProbeRoot: UIView {
    var dispatcher = ProbeDispatcher(ProbeConnection())
    var connection: ProbeConnection { dispatcher.connection }
    var callbackAction: (() -> Void)?
    let a = ProbeButton(type: .system)
    let b = ProbeButton(type: .system)
    let d = UIButton(type: .system)
    let status = UILabel()
    let guide = UIFocusGuide()
    weak var preferred: UIView?
    var constrained = false
    var events: [String] = []
    var overflow = false
    var live: Set<UInt32> = [1, 2]
    var suspended = false
    @objc var onNativeActivation: RCTDirectEventBlock?

    override init(frame: CGRect) {
        super.init(frame: frame)
        for (button, title, rect) in [
            (a, "A: source", CGRect(x: 0, y: 140, width: 260, height: 65)),
            (b, "B: destination", CGRect(x: 0, y: 20, width: 260, height: 65)),
            (d, "D: unrelated", CGRect(x: 370, y: 140, width: 280, height: 65))
        ] {
            button.frame = rect
            button.setTitle(title, for: .normal)
            button.accessibilityIdentifier = String(title.prefix(1))
            button.accessibilityLabel = title
            addSubview(button)
        }
        for (button, slot) in [(a, UInt32(1)), (b, UInt32(2))] {
            button.canActivate = { [weak self] in
                guard let self else { return false }
                return self.live.contains(slot) && !self.dispatcher.closed && !self.suspended
            }
            button.activation = { [weak self] origin in
                guard let self else { return }
                let alias = slot == 1 ? "A" : "B"
                self.record("activation=\(alias) origin=\(origin) inputUnchanged")
                self.onNativeActivation?(["target": alias])
            }
        }
        status.frame = CGRect(x: 0, y: 220, width: 700, height: 40)
        status.font = .systemFont(ofSize: 18)
        addSubview(status)
        addLayoutGuide(guide)
        NSLayoutConstraint.activate([
            guide.leadingAnchor.constraint(equalTo: b.trailingAnchor),
            guide.topAnchor.constraint(equalTo: b.topAnchor),
            guide.widthAnchor.constraint(equalToConstant: 100),
            guide.heightAnchor.constraint(equalTo: b.heightAnchor)
        ])
        guide.preferredFocusEnvironments = [b]
        preferred = a
        let result = connection.query(slot: 1, direction: 0)
        record("roundtrip status=\(result.status) slot=\(result.slot)")
    }
    required init?(coder: NSCoder) { fatalError("Programmatic probe only") }
    override var preferredFocusEnvironments: [UIFocusEnvironment] {
        if let target = preferred, target.window != nil, !target.isHidden { return [target] }
        return super.preferredFocusEnvironments
    }
    func alias(_ view: UIView?) -> String {
        guard let view else { return "absent" }
        if view === a && live.contains(1) { return "managed:A:g\(connection.generation)" }
        if view === b && live.contains(2) { return "managed:B:g\(connection.generation)" }
        return "unmanaged:\(view === d ? "D" : "native")"
    }
    func record(_ event: String) {
        guard !overflow else { return }
        guard events.count < 256 else {
            overflow = true
            dispatcher.close()
            status.text = "INCONCLUSIVE: trace overflow"
            NSLog("ItarApple INCONCLUSIVE trace overflow")
            return
        }
        let row = "\(events.count) t=\(ProcessInfo.processInfo.systemUptime) \(event)"
        events.append(row)
        NSLog("ItarApple %@", row)
        status.text = event
    }
    func snapshot(_ boundary: String) {
        guard window != nil else { record("\(boundary) input=unknown detached"); return }
        guard let system = UIFocusSystem.focusSystem(for: self) else {
            record("\(boundary) input=unknown no-focus-system")
            return
        }
        let focused = system.focusedItem
        let input = focused == nil ? "absent" : (focused as? UIView).map(alias) ?? "unmanaged:non-view"
        let accessibility = UIAccessibility.focusedElement(using: .notificationVoiceOver) as? UIView
        record("\(boundary) input=\(input) a11y=\(UIAccessibility.isVoiceOverRunning ? alias(accessibility) : "off")")
    }
    func request(_ target: UIView) {
        guard !dispatcher.closed, !dispatcher.active, !overflow, !suspended, target.window != nil, !target.isHidden else { return }
        preferred = target
        record("host-enter preference=\(alias(target))")
        dispatcher.invoke {
            setNeedsFocusUpdate()
            updateFocusIfNeeded()
            snapshot("host-return")
        }
        preferred = nil
    }
    override func shouldUpdateFocus(in context: UIFocusUpdateContext) -> Bool {
        // UIKit owns input; no press interception and no JavaScript approval.
        guard !UIAccessibility.isVoiceOverRunning, !suspended, !overflow else { return true }
        let slot: UInt32 = context.previouslyFocusedView === a ? 1 : context.previouslyFocusedView === b ? 2 : 0
        let direction: Int32 = context.focusHeading.contains(.up) ? 0 : context.focusHeading.contains(.down) ? 1 : -1
        if slot != 0 && direction >= 0 {
            let result = dispatcher.query(slot: slot, direction: direction)
            record("proposal status=\(result.status) slot=\(result.slot) UIKit=\(alias(context.nextFocusedView)) owner=UIKit")
        }
        // An opt-in A/B scope boundary; never veto removal or reader updates.
        return !(constrained && slot != 0 && context.nextFocusedView === d && context.focusHeading != [])
    }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        record("callback \(alias(context.previouslyFocusedView))->\(alias(context.nextFocusedView))")
        record("callback timing=\(dispatcher.active ? "inline" : "deferred")")
        dispatcher.observe(alias(context.nextFocusedView))
        snapshot("callback-query")
        let action = callbackAction
        callbackAction = nil
        action?()
    }
}
