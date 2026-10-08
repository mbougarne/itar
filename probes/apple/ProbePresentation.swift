import UIKit

final class ProbePresentation: UIViewController {
    let probe = ProbeRoot(frame: CGRect(x: 100, y: 100, width: 700, height: 300))
    weak var opener: ProbeRoot?
    weak var openerWindow: UIWindow?
    var openerGeneration: UInt32 = 0
    weak var openerTarget: UIView?
    var openerEnabled = (a: false, b: false, d: false)

    override func loadView() {
        view = UIView()
        view.backgroundColor = .darkGray
        view.accessibilityViewIsModal = true
        view.addSubview(probe)
        probe.d.setTitle("Dismiss", for: .normal)
        probe.d.addTarget(self, action: #selector(closeProbe), for: .primaryActionTriggered)
    }
    override var preferredFocusEnvironments: [UIFocusEnvironment] { [probe] }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        probe.record("presented controller=ProbePresentation sameWindow=\(view.window === openerWindow)")
        probe.snapshot("presentation-ready")
    }
    @discardableResult static func open(from presenter: UIViewController, opener: ProbeRoot) -> ProbePresentation? {
        guard presenter.viewIfLoaded?.window != nil, presenter.presentedViewController == nil,
              !opener.dispatcher.closed, !opener.suspended else {
            opener.record("presentation rejected before suspension")
            return nil
        }
        let modal = ProbePresentation()
        modal.modalPresentationStyle = .fullScreen
        modal.opener = opener
        modal.openerWindow = opener.window
        modal.openerGeneration = opener.connection.generation
        modal.openerTarget = UIFocusSystem.focusSystem(for: opener)?.focusedItem as? UIView
        modal.openerEnabled = (opener.a.isEnabled, opener.b.isEnabled, opener.d.isEnabled)
        opener.suspended = true
        opener.accessibilityElementsHidden = true
        opener.a.isEnabled = false
        opener.b.isEnabled = false
        opener.d.isEnabled = false
        opener.record("presentation suspend")
        presenter.present(modal, animated: false)
        return modal
    }
    @objc func closeProbe() {
        guard presentingViewController != nil else { return }
        probe.dispatcher.close()
        probe.record("dismiss begin")
        dismiss(animated: false) { self.restoreOpener() }
    }
    func restoreOpener() {
        guard let opener, !opener.dispatcher.closed else { return }
        opener.suspended = false
        opener.accessibilityElementsHidden = false
        opener.a.isEnabled = openerEnabled.a && opener.live.contains(1)
        opener.b.isEnabled = openerEnabled.b && opener.live.contains(2)
        opener.d.isEnabled = openerEnabled.d
        opener.snapshot("dismiss host-restoration")
        guard !UIAccessibility.isVoiceOverRunning,
              opener.connection.generation == openerGeneration,
              let target = openerTarget, target.window != nil,
              !target.isHidden, (target as? UIControl)?.isEnabled != false else { return }
        // Reconcile UIKit restoration before issuing an optional, revalidated preference.
        if !target.isFocused { opener.request(target) }
        opener.snapshot("dismiss complete")
    }
}
