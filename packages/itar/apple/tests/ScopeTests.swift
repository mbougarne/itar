import Foundation

enum ScopeTests {
    static func run() throws {
        let owner = try EngineConnection(surface: 71, lifetime: 71)
        defer { try? owner.close() }
        var group = EngineMutation(key: "rail")
        group.record.scope = 1
        group.record.active = 1
        group.record.enabled = 1
        group.record.entry_ready = 1
        group.record.trap = 1
        group.record.layout = 1
        var target = EngineMutation(key: "a", parent: "rail")
        target.record.active = 1
        target.record.enabled = 1
        target.record.mounted = 1
        target.record.mount = 1
        target.record.entry_ready = 1
        target.record.geometry = ItarGeometry(surface: 71, mount: 1, layout: 1,
            bounds: ItarRect(x: 0, y: 0, width: 10, height: 10), state: 2)
        let batch = try owner.apply([target, group], revision: 0) // Final topology resolves parent order atomically.
        precondition(batch.code == 0)
        let node = try owner.find("a")
        _ = try owner.observe(ItarFocus(kind: 0, node: node, mount: 1))
        group.kind = 1
        group.expected = try owner.find("rail")
        group.record.active = 0
        let inactive = try owner.apply([group], revision: batch.revision)
        precondition(inactive.code == 0)
        let unavailable = try owner.requestFocus("a", deadline: 100, dataset: 1)
        precondition(unavailable.code == 3)
        group.record.active = 1
        let returning = try owner.apply([group], revision: inactive.revision)
        precondition(returning.code == 0)
        let request = try owner.requestFocus("a", deadline: 100, dataset: 1)
        precondition(request.code == ITAR_REQUEST_STARTED)
        _ = try owner.cancel(request.request)
        _ = try owner.observe(ItarFocus(kind: 1, node: ItarNode(), mount: 0))
        let restoration = try owner.restoreScope("rail", deadline: 100)
        precondition(restoration.code == ITAR_REQUEST_STARTED)
        print("Swift scope boundary checks passed")
    }
}
