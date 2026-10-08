import UIKit
import React

@objc(ItarAppleProbeManager)
final class ProbeManager: RCTViewManager {
    override static func requiresMainQueueSetup() -> Bool { true }
    override func view() -> UIView! { ProbeRoot() }
}
