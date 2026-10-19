import Foundation

@main
struct BoundaryTests {
    static func check(_ condition: Bool, _ message: String) {
        precondition(condition, message)
    }

    static func main() throws {
        let owner = try EngineConnection(surface: 1, lifetime: 10, capacity: 8)
        defer { try? owner.close() }
        check(try owner.snapshot().revision == 0, "Initial revision")
        // Strings with embedded NUL retain their byte length through C.
        var mutation = EngineMutation(key: "episode\u{0}one")
        mutation.record.active = 1
        mutation.record.enabled = 1
        mutation.record.mounted = 1
        mutation.record.entry_ready = 1
        mutation.record.mount = 1
        mutation.record.geometry.surface = 1
        mutation.record.geometry.mount = 1
        mutation.record.geometry.layout = 1
        mutation.record.geometry.state = 2
        mutation.record.geometry.bounds = ItarRect(x: 0, y: 0, width: 20, height: 10)
        let batch = try owner.apply([mutation], revision: 0)
        check(batch.code == 0 && batch.revision == 1, "Atomic publication")
        let target = try owner.find("episode\u{0}one")
        check(target.slot != 0 && target.generation != 0, "Copied key and handle")
        _ = try owner.observe(ItarFocus(kind: 2, node: ItarNode(), mount: 0))
        _ = try owner.notifications()
        let request = try owner.requestFocus("episode\u{0}one", deadline: 100, dataset: 1)
        check(request.code == ITAR_REQUEST_STARTED, "Production request")
        let effects = try owner.effects()
        check(effects.count == 1, "One effect")
        let effect = effects[0]
        check(try owner.issue(effect.token).code == ITAR_REQUEST_ISSUED, "Issue revalidation")
        check(try owner.complete(effect.token, outcome: 0).code == ITAR_REQUEST_WAITING, "Acceptance waits")
        check(try owner.snapshot().input.kind == 2, "Accepted request is not observed focus")
        let confirmed = try owner.observe(ItarFocus(kind: 0, node: target, mount: 1), correlation: effect.token)
        check(confirmed.code == ITAR_REQUEST_CONFIRMED, "Actual host confirmation")
        let notifications = try owner.notifications()
        check(notifications.count == 1 && notifications[0].confirmed_request == request.request, "One notification")
        _ = try owner.observe(ItarFocus(kind: 0, node: target, mount: 1), correlation: effect.token)
        check(try owner.notifications().isEmpty, "Duplicate callback")
        _ = try owner.invalidate(target, mount: 1, kind: 0)
        check(try owner.snapshot().input.kind != 0, "Detached target loses authority")
        do {
            _ = try owner.find(String(repeating: "é", count: 257))
            preconditionFailure("Oversized UTF-8 key accepted")
        } catch EngineBoundaryError.keyTooLong { }
        try owner.revoke()
        try owner.revoke()
        do {
            _ = try owner.snapshot()
            preconditionFailure("Disposed surface accepted")
        } catch EngineBoundaryError.call(let status) {
            check(status == ITAR_DISPOSED, "Explicit disposal result")
        }
        try owner.close()
        try owner.close()
        try DispatcherTests.run()
        print("Swift production boundary checks passed")
    }
}
