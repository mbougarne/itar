# Agentic Coding Rules

These rules adapt the simplicity, correctness, reviewability, and verification
principles used in BZTAM and Job Board to Itar's C++ and React Native work.
Read them together with [AGENTS.md](../AGENTS.md), the
[accepted architecture](../tickets/docs/architecture.md), and the active
[implementation ticket](../tickets/backlog.md).

## 1. Make the smallest complete change

- Understand the relevant code and contracts before editing. Prefer a simple,
  complete solution over speculative abstractions, layers, or dependencies.
- Keep work within the ticket and its review budget. Include the tests needed
  to verify the behavior in the same change; split scope rather than defer
  essential verification to meet a line limit.
- Reuse established patterns. Where none exist, use idiomatic language and
  ecosystem conventions. Avoid unrelated renaming, formatting, and cleanup.
- Prefer clear names and straightforward control flow over compressed code.
  Comments explain invariants, ownership, platform limitations, and why a
  decision is necessary. Public contracts document observable behavior.
- Do not ship dead code, unfinished placeholders, or hypothetical extension
  points. Explicitly labelled test doubles and bounded probe implementations
  are appropriate when the ticket calls for them.

When trade-offs arise, prioritize correctness and safety, then simplicity and
maintainability. Meet measured performance requirements without obscuring the
implementation merely to make it shorter.

## 2. Preserve the accepted boundaries

- The architecture is frozen. Do not edit it or silently replace its contracts
  through code, tickets, or supplementary notes. Follow the conflict and
  open-choice procedures in [AGENTS.md](../AGENTS.md#accepted-architecture).
- Keep the C++20 engine independently buildable and testable. Navigation policy
  and state belong in the engine; React, JNI, UIKit, host views, scrolling, and
  accessibility integration belong at their respective boundaries.
- Use Kotlin for Android host behavior and Swift for Apple host behavior.
  Limit Objective-C++ to necessary integration glue. Validate the initial C
  facade or a contained alternative through the Apple binding probe.
- Keep React Native integration part of the deliverable. Do not build a generic
  engine and leave application developers to invent its focus adapter.
- Use bounded probe bindings to establish runtime viability. Promote them into
  production adapters only when the relevant research and probes support that
  route. React Native Web, Wasm, and console routes are open choices; a TV brand
  name is not a runtime contract. Roku is excluded.

## 3. Use C++ ownership and resource discipline

- Use RAII, value semantics, and explicit ownership. Prefer standard containers
  and smart pointers with justified ownership semantics over manual resource
  management. Borrowed pointers, references, and views need clear lifetimes.
- Keep identities and generations distinct. Async work must not retain an
  invalid host view or mistake a recycled mount for its former target.
- Favor compact data and contiguous hot-path storage where useful. Bound
  pending work and auxiliary memory. Avoid hidden process-wide engine state.
- Keep FFI contracts narrow: document ownership, thread affinity, buffer
  lifetime, cancellation, and error results. Do not let exceptions or internal
  standard-library types escape across C/JNI/Swift boundaries.
- Avoid per-candidate JavaScript calls, full graph serialization per key press,
  unnecessary allocations, and repeated measurement of unchanged geometry.
- Do not add custom allocators, spatial indexes, lock-free structures, or extra
  threads without a demonstrated requirement. C++ alone is not proof of lower
  latency or memory use.

## 4. Protect focus correctness under lifecycle changes

- Read and preserve the relevant architecture contracts for occurrence keys,
  atomic mutation batches, committed geometry, mount generations, and scopes.
  Rejected application batches must not revive an actually detached host view.
- Distinguish intent from observed host focus. Preserve managed, unmanaged,
  confirmed-absent, and unknown states; missing registration is not proof that
  the host has no focused target.
- Apply the dispatcher queue and reentrancy rules. Host callbacks may arrive
  synchronously during an effect. Correlate request and effect identities,
  revalidate before dispatch, and handle disposal without accessing dead state.
- Cancellation invalidates pending intent but cannot undo a host operation
  already dispatched. Reconcile its real outcome without reviving the request.
- Keep repeated input bounded and preserve the original deadline during
  coalescing. Use injected time in core tests, not real sleeps.
- Treat preventing an intermediate host focus jump and recovering afterwards
  as different capabilities. Test loading, removal, recycling, stale callbacks,
  and competing default targets before claiming stable focus.

## 5. Treat native styles and accessibility as required behavior

- Apply supported focus visuals from actual host focus without a React
  rerender or a per-move JS callback. Preserve base styles, reset recycled views,
  and respect reduced motion and native focus effects.
- Keep input focus, accessibility focus, and semantic activation distinct.
  Expose committed labels, roles, states, and actions before target eligibility.
- Respect screen-reader ownership and native controls. Do not force focus just
  to activate a target or depend on JS to decide native input ownership.
- Never announce a speculative destination or duplicate automatic reader
  speech. Do not promise synchronous speech or one announcement per key press.
- Include navigation, activation, scope transitions, restoration, and loading
  behavior in accessibility acceptance. Validate the readers and devices named
  by the ticket; a core test cannot establish screen-reader behavior.

## 6. Handle errors and trust boundaries explicitly

- Validate external data at the boundary and preserve internal invariants.
  Return meaningful failure results; do not swallow errors or invent success.
- Preserve type safety. Avoid broad casts, unchecked assertions, and `any` as
  shortcuts around an unclear contract. Handle cross-language conversion and
  resource failures explicitly.
- Do not disable compiler warnings, type checks, tests, or security controls
  to make a change pass. Keep diagnostics bounded and avoid exposing secrets,
  private content, credentials, or raw production logs.

## 7. Verify behavior and report evidence honestly

- Use meaningful behavioral tests for changed contracts, regression cases,
  boundary failures, and lifecycle races. Avoid tests that mirror the code or
  increase coverage without protecting behavior. Documentation-only changes
  need relevant consistency and link checks, not invented runtime tests.
- Run the available checks appropriate to the affected layer: core tests,
  compilation, native consumer builds, type checking, linting, or host probes.
  Use commands and versions present in the repository; do not invent scripts
  or claim unavailable infrastructure exists.
- Inspect the final changes for unintended edits. Record commands and results
  in ticket evidence where applicable. Name missing tools or device access and
  leave unsatisfied acceptance criteria open.
- Separate deterministic engine tests, emulator results, and physical-device
  results. Compilation is not platform acceptance; Android evidence is not
  automatically Fire TV evidence. Record runtime, version, device, and reader.
- Measure the full input-to-visible-feedback path under representative load.
  Separate selection, geometry/update work, host confirmation, allocations,
  memory, and startup costs. Pin comparison versions and distinguish policy
  differences. Do not infer device performance from language choice.
- Finish with a concise report of what changed, why, what was verified, and
  material limitations. Distinguish known facts, assumptions, and unrun checks;
  never claim a test, build, device scenario, or benchmark passed without proof.
