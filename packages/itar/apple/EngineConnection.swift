import Foundation

enum EngineBoundaryError: Error {
    case call(ItarCallStatus)
    case keyTooLong
    case batchTooLarge
}

struct EngineMutation {
    var kind: Int32 = 0
    var key: String
    var parent: String = ""
    var expected = ItarNode()
    var record = ItarRecord()
    var preferred: String? = nil
}

// The native surface owner creates and releases this on the main thread.
// It performs no UIKit operation or callback; a host dispatcher must serialize
// callbacks after its active invocation and defer close until that call unwinds.
final class EngineConnection {
    let lifetime: UInt64
    private let capacity: UInt32
    private var handle: OpaquePointer?

    init(surface: UInt64, lifetime: UInt64, capacity: UInt32 = 256) throws {
        precondition(Thread.isMainThread)
        self.lifetime = lifetime
        self.capacity = capacity
        var status = ITAR_INVALID
        handle = itar_engine_create(surface, lifetime, capacity, &status)
        try checked(status)
    }

    private func checked(_ status: ItarCallStatus) throws {
        if status != ITAR_OK { throw EngineBoundaryError.call(status) }
    }

    private func withKey<T>(_ key: String, _ body: (ItarBytes) throws -> T) throws -> T {
        let bytes = Array(key.utf8)
        guard bytes.count <= 512 else { throw EngineBoundaryError.keyTooLong }
        return try bytes.withUnsafeBufferPointer {
            try body(ItarBytes(bytes: $0.baseAddress, count: $0.count))
        }
    }

    func snapshot() throws -> ItarSnapshot {
        precondition(Thread.isMainThread)
        let result = itar_engine_snapshot(handle, lifetime)
        try checked(result.call)
        return result
    }

    // Batch code is separate from transport failure. Nonzero code rejects the
    // whole batch; the caller must inspect it before treating props as committed.
    func apply(_ mutations: [EngineMutation], revision: UInt64) throws -> ItarBatchResult {
        precondition(Thread.isMainThread)
        guard mutations.count <= Int(capacity) * 2 else { throw EngineBoundaryError.batchTooLarge }
        // One owned byte arena, borrowed only while the C call copies every key.
        var arena: [UInt8] = []
        var spans: [(start: Int, count: Int)] = []
        for mutation in mutations {
            for key in [mutation.key, mutation.parent, mutation.preferred ?? ""] {
                let bytes = Array(key.utf8)
                guard bytes.count <= 512 else { throw EngineBoundaryError.keyTooLong }
                spans.append((arena.count, bytes.count))
                arena.append(contentsOf: bytes)
            }
        }
        let result = arena.withUnsafeBufferPointer { bytes -> ItarBatchResult in
            func key(_ index: Int) -> ItarBytes {
                let span = spans[index]
                return ItarBytes(bytes: span.count == 0 ? nil : bytes.baseAddress?.advanced(by: span.start),
                                 count: span.count)
            }
            let records = mutations.enumerated().map { index, mutation -> ItarMutation in
                var record = ItarMutation()
                record.kind = mutation.kind
                record.key = key(index * 3)
                record.parent = key(index * 3 + 1)
                record.expected = mutation.expected
                record.record = mutation.record
                record.has_preferred = mutation.preferred == nil ? 0 : 1
                record.preferred = key(index * 3 + 2)
                return record
            }
            return records.withUnsafeBufferPointer {
                itar_engine_apply(handle, lifetime, revision, $0.baseAddress, $0.count)
            }
        }
        try checked(result.call)
        return result
    }

    func find(_ key: String) throws -> ItarNode {
        precondition(Thread.isMainThread)
        return try withKey(key) { bytes in
            var target = ItarNode()
            try checked(itar_engine_find(handle, lifetime, bytes, &target))
            return target
        }
    }

    func observe(_ focus: ItarFocus, channel: Int32 = 0,
                 correlation: ItarToken? = nil) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = itar_engine_observe_focus(handle, lifetime, channel, focus,
                                               correlation == nil ? 0 : 1,
                                               correlation ?? ItarToken())
        try checked(result.call)
        return result
    }

    func invalidate(_ node: ItarNode, mount: UInt64, kind: Int32,
                    through: UInt64 = 0) throws -> Int32 {
        precondition(Thread.isMainThread)
        var code: Int32 = -1
        try checked(itar_engine_invalidate(handle, lifetime, node, mount, kind, through, &code))
        return code
    }

    func requestFocus(_ key: String, authority: ItarNode = ItarNode(),
                      owner: Int32 = 0, deadline: UInt64, dataset: UInt64) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = try withKey(key) {
            itar_engine_request_focus(handle, lifetime, $0, authority, owner, deadline, dataset)
        }
        try checked(result.call)
        return result
    }

    func issue(_ token: ItarToken) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = itar_engine_issue(handle, lifetime, token)
        try checked(result.call)
        return result
    }

    func complete(_ token: ItarToken, outcome: Int32) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = itar_engine_complete(handle, lifetime, token, outcome)
        try checked(result.call)
        return result
    }

    func cancel(_ request: UInt64) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = itar_engine_cancel(handle, lifetime, request)
        try checked(result.call)
        return result
    }

    func advance(to now: UInt64) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = itar_engine_advance(handle, lifetime, now)
        try checked(result.call)
        return result
    }
    func captureRestoration() throws -> UInt64 {
        precondition(Thread.isMainThread)
        var token: UInt64 = 0
        try checked(itar_engine_capture_restoration(handle, lifetime, &token))
        return token
    }
    func restore(_ token: UInt64, owner: Int32, deadline: UInt64) throws -> ItarRequestResult {
        precondition(Thread.isMainThread)
        let result = itar_engine_restore(handle, lifetime, token, owner, deadline, 1)
        try checked(result.call)
        return result
    }

    func effects() throws -> [ItarEffect] {
        precondition(Thread.isMainThread)
        var records = Array(repeating: ItarEffect(), count: 32)
        var count = 0
        try records.withUnsafeMutableBufferPointer {
            try checked(itar_engine_effects(handle, lifetime, $0.baseAddress, $0.count, &count))
        }
        return Array(records.prefix(count))
    }

    func notifications() throws -> [ItarNotification] {
        precondition(Thread.isMainThread)
        var records = Array(repeating: ItarNotification(), count: 32)
        var count = 0
        try records.withUnsafeMutableBufferPointer {
            try checked(itar_engine_notifications(handle, lifetime, $0.baseAddress, $0.count, &count))
        }
        return Array(records.prefix(count))
    }

    func revoke() throws {
        precondition(Thread.isMainThread)
        guard handle != nil else { return }
        try checked(itar_engine_dispose(handle, lifetime))
    }

    func close() throws {
        precondition(Thread.isMainThread)
        try checked(itar_engine_destroy(handle))
        handle = nil
    }

    deinit {
        precondition(Thread.isMainThread)
        // No host callbacks cross the facade; destruction cannot reenter Swift.
        precondition(itar_engine_destroy(handle) == ITAR_OK)
    }
}
