import Foundation

// Copied values only; read-only queries never pump callbacks or dispatch effects.
final class ProbeDispatcher {
    private enum Event { case focus(String), invalidation(UInt32) }
    let connection: ProbeConnection
    private var inbox: [Event] = []
    private var invalid: Set<UInt32> = []
    private(set) var active = false
    private(set) var closed = false
    private(set) var overflow = false
    private(set) var observed = "unknown"
    init(_ connection: ProbeConnection) { self.connection = connection }

    func query(slot: UInt32, direction: Int32) -> ItarProbeResult {
        guard !closed, !invalid.contains(slot) else { return ItarProbeResult(status: 5, slot: 0, generation: 0) }
        let result = connection.query(slot: slot, direction: direction)
        guard !invalid.contains(result.slot) else { return ItarProbeResult(status: 5, slot: 0, generation: 0) }
        return result
    }
    private func enqueue(_ event: Event) {
        guard !closed else { return }
        guard inbox.count < 32 else { overflow = true; close(); return }
        inbox.append(event)
        if !active { drain() }
    }
    func observe(_ value: String) { enqueue(.focus(value)) }
    func invalidate(_ slot: UInt32) {
        invalid.insert(slot) // Reject native handles immediately, even inside a host call.
        enqueue(.invalidation(slot))
    }
    private func drain() {
        for event in inbox {
            switch event {
            case .focus(let value): observed = value
            case .invalidation(let slot): connection.invalidate(slot)
            }
        }
        inbox.removeAll(keepingCapacity: true)
    }
    @discardableResult func invoke(_ host: () -> Void) -> Bool {
        guard !closed, !active else { return false }
        active = true
        host()
        active = false
        if closed { connection.close() } else { drain() }
        return !closed // Invocation completed, never a claim of focus success.
    }
    func close() {
        closed = true
        inbox.removeAll()
        if !active { connection.close() }
    }
}
