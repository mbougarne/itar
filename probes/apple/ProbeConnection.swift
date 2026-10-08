import Foundation

// Probe lifetime sequence is main-thread confined, never derived from a view address.
final class ProbeConnection {
    private static var nextLifetime: UInt64 = 0
    let lifetime: UInt64
    let generation: UInt32
    private var handle: OpaquePointer?

    init(generation: UInt32 = 1) {
        precondition(Thread.isMainThread)
        Self.nextLifetime += 1
        lifetime = Self.nextLifetime
        self.generation = generation
        handle = itar_probe_create(lifetime, generation)
    }

    func query(slot: UInt32, direction: Int32, state: Int32 = 0) -> ItarProbeResult {
        precondition(Thread.isMainThread)
        return itar_probe_query(handle, lifetime, generation, state, slot, direction)
    }

    func invalidate(_ slot: UInt32) {
        precondition(Thread.isMainThread)
        _ = itar_probe_invalidate(handle, lifetime, slot, generation)
    }

    func revoke() { itar_probe_dispose(handle) }
    func close() {
        precondition(Thread.isMainThread)
        itar_probe_destroy(handle)
        handle = nil
    }
    deinit { close() }
}
