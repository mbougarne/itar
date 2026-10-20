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
        let (prepared, preparedTarget) = try fixture(56)
        var inlineNotifications = 0
        prepared.notify = { _ in inlineNotifications += 1 }
        let guarded = prepared.hostCall {
            prepared.enqueue(.invalidations(Array(repeating: (preparedTarget, 1, 1, 1), count: 256)))
            prepared.enqueue(.focus(ItarFocus(kind: 2, node: ItarNode(), mount: 0), 0, nil))
            precondition(prepared.pumping && inlineNotifications == 0, "Prepared scroll callback escaped the host guard")
        }
        precondition(guarded && !prepared.closed && inlineNotifications == 1)
        let afterHostCall = try prepared.connection.snapshot()
        precondition(afterHostCall.input.kind == 2)
        prepared.close()
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
        try invalidatedCommand()
        print("Swift dispatcher checks passed")
    }

    static func invalidatedCommand() throws {
        let (owner, _) = try fixture(55)
        defer { owner.close() }
        let source = try owner.connection.find("a")
        var commandRequest: UInt64 = 0
        var retired: [UInt64] = []
        owner.commandBegan = { command, result in
            precondition(command == "client" && result.code == ITAR_REQUEST_STARTED)
            commandRequest = result.request
        }
        owner.reconciled = { active in
            if commandRequest != 0 && active != commandRequest {
                retired.append(commandRequest)
                commandRequest = 0
            }
        }
        owner.invoke = { effect in
            if effect.token.kind == 2 { return 5 }
            // Both events arrive inside one host call; the configuration retires
            // the new command before its first effect can be dispatched.
            owner.enqueue(.requestCommand("a", "client", 0, 100))
            var update = EngineMutation(kind: 1, key: "a", expected: source)
            update.record.active = 1
            update.record.enabled = 0
            update.record.mounted = 1
            update.record.mount = 1
            update.record.entry_ready = 1
            update.record.geometry = ItarGeometry(surface: 55, mount: 1, layout: 1,
                bounds: ItarRect(x: 0, y: 0, width: 10, height: 10), state: 2)
            owner.enqueue(.apply([update]))
            return 0
        }
        owner.enqueue(.request("b", 0, 0, 100))
        precondition(!owner.closed && retired.count == 1 && commandRequest == 0,
                     "Silently invalidated command retained a pending caller")
    }
}
