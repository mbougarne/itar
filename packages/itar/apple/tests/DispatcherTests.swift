import Foundation

enum DispatcherTests {
    static func fixture(_ lifetime: UInt64) throws -> (EngineDispatcher, ItarNode) {
        let connection = try EngineConnection(surface: lifetime, lifetime: lifetime)
        let dispatcher = EngineDispatcher(connection)
        dispatcher.clock = { 0 }
        var mutations: [EngineMutation] = []
        for key in ["a", "b"] {
            var mutation = EngineMutation(key: key)
            mutation.record.active = 1
            mutation.record.enabled = 1
            mutation.record.mounted = 1
            mutation.record.mount = 1
            mutation.record.entry_ready = 1
            mutation.record.geometry = ItarGeometry(surface: lifetime, mount: 1, layout: 1,
                bounds: ItarRect(x: key == "a" ? 0 : 20, y: 0, width: 10, height: 10), state: 2)
            mutations.append(mutation)
        }
        dispatcher.enqueue(.apply(mutations))
        dispatcher.enqueue(.focus(ItarFocus(kind: 0, node: try connection.find("a"), mount: 1), 0, nil))
        return (dispatcher, try connection.find("b"))
    }
    static func run() throws {
        let (owner, target) = try fixture(51)
        defer { owner.close() }
        var depth = 0
        var notifications: [ItarNotification] = []
        owner.notify = { record in
            precondition(depth == 0, "Notification while UIKit is active")
            notifications.append(record)
        }
        owner.invoke = { effect in
            depth += 1
            precondition(depth == 1 && owner.pumping, "Recursive host invocation")
            owner.enqueue(.focus(ItarFocus(kind: 0, node: target, mount: 1), 0, effect.token))
            precondition(notifications.isEmpty, "Recursive engine entry")
            depth -= 1
            return 0
        }
        owner.enqueue(.request("b", 0, 0, 100))
        precondition(notifications.count == 1 && notifications[0].confirmed_request != 0)
        let confirmed = try owner.connection.snapshot()
        precondition(confirmed.deadline == 0)

        let (cancelled, lateTarget) = try fixture(52)
        defer { cancelled.close() }
        var late: [ItarNotification] = []
        cancelled.notify = { late.append($0) }
        cancelled.invoke = { effect in
            if effect.token.kind == 2 { return 5 }
            cancelled.enqueue(.cancel(effect.token.request))
            cancelled.enqueue(.focus(ItarFocus(kind: 0, node: lateTarget, mount: 1), 0, effect.token))
            return 0
        }
        cancelled.enqueue(.request("b", 0, 0, 100))
        precondition(late.count == 1 && late[0].confirmed_request == 0, "Cancelled intent revived")

        let (disposed, _) = try fixture(53)
        disposed.invoke = { _ in
            disposed.close()
            do {
                _ = try disposed.connection.snapshot()
                preconditionFailure("Dispose did not revoke")
            } catch EngineBoundaryError.call(let status) {
                precondition(status == ITAR_DISPOSED, "Storage freed before host unwind")
            } catch { preconditionFailure("Unexpected disposal error") }
            return 0
        }
        disposed.enqueue(.request("b", 0, 0, 100))
        precondition(disposed.closed && !disposed.pumping)

        let (bounded, _) = try fixture(54)
        bounded.invoke = { _ in
            for _ in 0..<33 { bounded.enqueue(.time(0)) }
            return 0
        }
        bounded.enqueue(.request("b", 0, 0, 100))
        precondition(bounded.closed && bounded.overflow, "Unbounded callback inbox")
        print("Swift dispatcher checks passed")
    }
}
