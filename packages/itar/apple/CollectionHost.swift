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
    private var requestedWindow = false
    private var scrolledViewports: [UIScrollView] = []
    private var confirmedViewports: [UIScrollView] = []
    private weak var confirmedTarget: ItarTargetHost?
    private var confirmedMount: UInt64 = 0
    private var source = ItarFocus()
    private var handles: [String: ItarNode] = [:]
    private var settling: DispatchWorkItem?
    // At most one entry per declared node, bounded by the catalogue capacity.
    private struct PublishedHost {
        weak var view: UIView?
        weak var parent: ItarScopeHost?
        let binding: AnyObject, node: ItarNode, mount: UInt64
        var dataset: String
    }
    private var publication: [String: PublishedHost] = [:]
    init(_ root: ItarSurfaceHost) { self.root = root }
    func rootsToDetach(under parents: Set<String>) -> [EngineMutation] {
        document?.detachRoots(under: parents, handles: handles) ?? []
    }
    func entry(_ key: String) -> CollectionEntry? { document?.nodes.first { $0.key == key } }
    func entry(_ node: ItarNode) -> CollectionEntry? {
        document?.nodes.first { handles[$0.key].map { $0.slot == node.slot && $0.generation == node.generation } == true }
    }
    func accepts(_ target: ItarTargetHost) -> Bool {
        accepts(target.occurrenceKey, dataset: target.collectionDataset, scope: false, view: target)
    }
    func accepts(_ scope: ItarScopeHost) -> Bool {
        accepts(scope.scopeKey, dataset: scope.collectionDataset, scope: true, view: scope)
    }
    private func accepts(_ key: String, dataset: String, scope: Bool, view: UIView) -> Bool {
        guard let entry = entry(key) else { return dataset.isEmpty }
        guard entry.scope == scope else { return false }
        if dataset == self.dataset {
            // Once this exact view has received current props, it cannot roll back.
            if publication[key]?.view === view, publication[key]?.dataset != dataset { publication[key]?.dataset = dataset }
            return true
        }
        guard let root, root.acceptsInput, publication[key]?.dataset == dataset else { return false }
        var current = key, host: UIView? = view
        for _ in 0..<3 {
            guard let view = host, let saved = publication[current], saved.view === view,
                  let node = handles[current], node.slot == saved.node.slot, node.generation == saved.node.generation,
                  view.window === root.window, let item = self.entry(current),
                  parentScope(of: view) === saved.parent, (saved.parent?.scopeKey ?? "") == item.parent else { return false }
            if let target = view as? ItarTargetHost {
                guard let binding = target.registration, binding === saved.binding, root.registrations[current] === binding,
                      binding.target === target, binding.mount == saved.mount, target.owner === root, target.nearestSurface() === root,
                      target.occurrenceKey == current, target.scopeKey == item.parent, target.targetEnabled else { return false }
            } else {
                guard let group = view as? ItarScopeHost, let binding = root.scopes[current],
                      binding === saved.binding, binding.view === group, group.owner === root, group.nearestSurface() === root, group.active,
                      (group.collectionDataset == self.dataset || group.collectionDataset == saved.dataset),
                      group.scopeKey == current, group.parentKey == item.parent else { return false }
            }
            if self.entry(item.parent) == nil { return true }
            current = item.parent; host = saved.parent
        }
        return false
    }
    private func parentScope(of view: UIView) -> ItarScopeHost? {
        var ancestor = view.superview
        while let next = ancestor, !(next is ItarSurfaceHost) {
            if let scope = next as? ItarScopeHost { return scope }
            ancestor = next.superview
        }
        return nil
    }
    private func retainPublication(_ next: CollectionDocument) -> [String: PublishedHost] {
        guard let root, let previous = document, root.acceptsInput else { return [:] }
        let growing = next.nodes.count > previous.nodes.count
        let focused = UIFocusSystem.focusSystem(for: root)?.focusedItem as? ItarTargetHost
        let nextByKey = Dictionary(uniqueKeysWithValues: next.nodes.map { ($0.key, $0) })
        var result: [String: PublishedHost] = [:]
        for registration in root.registrations.values {
            guard let target = registration.target, let item = entry(registration.key), let oldNode = handles[item.key],
                  oldNode.slot == registration.node.slot, oldNode.generation == registration.node.generation,
                  (target === focused && ownsSource(registration)) || (growing && root.live(registration) === target) else { continue }
            // Fabric may still be showing the previous page when native accepts
            // the append. Retain only existing views whose entire declaration
            // and actual ancestry survive. Changed indices and recycled views wait.
            var path: [(String, PublishedHost)] = []
            var current: CollectionEntry? = item
            var host: UIView = target
            while let old = current, path.count < 3 {
                guard var new = nextByKey[old.key] else { break }
                new.rowEntry = old.rowEntry; new.horizontalAlignment = old.horizontalAlignment
                let parent = parentScope(of: host)
                guard old == new, (parent?.scopeKey ?? "") == old.parent,
                      parent == nil || root.scopes[old.parent]?.view === parent else { break }
                let saved: PublishedHost
                if old.scope {
                    guard let scope = host as? ItarScopeHost, let binding = root.scopes[old.key],
                          binding.view === scope, accepts(scope) else { break }
                    saved = PublishedHost(view: scope, parent: parent, binding: binding, node: binding.node, mount: 0, dataset: scope.collectionDataset)
                } else {
                    saved = PublishedHost(view: target, parent: parent, binding: registration, node: registration.node,
                                          mount: registration.mount, dataset: target.collectionDataset)
                }
                path.append((old.key, saved))
                current = entry(old.parent)
                if let parent { host = parent }
            }
            if current == nil { for (key, binding) in path { result[key] = binding } }
        }
        return result
    }
    var dataset: String { document?.dataset ?? "0" }
    func ownsSource(_ registration: AppleRegistration) -> Bool {
        guard let root, let target = registration.target, root.acceptsInput,
              root.registrations[registration.key] === registration, target.registration === registration,
              target.owner === root, target.window === root.window, target.occurrenceKey == registration.key,
              target.targetEnabled, !target.label.isEmpty, accepts(target),
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
            if let target = registration.target, removed || !accepts(target) {
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
    func align(_ target: ItarTargetHost, dataset: String, observedReaderFocus: Bool = false, inputHeading: UIFocusHeading = [], paneEntry: Bool = false) {
        guard self.dataset == dataset, pending == nil, let root, root.acceptsInput,
              let registration = target.registration, let item = entry(registration.key), let list = entry(item.parent),
              (list.horizontalAlignment == "leading" || list.horizontalAlignment == "pinned"), let scope = root.scopes[list.key]?.view else { return }
        if UIAccessibility.isVoiceOverRunning {
            // In navigation mode UIKit can confirm a D-pad move without exposing
            // a separate VoiceOver cursor. Exploration may supply its own cursor.
            let cursor = UIAccessibility.focusedElement(using: .notificationVoiceOver)
            let followedInput = cursor == nil && (!inputHeading.isEmpty || paneEntry) &&
                (UIFocusSystem.focusSystem(for: root)?.focusedItem as? UIView) === target
            guard list.horizontalAlignment == "pinned", root.mounted(registration) === target,
                  observedReaderFocus || target.accessibilityElementIsFocused() ||
                    (cursor as? ItarTargetHost) === target || followedInput else { return }
        } else if !ownsSource(registration) { return }
        var parent = target.superview
        while let view = parent, view !== scope {
            if let scroll = view as? UIScrollView {
                guard scroll.isScrollEnabled || list.horizontalAlignment == "pinned",
                      !scroll.isTracking, !scroll.isDragging, !scroll.isDecelerating else { return }
                let bounds = target.convert(target.bounds, to: scroll)
                var point = scroll.contentOffset
                point.x = horizontalPosition(item, in: list, bounds: bounds, scroll: scroll)
                guard point != scroll.contentOffset else { return }
                scroll.setContentOffset(point, animated: false)
                root.geometryChanged(); return
            }
            parent = view.superview
        }
    }
    func isPinnedViewport(_ scroll: UIScrollView, for target: ItarTargetHost) -> Bool {
        guard let root, let item = entry(target.occurrenceKey),
              entry(item.parent)?.horizontalAlignment == "pinned",
              let (_, viewport) = viewport(for: item, enclosing: target, in: root) else { return false }
        return viewport === scroll
    }

    private func horizontalPosition(_ item: CollectionEntry, in list: CollectionEntry, bounds: CGRect, scroll: UIScrollView) -> CGFloat {
        let rtl = scroll.effectiveUserInterfaceLayoutDirection == .rightToLeft
        if list.horizontalAlignment == "pinned" {
            let maximum = max(0, scroll.contentSize.width - scroll.bounds.width)
            let position = min(maximum, max(0, list.offset(item.order)))
            return rtl ? maximum - position : position
        }
        return list.revealOffset(start: bounds.minX, end: bounds.maxX, current: scroll.contentOffset.x,
            viewport: scroll.bounds.width, content: scroll.contentSize.width, rtl: rtl)
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
        if mountedScrolls(for: effect) != nil {
            // Run after the dispatcher returns, so cancellation and inline UIKit
            // callbacks follow the same ordering as the render-window path.
            let work = DispatchWorkItem { [weak self] in self?.settling = nil; self?.revealMounted(effect) }
            settling = work
            DispatchQueue.main.async(execute: work)
        } else { prepare() }
        return 0
    }
    private struct MountedScroll {
        let view: UIScrollView, list: CollectionEntry, item: CollectionEntry
        var offset: CGPoint
    }
    private func viewport(for item: CollectionEntry, enclosing child: UIView, in root: ItarSurfaceHost) -> (ItarScopeHost, UIScrollView)? {
        guard let list = entry(item.parent), let scope = root.scopes[list.key]?.view, scope.owner === root,
              scope.scopeKey == list.key, scope.parentKey == list.parent, accepts(scope),
              scope.layout == list.layout, list.layout == 1 || list.layout == 2 else { return nil }
        var ancestor = child.superview, viewport: UIScrollView?
        while let view = ancestor, view !== scope {
            if view is ItarScopeHost || view is ItarSurfaceHost { return nil }
            if let scroll = view as? UIScrollView {
                guard viewport == nil else { return nil }
                viewport = scroll
            }
            ancestor = view.superview
        }
        guard ancestor === scope, let scroll = viewport else { return nil }
        return (scope, scroll)
    }
    private func rememberScroll(_ view: UIScrollView) {
        if !scrolledViewports.contains(view), scrolledViewports.count < 2 { scrolledViewports.append(view) }
    }
    // Row-entry policy chooses a card. If both rows share a viewport and
    // the chosen card already fits, UIKit has no vertical reveal to perform.
    private func staysVisible(_ target: ItarTargetHost, from previous: ItarTargetHost?, heading: UIFocusHeading,
                              in list: CollectionEntry, scroll: UIScrollView, root: ItarSurfaceHost) -> Bool {
        let requestedRowEntry = heading.isEmpty && root.preferred === target &&
            previous?.scopeKey != target.scopeKey && entry(target.scopeKey)?.horizontalAlignment == "pinned"
        guard list.layout == 2, heading == .up || heading == .down || requestedRowEntry,
              let previous, previous !== target, previous.owner === root,
              let source = previous.registration, root.registrations[source.key] === source,
              accepts(previous), previous.isDescendant(of: scroll),
              let row = document?.path(source.key).first(where: { $0.parent == list.key }),
              (list.leadingExtent ?? 0) == 0 || row.order != 0,
              scroll.zoomScale == 1, scroll.adjustedContentInset == .zero else { return false }
        return root.measured(target) != nil
    }
    // The engine may finish a reveal inside the focus observation callback.
    func confirming(_ target: ItarTargetHost?, from previous: ItarTargetHost?, heading: UIFocusHeading) {
        confirmedViewports.removeAll(); confirmedTarget = nil
        guard let root, root.acceptsInput, let target,
              target.owner === root, let registration = target.registration, let document else { return }
        let reader = UIAccessibility.isVoiceOverRunning
        let revealed = realized && pending?.target.slot == registration.node.slot && pending?.target.generation == registration.node.generation
        let sameRow = previous?.owner === root && previous?.registration?.scopeKey == registration.scopeKey
        let pinned = entry(registration.scopeKey)?.horizontalAlignment == "pinned"
        var child: UIView = target
        for item in document.path(registration.key).reversed() {
            guard let list = entry(item.parent), let (scope, scroll) = viewport(for: item, enclosing: child, in: root) else { break }
            // A custom header supplies its own inner ScrollView. Only the lists
            // created by the virtualized collection have adapter-owned scrolling.
            let customHeader = list.order == 0 && (entry(list.parent)?.leadingExtent ?? 0) > 0
            let aligned = child === target && (list.horizontalAlignment == "pinned" || list.horizontalAlignment == "leading")
            if reader {
                // Keep UIKit's own vertical reveal. Only suppress the automatic
                // horizontal centering of a row with an explicit pinned anchor.
                if aligned && pinned { confirmedViewports.append(scroll) }
                break
            }
            let alreadyVisible = (item.order != 0 || (list.leadingExtent ?? 0) == 0) &&
                staysVisible(target, from: previous, heading: heading, in: list, scroll: scroll, root: root)
            // A sideways move cannot require a vertical scroll once the whole card fits.
            // A scope restore from outside a pinned collection also has no vertical intent.
            let lateral = sameRow && (heading == .left || heading == .right || (revealed && pinned))
            let restored = pinned && root.preferred === target && previous?.owner === root &&
                previous?.isDescendant(of: scroll) == false
            let keepRowPosition = list.layout == 2 && (lateral || restored) && root.measured(target) != nil
            if !customHeader && (aligned || alreadyVisible || keepRowPosition || (revealed && scrolledViewports.contains(scroll))) {
                confirmedViewports.append(scroll)
            }
            child = scope
        }
        if !confirmedViewports.isEmpty { confirmedTarget = target; confirmedMount = registration.mount }
    }
    func finishFocusUpdate(_ context: UIFocusUpdateContext) {
        defer { confirmedViewports.removeAll(); confirmedTarget = nil }
        guard let root, root.acceptsInput, let target = confirmedTarget,
              target === context.nextFocusedView, target !== context.previouslyFocusedView,
              target.owner === root, target.registration?.mount == confirmedMount else { return }
        // UIKit schedules its automatic centering after the focus update. Let
        // the declared viewport keep Itar's placement for this scheduling turn.
        // The remote, later user scrolling and assistive navigation stay native.
        let paused = confirmedViewports.filter { scroll in
            scroll.isScrollEnabled && !scroll.isTracking && !scroll.isDragging && !scroll.isDecelerating &&
                scroll.window === root.window && target.isDescendant(of: scroll)
        }
        guard !paused.isEmpty else { return }
        for scroll in paused { scroll.isScrollEnabled = false }
        DispatchQueue.main.async { for scroll in paused { scroll.isScrollEnabled = true } }
    }
    private func owns(_ effect: ItarEffect) -> Bool {
        guard let token = pending?.token else { return false }
        return token.lifetime == effect.token.lifetime && token.request == effect.token.request && token.effect == effect.token.effect
    }
    private func mountedTarget(for effect: ItarEffect) -> ItarTargetHost? {
        guard let root, root.acceptsInput, !UIAccessibility.isVoiceOverRunning,
              owns(effect), effect.surface == root.lifetime,
              UInt64(dataset) == effect.dataset, effect.mount != 0,
              let key = steps.last?.key, let registration = root.registrations[key],
              registration.node.slot == effect.target.slot, registration.node.generation == effect.target.generation,
              registration.mount == effect.mount, let target = registration.target, target.registration === registration,
              target.owner === root, target.window === root.window, target.occurrenceKey == key,
              target.collectionDataset == dataset, target.scopeKey == steps.last?.parent,
              target.targetEnabled, entry(key)?.enabled == true, root.scopeActive(target.scopeKey),
              let focused = UIFocusSystem.focusSystem(for: root)?.focusedItem as? ItarTargetHost,
              let origin = focused.registration, origin.node.slot == source.node.slot, origin.node.generation == source.node.generation,
              origin.mount == source.mount, focused !== target, focused.collectionDataset == dataset, ownsSource(origin),
              let outer = steps.first?.parent, document?.path(origin.key).first?.parent == outer,
              let outerScope = root.scopes[outer]?.view, focused.isDescendant(of: outerScope) else { return nil }
        return target
    }
    // Only scroll views physically between a declared item and its matching
    // scope can move. Project the target through every clip, including the
    // surface, before touching a viewport. Unknown layouts use RN preparation.
    private func mountedScrolls(for effect: ItarEffect) -> [MountedScroll]? {
        guard let target = mountedTarget(for: effect) else { return nil }
        return mountedScrolls(to: target, path: steps)
    }

    // UIKit centers a newly focused item even when it is fully on screen.
    // Preserve the visible row during this pane handoff. Subsequent gestures
    // use the outer list's ordinary scrolling.
    func presentPane(_ target: ItarTargetHost, update: () -> Void) {
        guard let root, let reg = target.registration, root.live(reg) === target,
              entry(reg.scopeKey)?.horizontalAlignment == "pinned",
              let path = document?.path(reg.key), let scrolls = mountedScrolls(to: target, path: path) else {
            update()
            return
        }
        let visible = scrolls.filter { $0.list.layout == 2 && $0.view.contentOffset == $0.offset &&
            $0.view.isScrollEnabled && !$0.view.isTracking && !$0.view.isDragging && !$0.view.isDecelerating }
        for level in visible { level.view.isScrollEnabled = false }
        update()
        if !visible.isEmpty { DispatchQueue.main.async { for level in visible { level.view.isScrollEnabled = true } } }
    }

    // Revealing an explicitly presented pane only moves its declared collection
    // viewports. Directional exploration stays with VoiceOver.
    func revealPaneTarget(_ target: ItarTargetHost) {
        guard let document, let registration = target.registration,
              target.collectionDataset == dataset, root?.mounted(registration) === target else { return }
        let path = document.path(registration.key)
        guard !path.isEmpty, let planned = mountedScrolls(to: target, path: path) else { return }
        var moved = false
        for level in planned where level.view.contentOffset != level.offset {
            guard root?.mounted(registration) === target,
                  let current = mountedScrolls(to: target, path: path)?.first(where: { $0.view === level.view }) else { break }
            let before = current.view.contentOffset
            current.view.setContentOffset(current.offset, animated: false)
            moved = moved || current.view.contentOffset != before
        }
        // Pane discovery runs during a geometry commit. Re-measure the actual
        // new viewport once that commit has released its reentrancy guard.
        if moved { DispatchQueue.main.async { [weak root] in root?.geometryChanged() } }
    }

    private func mountedScrolls(to target: ItarTargetHost, path: [CollectionEntry]) -> [MountedScroll]? {
        guard let root else { return nil }
        var levels: [MountedScroll] = []
        var child: UIView = target
        for item in path.reversed() {
            guard let list = entry(item.parent), let (scope, scroll) = viewport(for: item, enclosing: child, in: root),
                  scope.collectionDataset == dataset, !scroll.isDragging, !scroll.isDecelerating,
                  scroll.zoomScale == 1, scroll.adjustedContentInset == .zero else { return nil }
            levels.append(MountedScroll(view: scroll, list: list, item: item, offset: scroll.contentOffset))
            child = scope
        }
        let fits = root.measured(target) { scroll, rect in
            guard let index = levels.firstIndex(where: { $0.view === scroll }) else { return scroll.contentOffset }
            let level = levels[index]
            var point = scroll.contentOffset
            if level.list.layout == 1 {
                point.x = self.horizontalPosition(level.item, in: level.list, bounds: rect, scroll: scroll)
            } else {
                point.y = level.list.revealOffset(start: rect.minY, end: rect.maxY, current: point.y,
                    viewport: scroll.bounds.height, content: scroll.contentSize.height)
            }
            levels[index].offset = point
            return point
        }
        return fits == nil ? nil : levels.reversed()
    }
    private func revealMounted(_ effect: ItarEffect) {
        guard let root, let owner = root.dispatcher, !owner.closed else { return }
        root.observeCurrent(); owner.enqueue(.time(owner.clock()))
        guard owns(effect),
              (try? owner.connection.snapshot().active_request) == effect.token.request else { return }
        if let planned = mountedScrolls(for: effect) {
            _ = owner.hostCall {
                for level in planned where level.view.contentOffset != level.offset {
                    // An outer scroll can synchronously recycle the inner view.
                    guard let current = mountedScrolls(for: effect)?.first(where: { $0.view === level.view }) else { return }
                    #if ITAR_OCCO
                    if ItarFocusTrace.receive != nil { root.traceEffect(effect, kind: "host", detail: "scroll to mounted item") }
                    #endif
                    rememberScroll(current.view)
                    current.view.setContentOffset(current.offset, animated: false)
                }
            }
            root.commitGeometry()
        }
        guard owns(effect) else { return }
        guard let target = mountedTarget(for: effect), let registration = target.registration else { fail(); return }
        if root.live(registration) === target { realize(effect, registration) }
        else { prepare() }
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
        requestedWindow = true
        let sourceKey = root.registrations.values.first { $0.node.slot == source.node.slot &&
            $0.node.generation == source.node.generation && $0.mount == source.mount }?.key
        func path(_ entries: [CollectionEntry]) -> [[String: Any]] {
            entries.map { ["collection": $0.parent, "key": $0.key, "index": $0.order] }
        }
        #if ITAR_OCCO
        if ItarFocusTrace.receive != nil { root.traceEffect(effect, kind: "host", detail: "requested render window") }
        #endif
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
                point.x = list.revealOffset(start: start, end: start + list.extent, current: point.x,
                    viewport: scroll.bounds.width, content: scroll.contentSize.width, rtl: rtl)
            } else {
                point.y = list.verticalOffset(for: steps[step].order, current: point.y,
                    viewport: scroll.bounds.height, content: scroll.contentSize.height)
            }
            guard owner.hostCall({
                scrolled = true
                #if ITAR_OCCO
                if ItarFocusTrace.receive != nil { root.traceEffect(effect, kind: "host", detail: "scroll to item") }
                #endif
                if scroll.contentOffset != point { rememberScroll(scroll) }
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
        realize(effect, registration)
    }
    private func realize(_ effect: ItarEffect, _ registration: AppleRegistration) {
        guard let root else { return }
        realized = true
        #if ITAR_OCCO
        ItarFocusTrace.receive?(["kind": "host", "surface": root.lifetime, "request": effect.token.request,
                                 "effect": effect.token.effect, "target": registration.key, "mount": registration.mount,
                                 "detail": "mount measured"])
        #endif
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
        scrolledViewports.removeAll()
        let effect = pending
        pending = nil; steps.removeAll(); prepared = false; scrolled = false; realized = false
        if requestedWindow, let effect { emit(["state": "release", "request": String(effect.token.request), "effect": String(effect.token.effect)]) }
        requestedWindow = false
    }
    func close() { release(); confirmedViewports.removeAll(); confirmedTarget = nil; publication.removeAll(); document = nil; handles.removeAll() }
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
              sourceRow.parent == targetRow.parent, let policy = collections.entry(sourceRow.parent)?.rowEntry, policy != 0 else { return nil }
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
              let type = presses.first?.type, let owner = dispatcher, !owner.pumping else { return nil }
        let direction: Int32
        switch type { case .leftArrow: direction = 0; case .rightArrow: direction = 1
        case .upArrow: direction = 2; case .downArrow: direction = 3; default: return nil }
        // UIKit evaluates mounted candidates during this press, before the next
        // main turn. Publish any pending bounds, including for host-owned moves.
        commitPendingGeometry()
        guard let snapshot = try? owner.connection.snapshot(),
              let registration = registrations.values.first(where: { $0.node.slot == snapshot.input.node.slot &&
                  $0.node.generation == snapshot.input.node.generation && $0.mount == snapshot.input.mount }),
              collections.entry(registration.key) != nil,
              collections.ownsSource(registration) else { return nil }
        guard let proposal = try? owner.connection.directionQuery(direction) else { return nil }
        if proposal.kind == 1 || snapshot.active_request != 0 { return direction }
        // A collection edge can face controls outside UIKit's geometric search
        // corridor. Honor an explicit restore-on-entry scope selected by C++.
        guard proposal.kind == 0, let destination = registrations.values.first(where: {
            $0.node.slot == proposal.target.slot && $0.node.generation == proposal.target.generation
        }), destination.scopeKey != registration.scopeKey, destination.target?.collectionDataset == "",
              restoringScope(entering: destination.scopeKey, from: registration.scopeKey) != nil,
              live(destination) != nil else { return nil }
        return direction
    }
}
