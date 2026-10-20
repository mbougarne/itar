import Foundation
#if canImport(ItarEngineCore)
import ItarEngineCore
#endif

// A single owner inbox. UIKit callbacks copy values here; no callback recursively
// enters C++ or delivers React events while a host invocation is on the stack.
final class EngineDispatcher {
    enum Event {
        case apply([EngineMutation])
        case collections(CollectionDocument)
        case direction(Int32, UInt64, UInt64)
        case releaseInput
        case realize(ItarEffect, UInt64)
        case focus(ItarFocus, Int32, ItarToken?)
        case invalidate(ItarNode, UInt64, Int32, UInt64)
        case invalidations([(ItarNode, UInt64, Int32, UInt64)])
        case request(String, Int32, UInt64, UInt64)
        case requestCommand(String, String, UInt64, UInt64)
        case restoreScopeCommand(String, String, UInt64, UInt64)
        case cancelCommand(String)
        case cancel(UInt64)
        case time(UInt64)
        case complete(ItarToken, Int32)
        case restore(UInt64, Int32, UInt64, UInt64)
    }
    let connection: EngineConnection
    var catalogued: ((CollectionDocument, Int32) -> Void)?
    var invoke: ((ItarEffect) -> Int32)?
    var notify: ((ItarNotification) -> Void)?
    var requested: ((ItarRequestResult) -> Void)?
    var commandBegan: ((String, ItarRequestResult) -> Void)?
    var commandRequest: ((String) -> UInt64?)?
    var reconciled: ((UInt64) -> Void)?
    var failed: (() -> Void)?
    var clock: () -> UInt64 = { UInt64(ProcessInfo.processInfo.systemUptime * 1000) }
    private var inbox: [Event] = []
    private var effects: [ItarEffect] = []
    private var timer: DispatchWorkItem?
    private(set) var pumping = false
    private(set) var closed = false
    private(set) var overflow = false

    init(_ connection: EngineConnection) { self.connection = connection }

    // A prepared asynchronous reveal still invokes UIKit under the same guard
    // as an initially dispatched effect. Inline callbacks drain after it returns.
    func hostCall(_ work: () -> Void) -> Bool {
        precondition(Thread.isMainThread)
        guard !pumping, !closed else { return false }
        pumping = true
        work()
        pumping = false
        if closed { try? connection.close() } else { pump() }
        return true
    }

    func enqueue(_ event: Event) {
        precondition(Thread.isMainThread)
        guard !closed else { return }
        guard inbox.count < 32 else { fail(overflow: true); return }
        inbox.append(event)
        pump()
    }

