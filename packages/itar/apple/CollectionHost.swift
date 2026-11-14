import UIKit
import ItarEngineCore

// One request-owned scroll chain. Weak views are resolved afresh at every step.
// React only prepares render regions; it never issues a delayed scroll command.
final class AppleCollections {
    private weak var root: ItarSurfaceHost?
    private(set) var document: CollectionDocument?
    private var configuration = ""
    private var pending: ItarEffect?
    private var steps: [CollectionEntry] = []
    private var step = 0
    private var prepared = false
    private var scrolled = false
    private var realized = false
    private var source = ItarFocus()
    private var handles: [String: ItarNode] = [:]
    private var settling: DispatchWorkItem?
    init(_ root: ItarSurfaceHost) { self.root = root }
    func entry(_ key: String) -> CollectionEntry? { document?.nodes.first { $0.key == key } }
    func accepts(_ key: String, dataset: String, scope: Bool) -> Bool {
        guard let entry = entry(key) else { return dataset.isEmpty }
        return entry.scope == scope && dataset == self.dataset
    }
    var dataset: String { document?.dataset ?? "0" }
    func ownsSource(_ registration: AppleRegistration) -> Bool {
        guard let root, let target = registration.target, root.acceptsInput,
              root.registrations[registration.key] === registration, target.registration === registration,
              target.owner === root, target.window === root.window, target.occurrenceKey == registration.key,
              target.targetEnabled, !target.label.isEmpty, target.collectionDataset == dataset,
              entry(registration.key)?.enabled == true, root.scopeActive(registration.scopeKey) else { return false }
        // Native focus animations can temporarily invalidate destination geometry.
        // A verified current source still owns ordered input during that interval.
        return UIFocusSystem.focusSystem(for: root)?.focusedItem === target
    }
    func retained(_ registration: AppleRegistration) -> Bool {
        guard pending != nil,
              source.kind == 0, source.node.slot == registration.node.slot,
              source.node.generation == registration.node.generation, source.mount == registration.mount,
              ownsSource(registration) else { return false }
        return true
    }
    func configure(_ text: String) {
        configuration = text
        guard !text.isEmpty, let root else { return }
        DispatchQueue.main.async { [weak self, weak root] in
            guard let self, let root, self.configuration == text,
                  let owner = root.dispatcher, !owner.closed else { return }
            guard !owner.pumping else { self.configure(text); return }
            root.commitGeometry()
            guard let document = CollectionDocument.decode(text) else { self.emit(["state": "rejected"]); return }
            owner.enqueue(.collections(document))
        }
    }
    func accept(_ next: CollectionDocument, status: Int32) {
        guard status == 0 || status == 1, let root else {
            emit(["state": "rejected", "dataset": next.dataset]); return
        }
        let previous = document
        let previousHandles = handles
        document = next
        handles = Dictionary(uniqueKeysWithValues: next.nodes.compactMap { entry in
            guard let node = try? root.dispatcher?.connection.find(entry.key) else { return nil }
            return (entry.key, node)
        })
        var losses: [(ItarNode, UInt64, Int32, UInt64)] = []
        for registration in Array(root.registrations.values) {
            guard let owned = previousHandles[registration.key],
                  registration.node.slot == owned.slot, registration.node.generation == owned.generation else { continue }
            let removed = entry(registration.key) == nil
            if let target = registration.target, removed || target.collectionDataset != next.dataset {
                target.isAccessibilityElement = false
                if let loss = root.detachMount(target) { losses.append((loss.node, loss.mount, 0, 0)) }
            }
            if removed { root.registrations.removeValue(forKey: registration.key) }
        }
        // The catalogue callback runs inside the dispatcher. One event per cell
        // would exhaust its 32-entry inbox; the catalogue bounds this batch to 256.
        if !losses.isEmpty { root.dispatcher?.enqueue(.invalidations(losses)) }
        for entry in previous?.nodes ?? [] where entry.scope && self.entry(entry.key) == nil {
            guard let owned = previousHandles[entry.key], let current = root.scopes[entry.key],
                  current.node.slot == owned.slot, current.node.generation == owned.generation else { continue }
            let scope = root.scopes.removeValue(forKey: entry.key)
            scope?.view?.accessibilityElementsHidden = true
            scope?.view?.owner = nil
            scope?.view?.registeredKey = ""
        }
        emit(["state": "catalog", "dataset": next.dataset])
        root.geometryChanged()
    }
    func invoke(_ effect: ItarEffect) -> Int32 {
        guard let root, root.acceptsInput, !UIAccessibility.isVoiceOverRunning,
              let document, UInt64(document.dataset) == effect.dataset,
              let target = document.nodes.first(where: {
                  handles[$0.key].map {
                      $0.slot == effect.target.slot && $0.generation == effect.target.generation
                  } == true
              }) else { return 1 }
        let path = document.path(target.key)
        guard !path.isEmpty, path.count <= 2 else { return 1 }
        release()
        pending = effect; steps = path; step = 0
        source = root.classify(UIFocusSystem.focusSystem(for: root)?.focusedItem)
        prepared = false; scrolled = false; realized = false
        prepare()
        return 0
    }
    private func emit(_ payload: [String: Any]) {
        guard let root, JSONSerialization.isValidJSONObject(payload),
              let bytes = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: bytes, encoding: .utf8),
              let record = root.stamp(["lifetime": String(root.lifetime), "payload": text]) else { return }
        root.onCollectionRecord?(record)
    }
    private func prepare() {
        guard let root, let effect = pending, let document, steps.indices.contains(step) else { return }
        let sourceKey = root.registrations.values.first { $0.node.slot == source.node.slot &&
            $0.node.generation == source.node.generation && $0.mount == source.mount }?.key
        func path(_ entries: [CollectionEntry]) -> [[String: Any]] {
            entries.map { ["collection": $0.parent, "key": $0.key, "index": $0.order] }
        }
        emit(["state": "prepare", "dataset": document.dataset, "request": String(effect.token.request),
              "effect": String(effect.token.effect), "step": step, "key": steps[step].key,
              "path": path(steps), "source": path(sourceKey.map(document.path) ?? [])])
    }
    func acknowledge(_ text: String) {
        guard let owner = root?.dispatcher, !owner.pumping, !owner.closed else { return }
        owner.enqueue(.time(owner.clock()))
        guard let root, !root.dispatcherIsPumping, text.utf8.count <= 4096,
              let data = text.data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let effect = pending, value["lifetime"] as? String == String(root.lifetime),
              value["request"] as? String == String(effect.token.request),
              value["effect"] as? String == String(effect.token.effect), value["dataset"] as? String == dataset,
              value["step"] as? Int == step, value["key"] as? String == steps[step].key,
              (try? root.dispatcher?.connection.snapshot().active_request) == effect.token.request else { return }
        prepared = true
        advance()
    }
    func advance() {
        guard prepared, !realized, pending != nil,
              let root, let owner = root.dispatcher, !owner.pumping, !owner.closed else { return }
        root.observeCurrent()
        owner.enqueue(.time(owner.clock()))
        guard prepared, !realized, !root.dispatcherIsPumping, let effect = pending, let document,
              root.acceptsInput, !UIAccessibility.isVoiceOverRunning,
              (try? root.dispatcher?.connection.snapshot().active_request) == effect.token.request,
              UInt64(document.dataset) == effect.dataset, steps.indices.contains(step),
              let scope = root.scopes[steps[step].parent]?.view else { return }
        if !scrolled {
            // Search only this owned boundary and stop at nested collection scopes.
            var queue = scope.subviews
            var scroll: UIScrollView?
            var count = 0
            while !queue.isEmpty {
                let view = queue.removeFirst(); count += 1
                guard count <= 4096, queue.count <= 4096 else { root.shutdown(); return }
                if let candidate = view as? UIScrollView { scroll = candidate; break }
                if view is ItarScopeHost { continue }
                queue.append(contentsOf: view.subviews)
            }
            guard let scroll, let list = entry(scope.scopeKey) else { fail(); return }
            if scroll.isDragging || scroll.isDecelerating {
                // Do not race UIKit's previous automatic scroll. This one
                // continuation is bounded by the unchanged engine deadline.
                if settling == nil {
                    let work = DispatchWorkItem { [weak self] in
                        self?.settling = nil
                        self?.advance()
                    }
                    settling = work
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.03, execute: work)
                }
                return
            }
            settling?.cancel(); settling = nil
            let offset = CGFloat(list.offset(steps[step].order))
            var point = scroll.contentOffset
            if list.layout == 1 {
                point.x = min(max(0, offset), max(0, scroll.contentSize.width - scroll.bounds.width))
            } else {
                point.y = min(max(0, offset), max(0, scroll.contentSize.height - scroll.bounds.height))
            }
            guard owner.hostCall({
                scrolled = true
                scroll.setContentOffset(point, animated: false)
                root.geometryChanged()
            }) else { return }
            // Finish after the native layout/scroll observations have committed.
            DispatchQueue.main.async { [weak self, weak root] in root?.commitGeometry(); self?.advance() }
            return
        }
        if step + 1 < steps.count {
            guard let row = root.scopes[steps[step].key]?.view, row.window === root.window,
                  root.bounds.intersects(row.convert(row.bounds, to: root)) else { return }
            step += 1; prepared = false; scrolled = false
            prepare()
            return
        }
        guard let registration = root.registrations[steps[step].key],
              registration.node.slot == effect.target.slot, registration.node.generation == effect.target.generation,
              registration.target?.collectionDataset == dataset, root.live(registration) != nil else { return }
        realized = true
        root.dispatcher?.enqueue(.realize(effect, registration.mount))
    }
    private func fail() {
        guard let root, let effect = pending else { return }
        root.dispatcher?.enqueue(.complete(effect.token, 1))
        release()
    }
    func cancel(_ effect: ItarEffect) -> Bool {
        guard let pending, effect.has_cancels != 0, pending.token.lifetime == effect.cancels.lifetime,
              pending.token.request == effect.cancels.request, pending.token.effect == effect.cancels.effect else { return false }
        // Preparation has no host operation; nonanimated scrolling has returned.
        release(); return true
    }
    func reconcile(_ request: UInt64) {
        if let pending, pending.token.request != request { release() }
    }
    func release() {
        settling?.cancel(); settling = nil
        let effect = pending
        pending = nil; steps.removeAll(); prepared = false; scrolled = false; realized = false
        if let effect { emit(["state": "release", "request": String(effect.token.request), "effect": String(effect.token.effect)]) }
    }
    func close() { release(); document = nil; handles.removeAll() }
}

extension ItarSurfaceHost {
    var dispatcherIsPumping: Bool { dispatcher?.pumping == true }
    func collectionDirection(_ presses: Set<UIPress>) -> Int32? {
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning, presses.count == 1,
              let type = presses.first?.type, let owner = dispatcher, !owner.pumping,
              let snapshot = try? owner.connection.snapshot(),
              let registration = registrations.values.first(where: { $0.node.slot == snapshot.input.node.slot &&
                  $0.node.generation == snapshot.input.node.generation && $0.mount == snapshot.input.mount }),
              collections.entry(registration.key) != nil,
              collections.ownsSource(registration) else { return nil }
        let direction: Int32
        switch type { case .leftArrow: direction = 0; case .rightArrow: direction = 1
        case .upArrow: direction = 2; case .downArrow: direction = 3; default: return nil }
        guard let proposal = try? owner.connection.directionQuery(direction) else { return nil }
        guard proposal.kind == 1 || snapshot.active_request != 0 else { return nil }
        return direction
    }
}
