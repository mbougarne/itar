# ITAR-0090 — PlayStation feasibility

Research completed 2026-11-04. Outcome: unresolved; public evidence inspected does
not establish a usable React Native deployment or engine integration contract.

The public [PlayStation Partners entry point](https://partners.playstation.net/)
describes developer/partner participation in search results; direct retrieval
returned no readable technical page. It establishes an access route, not an RN
renderer, a web host, a C++20 extension ABI or permission to deploy a TV application.
No already-authorized partner documentation was available in this task. No
registration, credential request or restricted SDK access was attempted.

| Required contract | Evidence gap |
| --- | --- |
| Runtime / renderer | Exact console generation, application category, SDK/OS and an officially usable RN renderer or approved embedded web host. Neither route is inferred from hardware. |
| C++20 / binding | Compiler and standard-library support, supported extension ABI, linking/package rules, thread affinity, ownership and callback lifetime. |
| Browser alternative | If a web host is permitted: engine/version, JS and Wasm feature set, module/resource loading and native bridge restrictions. No generic browser/Wasm assumption. |
| Focus and feedback | Controller input ownership, layout/geometry commits, actual-focus observations, native styling and host fallback on removal/loading. |
| Accessibility | Named reader/modes, semantics/actions, reader-owned navigation, speech behavior and focus restoration. |
| Lifecycle / distribution | Authorized app packaging, signing, install channel, suspend/resume and disposal; approved device-test access. |

The next deliverable must be an authorized contract review identifying these
capabilities and what may be documented publicly. Only after a usable route is
established should a small binding/focus probe receive implementation scope and
named device acceptance criteria. No probe implementation is proposed on invented
capabilities. Unresolved feasibility is a valid research conclusion; it does not
mean that integration is technically impossible or that support is promised.
