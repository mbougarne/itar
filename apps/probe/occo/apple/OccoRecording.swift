#if ITAR_OCCO
import Foundation

/// The main thread owns the ring. It receives value-only fields from the adapter.
/// Snapshots own their ordered array and can be encoded on another queue.
final class OccoRecording {
    private var slots: [[String: Any]?]
    private var next = 0
    private var count = 0
    private var sequence = 0
    private var dropped = 0
    private var origin: UInt64 = 0
    private var device: [String: Any] = [:]
    private let clock: () -> UInt64
    private(set) var state = "idle"

    init(capacity: Int = 1024, clock: @escaping () -> UInt64 = { DispatchTime.now().uptimeNanoseconds / 1_000_000 }) {
        precondition(capacity > 0)
        slots = Array(repeating: nil, count: capacity)
        self.clock = clock
    }

    func start(device: [String: Any]) {
        guard state != "recording" else { return }
        slots = Array(repeating: nil, count: slots.count)
        next = 0
        count = 0
        sequence = 0
        dropped = 0
        origin = clock()
        self.device = device
        state = "recording"
        append(["kind": "marker", "detail": "start"])
    }

    func mark() { append(["kind": "marker", "detail": "incident"]) }

    func freeze() {
        guard state == "recording" else { return }
        append(["kind": "marker", "detail": "freeze"])
        state = "frozen"
    }

    func append(_ fields: [String: Any]) {
        guard state == "recording" else { return }
        sequence += 1
        // Match the Android wire-key limit, counted in UTF-16 code units.
        if let target = fields["target"] as? String, target.utf16.prefix(2049).count > 2048 {
            dropped += 1
            return
        }
        var event = fields
        event["seq"] = sequence
        event["ms"] = clock() - origin
        if count == slots.count { dropped += 1 } else { count += 1 }
        slots[next] = event
        next = (next + 1) % slots.count
    }

    func snapshot() -> OccoSnapshot {
        let first = (next + slots.count - count) % slots.count
        let events = (0..<count).compactMap { slots[(first + $0) % slots.count] }
        return OccoSnapshot(state: state, capacity: slots.count, dropped: dropped, device: device, events: events)
    }
}

struct OccoSnapshot {
    let state: String
    let capacity: Int
    let dropped: Int
    let device: [String: Any]
    let events: [[String: Any]]

    func encoded() throws -> Data {
        let wireEvents = events.map { fields -> [String: Any] in
            var event = fields
            // IDs must round-trip across JS, including UInt64 values above 2^53.
            for key in ["surface", "move", "mount", "request", "effect"] {
                if let id = fields[key] as? UInt64 {
                    event[key] = id == 0 ? nil : String(id)
                }
            }
            if let target = fields["target"] as? String, target.hasPrefix("["),
               let parts = (try? JSONSerialization.jsonObject(with: Data(target.utf8))) as? [String],
               parts.count == 2, parts[0] == "target" {
                event["target"] = parts[1]
            }
            return event
        }
        return try JSONSerialization.data(withJSONObject: [
            "format": "occo", "version": 1, "state": state, "capacity": capacity,
            "dropped": dropped, "device": device, "events": wireEvents,
        ])
    }

    func write(to caches: URL) throws {
        let directory = caches.appendingPathComponent("occo", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try encoded().write(to: directory.appendingPathComponent("latest.json"), options: .atomic)
    }
}
#endif
