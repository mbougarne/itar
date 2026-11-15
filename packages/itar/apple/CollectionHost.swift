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
    private struct Publication {
        let source: AppleRegistration, focus: ItarFocus, dataset: String
        let scopes: [(AppleScopeRegistration, ItarNode)]
    }
    private var publication: Publication?
    init(_ root: ItarSurfaceHost) { self.root = root }
    func entry(_ key: String) -> CollectionEntry? { document?.nodes.first { $0.key == key } }
    func entry(_ node: ItarNode) -> CollectionEntry? {
        document?.nodes.first { handles[$0.key].map { $0.slot == node.slot && $0.generation == node.generation } == true }
    }
    func accepts(_ key: String, dataset: String, scope: Bool) -> Bool {
        guard let entry = entry(key) else { return dataset.isEmpty }
        return entry.scope == scope && (dataset == self.dataset || acceptsPublication(key, dataset: dataset, scope: scope))
    }
    private func acceptsPublication(_ key: String, dataset: String, scope: Bool) -> Bool {
        guard let lease = publication, dataset == lease.dataset, let root, root.acceptsInput, let target = lease.source.target,
              root.registrations[lease.source.key] === lease.source, target.registration === lease.source,
              target.owner === root, target.nearestSurface() === root, target.window === root.window,
              target.occurrenceKey == lease.source.key, target.scopeKey == lease.source.scopeKey,
              lease.source.node.slot == lease.focus.node.slot, lease.source.node.generation == lease.focus.node.generation,
              lease.source.mount == lease.focus.mount, target.targetEnabled,
              UIFocusSystem.focusSystem(for: root)?.focusedItem === target else { return false }
        if !scope { return key == lease.source.key }
        return lease.scopes.contains { registration, node in
            guard registration.key == key, root.scopes[key] === registration, let view = registration.view else { return false }
            return registration.node.slot == node.slot && registration.node.generation == node.generation &&
                view.owner === root && view.nearestSurface() === root && view.window === root.window &&
                view.scopeKey == key && view.collectionDataset == dataset
        }
    }
    private func retainPublication(_ next: CollectionDocument) -> Publication? {
        guard let root, let previous = document, previous.nodes.count == next.nodes.count,
              zip(previous.nodes, next.nodes).contains(where: { old, new in (old.rowEntry ?? 0) != (new.rowEntry ?? 0) || old.horizontalAlignment != new.horizontalAlignment }),
              zip(previous.nodes, next.nodes).allSatisfy({ old, new in
                  var comparable = new; comparable.rowEntry = old.rowEntry; comparable.horizontalAlignment = old.horizontalAlignment; return comparable == old
              }), let target = UIFocusSystem.focusSystem(for: root)?.focusedItem as? ItarTargetHost,
              let source = target.registration, ownsSource(source) else { return nil }
        var scopes: [(AppleScopeRegistration, ItarNode)] = []
        for entry in previous.path(source.key) {
            guard let scope = root.scopes[entry.parent], let view = scope.view,
                  view.collectionDataset == previous.dataset else { return nil }
            scopes.append((scope, scope.node))
        }
        // ownsSource verified actual host focus even while animation geometry is unsettled.
        return Publication(source: source, focus: ItarFocus(kind: 0, node: source.node, mount: source.mount), dataset: previous.dataset, scopes: scopes)
    }
    var dataset: String { document?.dataset ?? "0" }
    func ownsSource(_ registration: AppleRegistration) -> Bool {
        guard let root, let target = registration.target, root.acceptsInput,
              root.registrations[registration.key] === registration, target.registration === registration,
              target.owner === root, target.window === root.window, target.occurrenceKey == registration.key,
              target.targetEnabled, !target.label.isEmpty, accepts(registration.key, dataset: target.collectionDataset, scope: false),
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
        publication = retainPublication(next)
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
            if let target = registration.target, removed || !accepts(registration.key, dataset: target.collectionDataset, scope: false) {
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
        if let target = UIFocusSystem.focusSystem(for: root)?.focusedItem as? ItarTargetHost,
           let registration = target.registration {
            DispatchQueue.main.async { [weak self, weak target] in
                guard let target, target.registration === registration else { return }
                self?.align(target, dataset: next.dataset)
            }
        }
    }
    func align(_ target: ItarTargetHost, dataset: String) {
        guard self.dataset == dataset, pending == nil, let root, root.acceptsInput,
              !UIAccessibility.isVoiceOverRunning, let registration = target.registration,
              ownsSource(registration), let item = entry(registration.key), let list = entry(item.parent),
              list.horizontalAlignment == "leading", let scope = root.scopes[list.key]?.view else { return }
        var parent = target.superview
        while let view = parent, view !== scope {
            if let scroll = view as? UIScrollView {
                guard !scroll.isDragging, !scroll.isDecelerating else { return }
                let bounds = target.convert(target.bounds, to: scroll)
                var point = scroll.contentOffset
                point.x = list.horizontalOffset(start: bounds.minX, end: bounds.maxX, current: point.x,
                    viewport: scroll.bounds.width, content: scroll.contentSize.width,
                    rtl: scroll.effectiveUserInterfaceLayoutDirection == .rightToLeft)
                scroll.setContentOffset(point, animated: false)
                root.geometryChanged(); return
            }
            parent = view.superview
        }
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
                let rtl = scroll.effectiveUserInterfaceLayoutDirection == .rightToLeft
                let start = rtl ? scroll.contentSize.width - offset - list.extent : offset
                point.x = list.horizontalOffset(start: start, end: start + list.extent, current: point.x,
                    viewport: scroll.bounds.width, content: scroll.contentSize.width, rtl: rtl)
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
    func close() { release(); publication = nil; document = nil; handles.removeAll() }
}

extension ItarSurfaceHost {
    // Reject an incorrect UIKit row entry, then request the C++ destination on
    // the next owner turn. Never recursively invoke UIKit from its focus query.
    // nil leaves the normal scope-entry policy in charge; true accepts UIKit's
    // already-correct destination; false defers an incorrect intermediate move.
    func allowCollectionEntry(from previous: ItarTargetHost, to next: ItarTargetHost, heading: UIFocusHeading) -> Bool? {
        let direction: Int32
        switch heading { case .up: direction = 2; case .down: direction = 3; default: return nil }
        guard acceptsInput, !UIAccessibility.isVoiceOverRunning,
              previous.owner === self, next.owner === self, previous.isFocused,
              let origin = previous.registration, collections.ownsSource(origin),
              let owner = dispatcher, !owner.pumping, !owner.closed,
              let snapshot = try? owner.connection.snapshot(), snapshot.active_request == 0,
              snapshot.input.kind == 0, snapshot.input.node.slot == origin.node.slot,
              snapshot.input.node.generation == origin.node.generation, snapshot.input.mount == origin.mount,
              let proposal = try? owner.connection.directionQuery(direction), proposal.kind == 0 || proposal.kind == 1,
              let source = collections.entry(origin.key), let sourceRow = collections.entry(source.parent),
              let target = collections.entry(proposal.target), let targetRow = collections.entry(target.parent),
              sourceRow.key != targetRow.key, sourceRow.layout == 1, targetRow.layout == 1,
              sourceRow.parent == targetRow.parent, collections.entry(sourceRow.parent)?.rowEntry == 1 else { return nil }
        if let registration = next.registration, registration.node.slot == proposal.target.slot,
           registration.node.generation == proposal.target.generation, live(registration) === next { return true }
        let dataset = collections.dataset, declaration = collectionData, sequence = eventSequence, lifetime = lifetime, mount = origin.mount
        let now = owner.clock()
        guard now <= UInt64.max - 3000 else { return nil }
        entryWork?.cancel()
        let work = DispatchWorkItem { [weak self, weak previous] in
            guard let self, let previous, self.acceptsInput, !UIAccessibility.isVoiceOverRunning,
                  self.lifetime == lifetime, self.collections.dataset == dataset, self.collectionData == declaration, self.eventSequence == sequence,
                  previous.registration === origin, origin.mount == mount, self.collections.ownsSource(origin),
                  owner.clock() < now + 3000 else { return }
            self.entryWork = nil
            self.commitGeometry()
            guard self.collections.dataset == dataset, self.collections.ownsSource(origin) else { return }
            owner.enqueue(.direction(direction, owner.clock(), now + 3000))
            owner.enqueue(.releaseInput)
        }
        entryWork = work
        DispatchQueue.main.async(execute: work)
        return false
    }
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
