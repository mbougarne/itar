import Foundation
#if canImport(ItarEngineCore)
import ItarEngineCore
#endif

struct CollectionEntry: Decodable, Equatable {
    let key: String
    let parent: String
    let order: Int32
    let scope: Bool
    let enabled: Bool
    let layout: Int32
    let extent: Double
    var leadingExtent: Double? = nil
    var rowEntry: Int32? = nil
    func offset(_ index: Int32) -> Double {
        let first = leadingExtent ?? 0
        return first > 0 && index > 0 ? first + Double(index - 1) * extent : Double(index) * extent
    }
}
struct CollectionDocument: Decodable {
    let dataset: String
    let nodes: [CollectionEntry]
    static func decode(_ text: String) -> CollectionDocument? {
        guard let data = text.data(using: .utf8), data.count <= 524_288,
              let document = try? JSONDecoder().decode(Self.self, from: data),
              let revision = UInt64(document.dataset), revision > 0,
              document.nodes.count <= 256,
              document.nodes.allSatisfy({ node in
                  let first = node.leadingExtent ?? 0
                  return (node.rowEntry == nil || node.rowEntry == 0 || node.rowEntry == 1) &&
                      first.isFinite && first >= 0 && first <= 1_000_000 && (node.scope || first == 0)
              }) else { return nil }
        return document
    }
    func path(_ key: String) -> [CollectionEntry] {
        var result: [CollectionEntry] = []
        var item = nodes.first { $0.key == key }
        for _ in 0..<2 {
            guard let current = item, let parent = nodes.first(where: { $0.key == current.parent && $0.scope }) else { break }
            result.insert(current, at: 0)
            item = parent
        }
        return result
    }
}

extension EngineConnection {
    func collections(_ document: CollectionDocument) throws -> ItarBatchResult {
        // Arena and records are owned for the entire synchronous copying call.
        var arena: [UInt8] = []
        var spans: [(Int, Int)] = []
        for node in document.nodes {
            for key in [node.key, node.parent] {
                let bytes = Array(key.utf8)
                guard bytes.count <= 512 else { throw EngineBoundaryError.keyTooLong }
                spans.append((arena.count, bytes.count)); arena.append(contentsOf: bytes)
            }
        }
        return try arena.withUnsafeBufferPointer { bytes in
            func key(_ index: Int) -> ItarBytes {
                let span = spans[index]
                return ItarBytes(bytes: span.1 == 0 ? nil : bytes.baseAddress?.advanced(by: span.0), count: span.1)
            }
            let records = document.nodes.enumerated().map { index, node in
                ItarCollectionNode(key: key(index * 2), parent: key(index * 2 + 1), order: node.order,
                    layout: node.layout, scope: node.scope ? 1 : 0, enabled: node.enabled ? 1 : 0, extent: node.extent,
                    row_entry: node.rowEntry ?? 0)
            }
            let result = records.withUnsafeBufferPointer {
                itar_engine_collections(nativeHandle, lifetime, UInt64(document.dataset) ?? 0, $0.baseAddress, $0.count)
            }
            try checkCall(result.call)
            return result
        }
    }
    func directionQuery(_ direction: Int32, owner: Int32 = 0) throws -> ItarProposal {
        let result = itar_engine_direction_query(nativeHandle, lifetime, direction, owner)
        try checkCall(result.call)
        return result
    }
    func direction(_ direction: Int32, owner: Int32 = 0, deadline: UInt64) throws -> ItarRequestResult {
        let result = itar_engine_direction(nativeHandle, lifetime, direction, owner, deadline)
        try checkCall(result.call)
        return result
    }
    func releaseInput() throws { try checkCall(itar_engine_release_input(nativeHandle, lifetime)) }
    func realize(_ effect: ItarEffect, mount: UInt64) throws -> ItarRequestResult {
        let result = itar_engine_realize(nativeHandle, lifetime, effect.token, effect.target, mount, effect.dataset)
        try checkCall(result.call)
        return result
    }
}
