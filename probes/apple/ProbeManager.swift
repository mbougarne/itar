import UIKit
import React

@objc(ItarAppleProbeManager)
final class ProbeManager: RCTViewManager {
    override static func requiresMainQueueSetup() -> Bool { true }
    override func view() -> UIView! { ProbeRoot() }
}

final class ProbeRoot: UIView {
    let connection = ProbeConnection()
    override init(frame: CGRect) {
        super.init(frame: frame)
        let result = connection.query(slot: 1, direction: 0)
        let label = UILabel(frame: CGRect(x: 0, y: 0, width: 700, height: 70))
        label.text = "C facade: status=\(result.status), target=\(result.slot)"
        addSubview(label)
    }
    required init?(coder: NSCoder) { fatalError("Programmatic probe only") }
}
