import Foundation

struct CollectionTests {
    static func check(_ condition: Bool) { precondition(condition) }
    static func run() throws {
        let connection = try EngineConnection(surface: 21, lifetime: 21, capacity: 8)
        defer { try? connection.close() }
        let text = """
        {"dataset":"1","nodes":[
          {"key":"list","parent":"","order":0,"scope":true,"enabled":true,"layout":1,"extent":100},
          {"key":"item","parent":"list","order":0,"scope":false,"enabled":true,"layout":0,"extent":0}]}
        """
        guard let document = CollectionDocument.decode(text) else { preconditionFailure("Valid catalog rejected") }
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
}
