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
        try retirePublishedParent()
        #if ITAR_OCCO
        try tracedDirection()
        #endif
        print("Swift dispatcher checks passed")
    }

    #if ITAR_OCCO
    static func tracedDirection() throws {
        let (owner, target) = try fixture(57)
        defer { owner.close() }
        var inputs: [(UInt64, UInt64)] = []
        var observations: [ItarNotification] = []
        owner.requested = { result in
            if owner.requestMove != 0 { inputs.append((owner.requestMove, result.request)) }
        }
        owner.notify = { observations.append($0) }
        owner.invoke = { effect in
            if effect.token.kind == 2 { return 5 }
            owner.enqueue(.cancel(effect.token.request))
            owner.enqueue(.focus(ItarFocus(kind: 0, node: target, mount: 1), 0, effect.token))
            owner.enqueue(.focus(ItarFocus(kind: 0, node: target, mount: 1), 1, nil))
            return 0
        }
        owner.enqueue(.recordedDirection(1, 0, 100, 42))
        precondition(inputs.count == 1 && inputs[0].0 == 42 && inputs[0].1 != 0)
        precondition(owner.requestMove == 0 && observations.map { $0.channel } == [0, 1])
        precondition(observations.allSatisfy { $0.confirmed_request == 0 })
    }
    #endif

    static func retirePublishedParent() throws {
        let connection = try EngineConnection(surface: 58, lifetime: 58)
        let owner = EngineDispatcher(connection)
        defer { owner.close() }
        var page = EngineMutation(key: "page")
        page.record.scope = 1; page.record.active = 1
        var next = page; next.key = "next"
        owner.enqueue(.apply([page, next]))
        let old = try connection.find("page")
        let retire = EngineMutation(kind: 3, key: "page", expected: old)
        let row = CollectionEntry(key: "row", parent: "page", order: 0, scope: true, enabled: true, layout: 1, extent: 100)
        let card = CollectionEntry(key: "card", parent: "row", order: 0, scope: false, enabled: true, layout: 0, extent: 0)
        var current: CollectionDocument?, handles = [String: ItarNode]()
        owner.catalogued = { document, status in
            precondition(status == 0 || status == 1)
            current = document
            handles = Dictionary(uniqueKeysWithValues: document.nodes.map { ($0.key, try! connection.find($0.key)) })
        }
        owner.collectionRootsToDetach = { current?.detachRoots(under: $0, handles: handles) ?? [] }
        owner.enqueue(.collections(CollectionDocument(dataset: "1", nodes: [row, card])))
        let firstRow = try connection.find("row")
        owner.enqueue(.retireScope([retire]))
        precondition(!owner.closed)
        let removed = try connection.find("page"), retained = try connection.find("row")
        precondition(removed.slot == 0 && retained.slot == firstRow.slot && retained.generation == firstRow.generation)

        owner.enqueue(.apply([page]))
        let replacement = try connection.find("page")
        precondition(replacement.slot != old.slot || replacement.generation != old.generation)
        owner.enqueue(.retireScope([retire]))
        let stillLive = try connection.find("page")
        precondition(stillLive.slot == replacement.slot && stillLive.generation == replacement.generation)

        // The replacement catalogue and the old view's recycle are queued while
        // UIKit owns the stack. The later recycle must use the accepted topology.
        let nextRow = CollectionEntry(key: "row", parent: "next", order: 0, scope: true, enabled: true, layout: 1, extent: 100)
        let reparent = CollectionDocument(dataset: "2", nodes: [nextRow, card])
        let currentPage = EngineMutation(kind: 3, key: "page", expected: replacement)
        precondition(owner.hostCall {
            owner.enqueue(.collections(reparent))
            owner.enqueue(.retireScope([currentPage]))
        })
        precondition(!owner.closed)
        owner.enqueue(.collections(CollectionDocument(dataset: "3", nodes: [])))
        let absent = try connection.find("row")
        precondition(absent.slot == 0 && !owner.closed)
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
