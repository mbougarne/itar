import Foundation

struct CollectionTests {
    static func check(_ condition: Bool) { precondition(condition) }
    static func run() throws {
        try rowEntry()
        let column = CollectionEntry(key: "grid", parent: "", order: 0, scope: true,
            enabled: true, layout: 2, extent: 174, leadingExtent: 600)
        // Row 4 spans 1122...1296. A 660-point viewport at 530 only lacks its last 106 points.
        precondition(column.verticalOffset(for: 4, current: 530, viewport: 660, content: 2500) == 636)
        precondition(column.verticalOffset(for: 4, current: 700, viewport: 660, content: 2500) == 700)
        precondition(column.verticalOffset(for: 4, current: 1350, viewport: 660, content: 2500) == 1122)
        precondition(column.verticalOffset(for: 0, current: 250, viewport: 400, content: 2500) == 0)
        var row = CollectionEntry(key: "row", parent: "", order: 0, scope: true, enabled: true, layout: 1, extent: 100)
        precondition(row.revealOffset(start: 400, end: 500, current: 100, viewport: 300, content: 1000, rtl: false) == 200)
        precondition(row.revealOffset(start: 400, end: 800, current: 0, viewport: 300, content: 1000, rtl: false) == 400)
        row.horizontalAlignment = "leading"
        precondition(row.revealOffset(start: 400, end: 500, current: 100, viewport: 300, content: 1000, rtl: false) == 400)
        precondition(row.revealOffset(start: 500, end: 600, current: 700, viewport: 300, content: 1000, rtl: true) == 300)
        precondition(row.revealOffset(start: 900, end: 1000, current: 300, viewport: 350, content: 1000, rtl: false) == 650)
        let connection = try EngineConnection(surface: 21, lifetime: 21, capacity: 8)
        defer { try? connection.close() }
        let text = """
        {"dataset":"1","nodes":[
          {"key":"list","parent":"","order":0,"scope":true,"enabled":true,"layout":1,"extent":100},
          {"key":"item","parent":"list","order":0,"scope":false,"enabled":true,"layout":0,"extent":0}]}
        """
        guard let document = CollectionDocument.decode(text) else { preconditionFailure("Valid catalog rejected") }
        let nearest = text.replacingOccurrences(of: "\"extent\":100", with: "\"extent\":100,\"rowEntry\":0")
        precondition(CollectionDocument.decode(nearest) != nil)
        for value in ["-1", "3", "0.5", "\"first\""] {
            precondition(CollectionDocument.decode(nearest.replacingOccurrences(of: "\"rowEntry\":0", with: "\"rowEntry\":\(value)")) == nil)
        }
        let aligned = text.replacingOccurrences(of: "\"extent\":100", with: "\"extent\":100,\"horizontalAlignment\":\"leading\"")
        precondition(CollectionDocument.decode(aligned)?.nodes[0].horizontalAlignment == "leading")
        precondition(CollectionDocument.decode(aligned.replacingOccurrences(of: "leading", with: "center")) == nil)
        precondition(document.nodes[0].offset(2) == 200)
        let leading = text.replacingOccurrences(of: "\"extent\":100", with: "\"extent\":100,\"leadingExtent\":624")
        guard let withHeader = CollectionDocument.decode(leading) else { preconditionFailure("Leading row rejected") }
        precondition(withHeader.nodes[0].offset(0) == 0)
        precondition(withHeader.nodes[0].offset(1) == 624)
        precondition(withHeader.nodes[0].offset(2) == 724)
        precondition(CollectionDocument.decode(leading.replacingOccurrences(of: "624", with: "-1")) == nil)
        precondition(CollectionDocument.decode(leading.replacingOccurrences(of: "624", with: "1000001")) == nil)
        let invalidTarget = text.replacingOccurrences(of: "\"extent\":0", with: "\"extent\":0,\"leadingExtent\":624")
        precondition(CollectionDocument.decode(invalidTarget) == nil)
        precondition(document.path("item").map(\.key) == ["item"])
        check(try connection.collections(document).code == 0)
        check(try connection.snapshot().collection_dataset == 1)
        let revision = try connection.snapshot().revision
        check(try connection.collections(document).code == 1)
        check(try connection.snapshot().revision == revision)
        _ = try connection.observe(ItarFocus(kind: 2, node: ItarNode(), mount: 0))
        let request = try connection.requestFocus("item", deadline: 500, dataset: 1)
        precondition(request.code == ITAR_REQUEST_STARTED)
        let effect = try connection.effects()[0]
        precondition(effect.token.kind == 0 && effect.dataset == 1 && effect.resource == 1)
        check(try connection.issue(effect.token).code == ITAR_REQUEST_ISSUED)
        check(try connection.realize(effect, mount: 999).code == 4)
        precondition(CollectionDocument.decode(text.replacingOccurrences(of: "\"1\"", with: "\"0\"")) == nil)
        precondition(CollectionDocument.decode(String(repeating: "x", count: 524289)) == nil)
    }
    static func rowEntry() throws {
        let connection = try EngineConnection(surface: 31, lifetime: 31, capacity: 16)
        defer { try? connection.close() }
        let rows = ["header", "rail"]
        let scopes = rows.enumerated().map { index, key in
            "{\"key\":\"\(key)\",\"parent\":\"outer\",\"order\":\(index),\"scope\":true,\"enabled\":true,\"layout\":1,\"extent\":100}"
        }
        let items = rows.flatMap { row in (0..<3).map { index in
            "{\"key\":\"\(row)-\(index)\",\"parent\":\"\(row)\",\"order\":\(index),\"scope\":false,\"enabled\":\(row == "rail" && index == 0 ? "false" : "true"),\"layout\":0,\"extent\":0}"
        }}
        func document(_ revision: Int, _ policy: Int) -> CollectionDocument {
            let outer = "{\"key\":\"outer\",\"parent\":\"\",\"order\":0,\"scope\":true,\"enabled\":true,\"layout\":2,\"extent\":100,\"rowEntry\":\(policy)}"
            return CollectionDocument.decode("{\"dataset\":\"\(revision)\",\"nodes\":[\(([outer] + scopes + items).joined(separator: ","))]}")!
        }
        check(try connection.collections(document(1, 0)).code == 0)
        let source = try connection.find("header-2")
        var mutation = EngineMutation(kind: 1, key: "header-2", parent: "header", expected: source)
        mutation.record.order = 2; mutation.record.active = 1; mutation.record.enabled = 1
        mutation.record.mounted = 1; mutation.record.mount = 1; mutation.record.entry_ready = 1
        mutation.record.geometry = ItarGeometry(surface: 31, mount: 1, layout: 1,
            bounds: ItarRect(x: 200, y: 0, width: 80, height: 60), state: 2)
        check(try connection.apply([mutation], revision: connection.snapshot().revision).code == 0)
        _ = try connection.observe(ItarFocus(kind: 0, node: source, mount: 1))
        check(try connection.directionQuery(3).target.slot == connection.find("rail-2").slot)
        check(try connection.direction(3, deadline: 500).code == 0)
        check(try connection.collections(document(2, 1)).code == 0)
        check(try connection.snapshot().active_request == 0)
        let first = try connection.directionQuery(3)
        check(try first.kind == 1 && first.target.slot == connection.find("rail-1").slot)
        check(try connection.directionQuery(3, owner: 3).kind == 4)
        check(try connection.collections(document(1, 0)).code == 3)
        mutation.parent = "rail"; mutation.key = "rail-2"
        mutation.expected = try connection.find("rail-2")
        check(try connection.apply([mutation], revision: connection.snapshot().revision).code == 0)
        check(try connection.directionQuery(3).target.slot == connection.find("rail-1").slot)
        check(try connection.collections(document(3, 2)).code == 0)
        _ = try connection.observe(ItarFocus(kind: 0, node: mutation.expected, mount: 1))
        check(try connection.directionQuery(2).target.slot == source.slot)
        _ = try connection.observe(ItarFocus(kind: 0, node: source, mount: 1))
        check(try connection.directionQuery(3).target.slot == mutation.expected.slot)
    }
}
