import UIKit

// The owned presentation uses a new managed root in the existing UIKit window.
// A presentation is never assumed to create a UIWindow. Arbitrary RN Modal and
// separate-window routing are outside this mounted carrier increment.
final class ApplePresentation: UIViewController, UIAdaptivePresentationControllerDelegate {
    let root = ItarSurfaceHost()
    weak var opener: ItarSurfaceHost?
    weak var openerWindow: UIWindow?
    let openerLifetime: UInt64
    let restoration: UInt64
    private var restored = false
    private var closing = false

    init(opener: ItarSurfaceHost) {
        self.opener = opener
        openerWindow = opener.window
        openerLifetime = opener.lifetime
        opener.observeCurrent()
        restoration = (try? opener.dispatcher?.connection.captureRestoration()) ?? 0
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }
    required init?(coder: NSCoder) { fatalError("Owned presentation only") }
    override func loadView() {
        view = UIView()
        view.backgroundColor = .darkGray
        view.accessibilityViewIsModal = true
        root.frame = CGRect(x: 80, y: 80, width: 700, height: 280)
        view.addSubview(root)
        let nested = ItarTargetHost(frame: CGRect(x: 0, y: 20, width: 600, height: 80))
        nested.occurrenceKey = "nested"
        nested.label = "Open nested dialog"
        nested.onActivate = { [weak self] _ in self?.root.showDialog() }
        let dismiss = ItarTargetHost(frame: CGRect(x: 0, y: 150, width: 600, height: 80))
        dismiss.occurrenceKey = "dismiss"
        dismiss.label = "Dismiss dialog"
        dismiss.onActivate = { [weak self] _ in self?.close() }
        root.addSubview(nested)
        root.addSubview(dismiss)
    }
    override var preferredFocusEnvironments: [UIFocusEnvironment] { [root] }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        presentationController?.delegate = self
        root.commitGeometry()
    }

    func close(completion: (() -> Void)? = nil) {
        guard !closing else { return }
        if let child = root.presentation {
            child.close { [weak self] in self?.close(completion: completion) }
            return
        }
        closing = true
        root.shutdown()
        guard presentingViewController != nil else { restore(); completion?(); return }
        dismiss(animated: false) { [weak self] in self?.restore(); completion?() }
    }
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        root.shutdown()
        restore()
    }
    func restore() {
        guard !restored else { return }
        restored = true
        guard let opener, opener.lifetime == openerLifetime, opener.dispatcher?.closed == false else { return }
        opener.presentation = nil
        opener.covered = false
        opener.activityChanged()
        opener.layoutIfNeeded()
        opener.commitGeometry()
        opener.observeCurrent() // Adopt UIKit restoration before requesting another move.
        guard !UIAccessibility.isVoiceOverRunning, opener.window === openerWindow,
              let dispatcher = opener.dispatcher else { return }
        let now = dispatcher.clock()
        guard now <= UInt64.max - 500 else { return }
        dispatcher.enqueue(.restore(restoration, 0, now, now + 500))
    }
}

extension ItarSurfaceHost {
    @objc public func showDialog() {
        guard acceptsInput, presentation == nil else { return }
        var responder: UIResponder? = self
        while responder != nil && !(responder is UIViewController) { responder = responder?.next }
        guard let presenter = responder as? UIViewController, presenter.viewIfLoaded?.window === window,
              presenter.presentedViewController == nil, !presenter.isBeingDismissed else { return }
        let modal = ApplePresentation(opener: self)
        presentation = modal
        covered = true
        activityChanged() // Suspend before UIKit may move focus or call back inline.
        presenter.present(modal, animated: false) { [weak modal] in
            guard let modal else { return }
            if modal.presentingViewController == nil { modal.restore() }
        }
        if modal.presentingViewController == nil { modal.restore() }
    }
    @objc public func dismissDialog() { presentation?.close() }
}