    private func process(_ event: Event) throws {
        switch event {
        case .collections(let document):
            let result = try connection.collections(document)
            catalogued?(document, result.code)
        case .direction(let direction, let now, let deadline):
            _ = try connection.advance(to: now)
            let result = try connection.direction(direction, deadline: deadline)
            requested?(result)
        case .releaseInput:
            try connection.releaseInput()
        case .realize(let effect, let mount):
            requested?(try connection.realize(effect, mount: mount))
        case .apply(let mutations):
            let result = try connection.apply(mutations, revision: connection.snapshot().revision)
            // Host mappings must not become live after a rejected native batch.
            if result.code != 0 { fail() }
        case .focus(let focus, let channel, let correlation):
            let result = try connection.observe(focus, channel: channel, correlation: correlation)
            if result.request != 0 { requested?(result) }
        case .invalidate(let node, let mount, let kind, let through):
            _ = try connection.invalidate(node, mount: mount, kind: kind, through: through)
        case .invalidations(let values):
            guard values.count <= 256 else { fail(overflow: true); return }
            for (node, mount, kind, through) in values {
                _ = try connection.invalidate(node, mount: mount, kind: kind, through: through)
            }
        case .request(let key, let owner, let now, let deadline):
            let time = try connection.advance(to: now)
            if time.code == 10 { requested?(time) }
            let result = try connection.requestFocus(key, owner: owner, deadline: deadline, dataset: 1)
            requested?(result)
        case .requestCommand(let key, let command, let now, let deadline),
             .restoreScopeCommand(let key, let command, let now, let deadline):
            let time = try connection.advance(to: now)
            if time.code == 10 { requested?(time) }
            // Emit cancellation for the previous caller before assigning a new
            // native request identity; requestFocus's internal cancel is silent.
            let request = try connection.snapshot().active_request
            if request != 0 {
                let cancelled = try connection.cancel(request)
                requested?(cancelled)
            }
            let result: ItarRequestResult
            if case .restoreScopeCommand = event { result = try connection.restoreScope(key, deadline: deadline) }
            else { result = try connection.requestFocus(key, deadline: deadline, dataset: 1) }
            commandBegan?(command, result)
            requested?(result)
        case .cancelCommand(let command):
            if let request = commandRequest?(command) {
                let result = try connection.cancel(request)
                requested?(result)
            }
        case .cancel(let request):
            let result = try connection.cancel(request)
            requested?(result)
        case .time(let now):
            let result = try connection.advance(to: now)
            requested?(result)
        case .complete(let token, let outcome):
            let result = try connection.complete(token, outcome: outcome)
            // An inline observation may already have confirmed this request.
            // Its later acceptance record must not overwrite that terminal event.
            let stillPending = try connection.snapshot().deadline != 0
            if result.code != ITAR_REQUEST_WAITING || stillPending {
                requested?(result)
            }
        case .restore(let token, let owner, let now, let deadline):
            let time = try connection.advance(to: now)
            if time.code == 10 { requested?(time) }
            let result = try connection.restore(token, owner: owner, deadline: deadline)
            requested?(result)
        }
    }

    private func pump() {
        guard !pumping, !closed else { return }
        pumping = true
        defer {
            pumping = false
            if closed { try? connection.close() } else { schedule() }
        }
        do {
            var turns = 0
            while !closed {
                turns += 1
                guard turns <= 128 else { fail(overflow: true); break }
                if !inbox.isEmpty {
                    try process(inbox.removeFirst())
                    if !closed { reconciled?(try connection.snapshot().active_request) }
                    continue
                }
                let next = try connection.effects()
                guard effects.count + next.count <= 32 else { fail(overflow: true); break }
                effects.append(contentsOf: next)
                // Deliver only after observations have drained, before another host call.
                let notifications = try connection.notifications()
                for record in notifications where !closed { notify?(record) }
                if closed { break }
                if !inbox.isEmpty { continue }
                if try connection.snapshot().resync_required != 0 { fail(); break }
                guard !effects.isEmpty else { break }
                let effect = effects.removeFirst()
                let result = try connection.issue(effect.token)
                if result.code == ITAR_REQUEST_WAITING {
                    effects.insert(effect, at: 0)
                    break
                }
                guard result.code == ITAR_REQUEST_ISSUED else { continue }
                let outcome = invoke?(effect) ?? (effect.token.kind == 2 ? 5 : 1)
                if closed { break }
                // Inline observations precede this acceptance/completion record.
                // Both enter the engine only after UIKit has returned.
                enqueue(.complete(effect.token, outcome))
            }
        } catch { fail() }
    }

    private func schedule() {
        timer?.cancel()
        timer = nil
        guard let snapshot = try? connection.snapshot(), snapshot.deadline != 0 else { return }
        let now = clock()
        let delay = snapshot.deadline > now ? snapshot.deadline - now : 0
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.closed else { return }
            self.enqueue(.time(self.clock()))
        }
        timer = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(delay) / 1000, execute: work)
    }

    private func fail(overflow: Bool = false) {
        self.overflow = overflow // Failure never implies successful resynchronization.
        close()
        failed?()
    }

    func close() {
        precondition(Thread.isMainThread)
        guard !closed else { return }
        closed = true
        timer?.cancel()
        timer = nil
        inbox.removeAll()
        effects.removeAll()
        catalogued = nil
        invoke = nil
        notify = nil
        requested = nil
        commandBegan = nil
        commandRequest = nil
        reconciled = nil
        try? connection.revoke() // Immediate revocation, even inside UIKit callbacks.
        if !pumping { try? connection.close() }
    }
}
