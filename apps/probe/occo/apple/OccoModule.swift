#if ITAR_OCCO
import React
import UIKit

/// The recorder belongs to Cinema's process, including across bridge reloads.
/// React calls the controls on the main queue alongside UIKit's focus callbacks.
@objc(ItarOccoModule) final class OccoModule: NSObject {
    private static let recording = OccoRecording()
    private static let worker = DispatchQueue(label: "org.itar.occo.export", qos: .utility)
    private static var reading = false

    @objc static func requiresMainQueueSetup() -> Bool { false }
    @objc var methodQueue: DispatchQueue { .main }

    @objc(state:rejecter:)
    func state(_ resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        resolve(Self.recording.state)
    }

    @objc(start:rejecter:)
    func start(_ resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        let recording = Self.recording
        if recording.state != "recording" {
            recording.start(device: [
                "model": UIDevice.current.model, "tvos": UIDevice.current.systemVersion,
                "voiceOverAtStart": UIAccessibility.isVoiceOverRunning,
            ])
            ItarFocusTrace.receive = recording.append
        }
        resolve(recording.state)
    }

    @objc(mark:rejecter:)
    func mark(_ resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        Self.recording.mark()
        resolve(Self.recording.state)
    }

    @objc(freeze:rejecter:)
    func freeze(_ resolve: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        ItarFocusTrace.receive = nil
        Self.recording.freeze()
        resolve(Self.recording.state)
    }

    @objc(snapshot:rejecter:)
    func snapshot(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        read(resolve, reject) { snapshot in
            String(decoding: try snapshot.encoded(), as: UTF8.self)
        }
    }

    @objc(exportRecording:rejecter:)
    func exportRecording(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        read(resolve, reject) { snapshot in
            let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            try snapshot.write(to: caches)
            return "Library/Caches/occo/latest.json"
        }
    }

    private func read(_ resolve: @escaping RCTPromiseResolveBlock, _ reject: @escaping RCTPromiseRejectBlock,
                      operation: @escaping (OccoSnapshot) throws -> String) {
        guard !Self.reading else {
            reject("OCCO_BUSY", "A recording read is already in progress", nil)
            return
        }
        Self.reading = true
        let snapshot = Self.recording.snapshot()
        Self.worker.async {
            let result = Result { try operation(snapshot) }
            DispatchQueue.main.async {
                Self.reading = false
                switch result {
                case let .success(value): resolve(value)
                case let .failure(error): reject("OCCO_READ", error.localizedDescription, error)
                }
            }
        }
    }
}
#endif
