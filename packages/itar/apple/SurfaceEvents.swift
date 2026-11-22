import Foundation
import ItarEngineCore

extension ItarSurfaceHost {
    func stamp(_ fields: [String: String]) -> NSDictionary? {
        guard eventSequence < UInt64.max else { dispatcher?.close(); return nil }
        eventSequence += 1
        var record = fields
        record["provider"] = providerId
        record["sequence"] = String(eventSequence)
        return record as NSDictionary
    }
    func surfaceRecord(_ state: String) {
        guard lifetime != 0, let record = stamp(["lifetime": String(lifetime), "state": state]) else { return }
        #if ITAR_OCCO
        ItarFocusTrace.receive?(["kind": "surface", "surface": lifetime, "detail": state])
        #endif
        onSurfaceRecord?(record)
    }
    func beganCommand(_ command: String, result: ItarRequestResult) {
        if result.request != 0 && result.code == ITAR_REQUEST_STARTED { commandRequests[result.request] = command }
        if result.request == 0 { emitRequest(result, command: command) }
    }
    func emitRequest(_ result: ItarRequestResult, command: String) {
        let names = ["started", "joined", "busy", "unavailable", "stale", "invalid", "cancelled", "unchanged",
                     "confirmed", "reconciled", "expired", "backward_time", "exhausted", "resync", "disposed", "issued", "waiting"]
        let status = names.indices.contains(Int(result.code)) ? names[Int(result.code)] : "invalid"
        #if ITAR_OCCO
        if let emit = ItarFocusTrace.receive,
           result.request != 0 || !command.isEmpty || dispatcher?.requestTarget != nil || (dispatcher?.requestMove ?? 0) != 0 {
            var event: [String: Any] = ["kind": "request", "surface": lifetime, "request": result.request,
                                        "move": dispatcher?.requestMove ?? 0, "detail": status]
            event["target"] = dispatcher?.requestTarget
            emit(event)
        }
        #endif
        if let record = stamp(["lifetime": String(lifetime), "request": String(result.request), "status": status, "command": command]) {
            onRequestRecord?(record)
        }
        if [3, 4, 5, 6, 8, 9, 10, 12, 13, 14].contains(result.code) { commandRequests.removeValue(forKey: result.request) }
    }
    @objc public func focusRequest(_ key: String, command: String) {
        guard !command.isEmpty, command.utf8.count <= 64 else { return }
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning, commandRequests.count < 32, let dispatcher else {
            emitRequest(ItarRequestResult(call: ITAR_OK, code: 3, request: 0), command: command)
            return
        }
        if !dispatcher.pumping { commitGeometry() }
        let now = dispatcher.clock()
        guard now <= UInt64.max - 3000 else { return }
        dispatcher.enqueue(.requestCommand(key, command, now, now + 3000))
    }
    @objc public func cancelRequest(_ command: String) {
        dispatcher?.enqueue(.cancelCommand(command))
    }
    @objc public func restoreScopeRequest(_ key: String, command: String) {
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning, let dispatcher else {
            emitRequest(ItarRequestResult(call: ITAR_OK, code: 3, request: 0), command: command)
            return
        }
        if !dispatcher.pumping { commitGeometry() }
        let now = dispatcher.clock()
        guard !command.isEmpty, command.utf8.count <= 64, now <= UInt64.max - 3000 else { return }
        dispatcher.enqueue(.restoreScopeCommand(key, command, now, now + 3000))
    }
}
